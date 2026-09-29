# Checklist PDF and evidence checks

This folder contains checks for the renderer-neutral report model and the BOQ
evidence catalog used by the active Checklist report.

The user-facing report is rendered by `PrintableReport` in `src/app/App.jsx`.
It consumes `buildReportTemplateModel()` from `src/domain/report-template.js`
and uses the selected inspection round's immutable Snapshot as its source.
When the user prints or saves as PDF, the browser print path produces the
report layout shown in the app; no standalone static PDF template is required.

Useful checks:

- `test_report_template_model.mjs` verifies the report model and Snapshot/history behavior.
- `test_evidence_catalog.mjs` verifies the 13 BOQ source PDFs and their evidence mapping.
