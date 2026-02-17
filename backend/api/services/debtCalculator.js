const RATES = require('../config/ethiopianCostSharing');

const semesterMap = (startYear, semesters) => {
  const terms = [];
  let year = startYear;
  let isFall = true;
  for (let i = 0; i < semesters; i += 1) {
    const term = isFall ? 'FALL' : 'SPRING';
    terms.push({
      semester: `${year}-${term}`,
      academicYear: `${year}/${year + 1}`,
    });
    if (!isFall) {
      year += 1;
    }
    isFall = !isFall;
  }
  return terms;
};

const calculateSemesterComponents = ({
  studentId,
  semesters,
  startYear,
  tuitionBaseAnnual,
  livingStipendChoice,
}) => {
  const terms = semesterMap(startYear, semesters);
  const tuitionPerSemester =
    (tuitionBaseAnnual * RATES.TUITION_SHARE.PERCENTAGE) / 2;
  const livingPerSemester = livingStipendChoice
    ? RATES.LIVING_STIPEND.MONTHLY_AMOUNT * RATES.LIVING_STIPEND.MONTHS_PER_SEMESTER
    : 0;
  const medicalPerSemester = RATES.MEDICAL.YEARLY_AMOUNT / 2;

  return terms.flatMap((term) => {
    const dueDate = new Date();
    const [year] = term.academicYear.split('/');
    dueDate.setFullYear(Number(year));
    dueDate.setMonth(term.semester.includes('FALL') ? 9 : 2, 15);

    return [
      {
        studentId,
        semester: term.semester,
        academicYear: term.academicYear,
        componentType: 'LIVING_STIPEND',
        amount: livingPerSemester,
        description: 'Living stipend (food & accommodation)',
        dueDate,
      },
      {
        studentId,
        semester: term.semester,
        academicYear: term.academicYear,
        componentType: 'TUITION',
        amount: tuitionPerSemester,
        description: 'Tuition cost sharing (15%)',
        dueDate,
      },
      {
        studentId,
        semester: term.semester,
        academicYear: term.academicYear,
        componentType: 'MEDICAL',
        amount: medicalPerSemester,
        description: 'Medical cost sharing',
        dueDate,
      },
    ].filter((c) => c.amount > 0);
  });
};

module.exports = { calculateSemesterComponents };
