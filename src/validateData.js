/**
 * Per-column validation stats for merged data.
 */

function isNumericValue(val) {
  if (!val || val.toString().trim() === '') return false
  return !isNaN(Number(val.toString().replace(/[,$%]/g, '')))
}

function isDateLike(val) {
  if (!val || val.toString().trim() === '') return false
  const s = val.toString().trim()
  return /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/.test(s)
}

export function validateColumns(data) {
  const { columns, rows } = data
  const warnings = []

  columns.forEach((col) => {
    if (col === 'Source') return

    const values = rows.map((r) => r[col])
    const total = values.length
    const empty = values.filter((v) => !v || v.toString().trim() === '').length
    const nonEmpty = values.filter((v) => v && v.toString().trim() !== '')

    const emptyPct = total > 0 ? (empty / total) * 100 : 0

    // Warning: high empty rate
    if (emptyPct > 30) {
      warnings.push({
        column: col,
        type: 'empty',
        message: `${empty} of ${total} values are empty (${emptyPct.toFixed(0)}%)`,
        severity: emptyPct > 70 ? 'high' : 'medium',
      })
    }

    // Type consistency check
    if (nonEmpty.length > 0) {
      const numericCount = nonEmpty.filter((v) => isNumericValue(v)).length
      const numericPct = numericCount / nonEmpty.length

      if (numericPct > 0.1 && numericPct < 0.9) {
        warnings.push({
          column: col,
          type: 'mixed-types',
          message: `Mixed types: ${numericCount} numeric, ${nonEmpty.length - numericCount} text values`,
          severity: 'medium',
        })
      }
    }

    // Check for inconsistent date formats
    if (nonEmpty.length > 0) {
      const dateCount = nonEmpty.filter((v) => isDateLike(v)).length
      const datePct = dateCount / nonEmpty.length
      if (datePct > 0.1 && datePct < 0.9) {
        warnings.push({
          column: col,
          type: 'mixed-formats',
          message: `Possible date format inconsistency: ${dateCount} date-like, ${nonEmpty.length - dateCount} other values`,
          severity: 'low',
        })
      }
    }
  })

  return warnings
}
