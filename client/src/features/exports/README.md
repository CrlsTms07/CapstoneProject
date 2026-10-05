# HIPO 7.0 – Export PDF/CSV (client)

Exports of **approved** schedules are made on the server: every report on the Reports page
(`../reports/Reports.jsx`) links to `GET /api/reports/:type?...&format=csv` or `&format=pdf`.
The same report data feeds the on-screen preview, the CSV file and the PDF file
(`server/src/modules/exports/csvExport.service.js`, `pdfExport.service.js`).

The Schedule Plotter keeps its own CSV export and print-to-PDF (`../schedules/SchedulePlotter.jsx`)
for the class program that is still being edited (drafts, not yet approved).
