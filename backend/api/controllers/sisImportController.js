const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { Pool } = require('pg');
const { parseSISFile } = require('../services/sisParserService');
const { calculateSemesterComponents } = require('../services/debtCalculator');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'sis-imports');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const fileId = crypto.randomUUID();
    cb(null, `${fileId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const getMetaPath = (fileId) => path.join(uploadDir, `${fileId}.json`);

const writeMetaFile = async (fileId, meta) => {
  await fs.promises.writeFile(getMetaPath(fileId), JSON.stringify(meta, null, 2));
};

const readMetaFile = async (fileId) => {
  const raw = await fs.promises.readFile(getMetaPath(fileId), 'utf-8');
  return JSON.parse(raw);
};

const normalize = (value) => (value || '').toString().trim();

const toUpper = (value) => normalize(value).toUpperCase();

const findOrCreateDepartment = async (client, departmentName) => {
  const existing = await client.query(
    'SELECT department_id FROM departments WHERE LOWER(department_name) = LOWER($1) LIMIT 1',
    [departmentName]
  );
  if (existing.rows.length) {
    return existing.rows[0].department_id;
  }
  const created = await client.query(
    'INSERT INTO departments (department_name) VALUES ($1) RETURNING department_id',
    [departmentName]
  );
  return created.rows[0].department_id;
};

const upsertStudentSisData = async ({
  client,
  studentId,
  batchId,
  record,
}) => {
  await client.query(
    `INSERT INTO student_sis_data
     (student_id, sis_student_id, program_code, enrollment_date, expected_graduation, living_stipend_choice,
      batch_id, full_name, email, phone, department_name, faculty, batch_year, tuition_base_amount)
     VALUES ($1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (student_id)
     DO UPDATE SET
       sis_student_id = EXCLUDED.sis_student_id,
       program_code = EXCLUDED.program_code,
       enrollment_date = EXCLUDED.enrollment_date,
       expected_graduation = EXCLUDED.expected_graduation,
       living_stipend_choice = EXCLUDED.living_stipend_choice,
       batch_id = EXCLUDED.batch_id,
       full_name = EXCLUDED.full_name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       department_name = EXCLUDED.department_name,
       faculty = EXCLUDED.faculty,
       batch_year = EXCLUDED.batch_year,
       tuition_base_amount = EXCLUDED.tuition_base_amount,
       imported_at = CURRENT_TIMESTAMP`,
    [
      studentId,
      record.sisStudentId || null,
      record.programCode || null,
      record.enrollmentDate || null,
      record.expectedGraduation || null,
      record.livingStipendChoice,
      batchId,
      record.fullName || null,
      record.email || null,
      record.phone || null,
      record.departmentName || null,
      record.faculty || null,
      record.batchYear || null,
      record.tuitionBaseAmount || null,
    ]
  );
};

const upsertDebtRecords = async ({ client, studentId, totalDebt }) => {
  const updateDebt = await client.query(
    `UPDATE debt_records
     SET initial_amount = $2, current_balance = $2
     WHERE student_id = $1`,
    [studentId, totalDebt]
  );

  if (updateDebt.rowCount === 0) {
    await client.query(
      `INSERT INTO debt_records (student_id, initial_amount, current_balance)
       VALUES ($1, $2, $2)`,
      [studentId, totalDebt]
    );
  }
};

exports.uploadSISFile = [
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const { originalname, filename, size } = req.file;
      const fileId = path.parse(filename).name;
      const { summary, previewRows } = await parseSISFile(
        req.file.path,
        originalname
      );

      await writeMetaFile(fileId, {
        fileId,
        originalName: originalname,
        storedName: filename,
        size,
        uploadedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        fileId,
        fileName: originalname,
        summary,
        previewRows,
      });
    } catch (error) {
      console.error('SIS file upload parse error:', error);
      return res.status(400).json({
        error: 'Failed to parse SIS file.',
        details: error.message,
      });
    }
  },
];

exports.confirmSISImport = async (req, res) => {
  const { fileId, notes } = req.body || {};
  if (!fileId) {
    return res.status(400).json({ error: 'fileId is required.' });
  }

  const client = await pool.connect();

  try {
    const meta = await readMetaFile(fileId);
    const filePath = path.join(uploadDir, meta.storedName);
    const { summary, parsedRows } = await parseSISFile(
      filePath,
      meta.originalName
    );

    if (summary.errors.length) {
      return res.status(422).json({
        error: 'SIS file contains validation errors.',
        errors: summary.errors,
      });
    }

    await client.query('BEGIN');

    const batchResult = await client.query(
      `INSERT INTO sis_import_batches
       (imported_by, file_name, file_size_bytes, student_count, total_debt_imported, status, notes)
       VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6)
       RETURNING batch_id`,
      [
        req.user?.userId || null,
        meta.originalName || null,
        meta.size || null,
        summary.totalStudents,
        summary.totalDebt,
        notes || null,
      ]
    );

    const batchId = batchResult.rows[0].batch_id;

    for (const row of parsedRows) {
      if (row.errors.length) {
        continue;
      }

      const record = row.data;
      const departmentName = normalize(record.departmentName) || 'Unknown';
      const departmentId = await findOrCreateDepartment(client, departmentName);

      let userId = null;
      let studentId = null;

      const email = normalize(record.email).toLowerCase();
      const studentNumber = normalize(record.studentNumber);
      const fullName = normalize(record.fullName);

      const userResult = await client.query(
        'SELECT user_id, student_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email]
      );

      if (userResult.rows.length) {
        userId = userResult.rows[0].user_id;
        studentId = userResult.rows[0].student_id;
      } else {
        const insertUser = await client.query(
          `INSERT INTO users (full_name, email, role, is_active, department_id)
           VALUES ($1, $2, 'STUDENT', TRUE, $3)
           RETURNING user_id`,
          [fullName, email, departmentId]
        );
        userId = insertUser.rows[0].user_id;
      }

      if (!studentId) {
        const insertStudent = await client.query(
          `INSERT INTO students (user_id, department_id, student_number, batch, enrollment_status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           RETURNING student_id`,
          [userId, departmentId, studentNumber, record.batchYear || null]
        );
        studentId = insertStudent.rows[0].student_id;
        await client.query('UPDATE users SET student_id = $1 WHERE user_id = $2', [
          studentId,
          userId,
        ]);
      }

      await upsertStudentSisData({
        client,
        studentId,
        batchId,
        record,
      });

      const components = calculateSemesterComponents({
        studentId,
        semesters: record.semesters,
        startYear: record.startYear || new Date().getFullYear(),
        tuitionBaseAnnual: record.tuitionBaseAmount || 0,
        livingStipendChoice: record.livingStipendChoice,
      });

      let studentTotal = 0;
      for (const component of components) {
        await client.query(
          `INSERT INTO debt_components
           (student_id, semester, academic_year, component_type, amount, description, due_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (student_id, semester, component_type)
           DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description`,
          [
            component.studentId,
            component.semester,
            component.academicYear,
            component.componentType,
            component.amount,
            component.description,
            component.dueDate,
          ]
        );
        studentTotal += component.amount;
      }

      if (record.totals.other > 0) {
        await client.query(
          `INSERT INTO debt_components
           (student_id, semester, academic_year, component_type, amount, description, due_date)
           VALUES ($1, $2, $3, 'OTHER', $4, $5, $6)
           ON CONFLICT (student_id, semester, component_type)
           DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description`,
          [
            studentId,
            1,
            `${record.startYear || new Date().getFullYear()}-${
              (record.startYear || new Date().getFullYear()) + 1
            }`,
            record.totals.other,
            'Imported SIS other fees',
            null,
          ]
        );
        studentTotal += record.totals.other;
      }

      await upsertDebtRecords({ client, studentId, totalDebt: studentTotal });
    }

    await client.query(
      `INSERT INTO sis_imports (imported_by, file_name, student_count, total_debt_imported)
       VALUES ($1, $2, $3, $4)`,
      [req.user?.userId || null, meta.originalName, summary.totalStudents, summary.totalDebt]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      batchId,
      studentCount: summary.totalStudents,
      totalDebtImported: summary.totalDebt,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('SIS import confirm error:', error);
    return res.status(500).json({ error: 'Failed to confirm SIS import.', details: error.message });
  } finally {
    client.release();
  }
};

exports.getSISImportHistory = async (req, res) => {
  try {
    const tableCheck = await pool.query(
      "SELECT to_regclass('public.sis_import_batches') AS table_name"
    );

    if (!tableCheck.rows[0]?.table_name) {
      const legacy = await pool.query(
        `SELECT
           import_id AS batch_id,
           import_date,
           file_name,
           student_count,
           total_debt_imported,
           'LEGACY' AS status,
           NULL AS notes
         FROM sis_imports
         ORDER BY import_date DESC
         LIMIT 50`
      );

      return res.json({ success: true, batches: legacy.rows });
    }

    const result = await pool.query(
      `SELECT batch_id, import_date, file_name, student_count, total_debt_imported, status, notes
       FROM sis_import_batches
       ORDER BY import_date DESC
       LIMIT 50`
    );

    return res.json({ success: true, batches: result.rows });
  } catch (error) {
    console.error('SIS import history error:', error);
    return res.status(500).json({ error: 'Failed to fetch SIS import history.' });
  }
};

exports.getSISImportBatchStudents = async (req, res) => {
  const { batchId } = req.params;
  if (!batchId) {
    return res.status(400).json({ error: 'Batch id is required.' });
  }

  try {
    const tableCheck = await pool.query(
      "SELECT to_regclass('public.sis_import_batches') AS table_name"
    );

    if (!tableCheck.rows[0]?.table_name) {
      return res.status(409).json({
        error:
          'SIS batch tracking requires migration 007 (sis_import_batches).',
      });
    }

    const result = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         u.full_name,
         u.email,
         d.department_name,
         sd.batch_year,
         sd.program_code,
         sd.tuition_base_amount
       FROM student_sis_data sd
       JOIN students s ON s.student_id = sd.student_id
       JOIN users u ON u.user_id = s.user_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       WHERE sd.batch_id = $1
       ORDER BY u.full_name ASC`,
      [batchId]
    );

    return res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error('SIS batch students error:', error);
    return res.status(500).json({ error: 'Failed to fetch SIS batch students.' });
  }
};
