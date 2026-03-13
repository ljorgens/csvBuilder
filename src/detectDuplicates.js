/**
 * Detect duplicate rows based on user-selected key columns.
 */

export function detectDuplicates(rows, keyColumns) {
  if (!keyColumns || keyColumns.length === 0) return []

  const seen = new Map()
  const duplicateIndices = new Set()

  rows.forEach((row, index) => {
    const key = keyColumns.map((col) => (row[col] || '').toString().trim()).join('|||')

    if (seen.has(key)) {
      duplicateIndices.add(seen.get(key))
      duplicateIndices.add(index)
    } else {
      seen.set(key, index)
    }
  })

  return Array.from(duplicateIndices).sort((a, b) => a - b)
}
