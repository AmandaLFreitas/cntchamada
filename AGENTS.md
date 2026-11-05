# Architecture rules

- Attendance stores an immutable enrollment reference and captured slot duration; shared helpers count hours from the enrollment date. Legacy attribution is allowed once only when dates, school and student prove a unique enrollment; current schedules never establish historical ownership, preventing history leakage.

- Reports and monthly status summaries share the paginated `useReportData` enrollment query and `report-status` grouping, so counts and lists use identical school-scoped classification and retain every enrollment per student.
- Completion planning exports reuse the Overview forecast source, fetch only authorized school-scoped records, and use ExcelJS with cached formulas and hidden counting helpers to preserve unique-person totals and native worksheet print/freeze settings.