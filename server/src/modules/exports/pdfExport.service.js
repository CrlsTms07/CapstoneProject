// HIPO 7.0 – Export PDF/CSV
// PDF exporter: draws any report ({ title, subtitle, columns, rows }) as a simple table with
// pdfkit. Landscape letter paper; the header row repeats on every new page.
const PDFDocument = require('pdfkit')

const SCHOOL_NAME = 'Emmanuel Resurreccion Congressional Integrated High School'
const MARGIN = 40
const CELL_PADDING = 4
const FONT_SIZE = 9

// Resolves to a Buffer holding the finished PDF file.
const toPdf = report => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: MARGIN })
  const chunks = []
  doc.on('data', chunk => chunks.push(chunk))
  doc.on('end', () => resolve(Buffer.concat(chunks)))
  doc.on('error', reject)

  doc.font('Helvetica-Bold').fontSize(11).text(SCHOOL_NAME, { align: 'center' })
  doc.fontSize(14).text(report.title, { align: 'center' })
  doc.font('Helvetica').fontSize(10).text(report.subtitle || '', { align: 'center' })
  doc.moveDown()

  const columnWidth = (doc.page.width - MARGIN * 2) / report.columns.length
  const textWidth = columnWidth - CELL_PADDING * 2
  const pageBottom = doc.page.height - MARGIN

  // Draws one row of bordered cells, starting a new page (with the header row) when it would not fit.
  const drawRow = (values, isHeader) => {
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE)
    const texts = values.map(value => String(value ?? ''))
    const height = Math.max(...texts.map(text => doc.heightOfString(text, { width: textWidth }))) + CELL_PADDING * 2
    if (doc.y + height > pageBottom) {
      doc.addPage()
      if (!isHeader) drawRow(report.columns.map(column => column.label), true)
      doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE)
    }
    const top = doc.y
    texts.forEach((text, index) => {
      const left = MARGIN + index * columnWidth
      doc.rect(left, top, columnWidth, height).stroke('#999999')
      doc.fillColor('#000000').text(text, left + CELL_PADDING, top + CELL_PADDING, { width: textWidth })
    })
    doc.x = MARGIN
    doc.y = top + height
  }

  drawRow(report.columns.map(column => column.label), true)
  report.rows.forEach(row => drawRow(report.columns.map(column => row[column.key]), false))
  if (!report.rows.length) doc.moveDown().font('Helvetica-Oblique').fontSize(FONT_SIZE).text('No approved schedule entries.')

  doc.moveDown().font('Helvetica').fontSize(8).fillColor('#555555')
    .text(`Generated ${new Date().toLocaleString('en-PH')} · ERCIHS Class Scheduling System`)
  doc.end()
})

module.exports = { toPdf }
