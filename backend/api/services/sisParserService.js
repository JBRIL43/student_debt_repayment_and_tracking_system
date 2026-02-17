const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const csvParser = require('csv-parser');

const normalizeHeader = (header) =>
  (header || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const parseNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  const cleaned = value.toString().replace(/,/g, '').trim();
  if (!cleaned) {
    return 0;
  }
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseBoolean = (value, defaultValue = true) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = value.toString().trim().toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(normalized)) {
    return true;
  }
  if (['no', 'false', '0', 'n'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const parseText = (value) => (value ? value.toString().trim() : '');

const mapRow = (row, index) => {
  const errors = [];

  const studentNumber = parseText(
    row.student_number || row.studentid || row.student_id || row.sis_student_id
  );
  const fullName = parseText(row.full_name || row.name || row.student_name);
  const email = parseText(row.email || row.email_address || row.student_email);
  const phone = parseText(row.phone || row.phone_number || row.mobile);
  const departmentName = parseText(
    row.department || row.department_name || row.dept
  );
  const faculty = parseText(row.faculty || row.college || row.school);
  const batchYear = parseNumber(row.batch_year || row.batch || row.cohort_year);
  const semesters = Math.max(
    0,
    parseNumber(row.semesters || row.total_semesters || row.semester_count)
  );
  const programCode = parseText(row.program_code || row.program);
  const startYear = Math.max(0, parseNumber(row.start_year || row.startyear));
  const livingStipendChoice = parseBoolean(
    row.living_stipend_choice || row.living_stipend || row.receive_stipend,
    true
  );
  const tuitionBaseAmount = parseNumber(
    row.tuition_base_amount || row.tuition_base_annual || row.tuition_base
  );

  const totalTuition = parseNumber(row.total_tuition || row.tuition_total);
  const totalLiving = parseNumber(row.total_living || row.living_total);
  const totalMedical = parseNumber(row.total_medical || row.medical_total);
  const totalOther = parseNumber(row.total_other || row.other_total);

  if (!studentNumber) {
    errors.push('Missing student number.');
  }
  if (!fullName) {
    errors.push('Missing full name.');
  }
  if (!departmentName) {
    errors.push('Missing department.');
  }
  if (!semesters) {
    errors.push('Semesters is required.');
  }

  return {
    rowNumber: index,
    errors,
    data: {
      studentNumber,
      fullName,
      email,
      phone,
      departmentName,
      faculty,
      batchYear: batchYear || null,
      semesters,
      programCode: programCode || null,
      startYear: startYear || null,
      livingStipendChoice,
      tuitionBaseAmount: tuitionBaseAmount || null,
      totals: {
        tuition: totalTuition,
        living: totalLiving,
        medical: totalMedical,
        other: totalOther,
      },
    },
  };
};

const parseCsvFile = (filePath) =>
  new Promise((resolve, reject) => {
    const rows = [];
    let index = 1;
    fs.createReadStream(filePath)
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => normalizeHeader(header),
          skipLines: 0,
          strict: false,
        })
      )
      .on('data', (row) => {
        rows.push(mapRow(row, index));
        index += 1;
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

const parseExcelFile = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  return json.map((row, idx) => {
    const normalizedRow = {};
    Object.keys(row).forEach((key) => {
      normalizedRow[normalizeHeader(key)] = row[key];
    });
    return mapRow(normalizedRow, idx + 1);
  });
};

const buildSummary = (parsedRows) => {
  const summary = {
    totalStudents: 0,
    totalDebt: 0,
    totalTuition: 0,
    totalLiving: 0,
    totalMedical: 0,
    totalOther: 0,
    errors: [],
  };

  parsedRows.forEach((row) => {
    if (row.errors.length) {
      summary.errors.push({ row: row.rowNumber, messages: row.errors });
      return;
    }

    summary.totalStudents += 1;
    summary.totalTuition += row.data.totals.tuition;
    summary.totalLiving += row.data.totals.living;
    summary.totalMedical += row.data.totals.medical;
    summary.totalOther += row.data.totals.other;
  });

  summary.totalDebt =
    summary.totalTuition +
    summary.totalLiving +
    summary.totalMedical +
    summary.totalOther;

  return summary;
};

const parseSISFile = async (filePath, originalName) => {
  const ext = path.extname(originalName || filePath).toLowerCase();
  let parsedRows = [];

  if (ext === '.csv') {
    parsedRows = await parseCsvFile(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    parsedRows = parseExcelFile(filePath);
  } else {
    throw new Error('Unsupported file type. Use CSV or Excel.');
  }

  const summary = buildSummary(parsedRows);
  const previewRows = parsedRows
    .filter((row) => row.errors.length === 0)
    .slice(0, 10)
    .map((row) => row.data);

  return {
    summary,
    previewRows,
    parsedRows,
  };
};

module.exports = {
  parseSISFile,
};
