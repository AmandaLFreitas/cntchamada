# Architecture rules

- Reports and monthly status summaries share the paginated `useReportData` enrollment query and `report-status` grouping, so counts and lists use identical school-scoped classification and retain every enrollment per student.
- Completion planning exports reuse the Overview forecast source, fetch only authorized school-scoped records, and use ExcelJS with cached formulas and hidden counting helpers to preserve unique-person totals and native worksheet print/freeze settings.