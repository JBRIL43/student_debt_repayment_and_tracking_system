DO $$
DECLARE
  sid INTEGER;
BEGIN
  SELECT student_id INTO sid FROM students WHERE student_number = 'NaScR/0784/15';
  IF sid IS NULL THEN
    RAISE EXCEPTION 'Student with student_number=NaScR/0784/15 not found';
  END IF;

  INSERT INTO debt_components (student_id, semester, academic_year, component_type, amount, description, due_date, status) VALUES
    (sid, '2022-FALL', '2022/2023', 'TUITION', 1250.00, '15% tuition share - Year 1 Fall', '2023-01-31', 'UNPAID'),
    (sid, '2022-FALL', '2022/2023', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2023-01-31', 'UNPAID'),

    (sid, '2023-SPRING', '2022/2023', 'TUITION', 1250.00, '15% tuition share - Year 1 Spring', '2023-06-30', 'UNPAID'),
    (sid, '2023-SPRING', '2022/2023', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2023-06-30', 'UNPAID'),

    (sid, '2023-FALL', '2023/2024', 'TUITION', 1500.00, '15% tuition share - Year 2 Fall', '2024-01-31', 'UNPAID'),
    (sid, '2023-FALL', '2023/2024', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2024-01-31', 'UNPAID'),

    (sid, '2024-SPRING', '2023/2024', 'TUITION', 1500.00, '15% tuition share - Year 2 Spring', '2024-06-30', 'UNPAID'),
    (sid, '2024-SPRING', '2023/2024', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2024-06-30', 'UNPAID'),

    (sid, '2024-FALL', '2024/2025', 'TUITION', 1750.00, '15% tuition share - Year 3 Fall', '2025-01-31', 'UNPAID'),
    (sid, '2024-FALL', '2024/2025', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2025-01-31', 'UNPAID'),

    (sid, '2025-SPRING', '2024/2025', 'TUITION', 1750.00, '15% tuition share - Year 3 Spring', '2025-06-30', 'UNPAID'),
    (sid, '2025-SPRING', '2024/2025', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2025-06-30', 'UNPAID'),

    (sid, '2025-FALL', '2025/2026', 'TUITION', 2000.00, '15% tuition share - Year 4 Fall', '2026-01-31', 'UNPAID'),
    (sid, '2025-FALL', '2025/2026', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2026-01-31', 'UNPAID'),

    (sid, '2026-SPRING', '2025/2026', 'TUITION', 2000.00, '15% tuition share - Year 4 Spring', '2026-06-30', 'UNPAID'),
    (sid, '2026-SPRING', '2025/2026', 'LIVING_STIPEND', 15000.00, '3,000 Birr × 5 months cash stipend', '2026-06-30', 'UNPAID');
END $$;
