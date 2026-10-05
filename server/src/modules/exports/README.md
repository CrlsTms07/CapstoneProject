# HIPO 7.0 – Export PDF/CSV (server)

**No server-side export yet.** Exports currently happen in the browser, only inside the JHS
Schedule Plotter (`client/src/features/schedules/SchedulePlotter.jsx`):

- **CSV** – `exportCsv()` builds a CSV of the class program being edited.
- **PDF** – "Export / Print PDF" calls `window.print()` with the print layout from `schedulePlotter.css`.

Still missing: exports for reports (HIPO 6.0), a teacher's personal schedule (HIPO 8.0) and the
public schedule view (HIPO 10.0). Server-side export endpoints go here as `exports.routes.js`,
`exports.controller.js`, `exports.service.js` and `exports.validation.js`.
