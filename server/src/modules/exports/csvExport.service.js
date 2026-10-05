// HIPO 7.0 – Export PDF/CSV
// CSV exporter: turns any report ({ title, subtitle, columns, rows }) into CSV text.
// Excel-friendly: UTF-8 byte-order mark (so "ñ" shows correctly) and CRLF line endings.

// Wraps a value in quotes when needed and doubles any quotes inside it.
const csvValue = value => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const toCsv = report => {
  const header = report.columns.map(column => csvValue(column.label)).join(',')
  const lines = report.rows.map(row => report.columns.map(column => csvValue(row[column.key])).join(','))
  return '﻿' + [header, ...lines].join('\r\n') + '\r\n'
}

module.exports = { toCsv, csvValue }
