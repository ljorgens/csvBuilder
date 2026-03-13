/**
 * Auto-detect which row in a CSV is the real header row.
 *
 * Strategy:
 *  1. Parse the file without headers (raw 2D array).
 *  2. For each candidate row in the first 20 rows, score it:
 *     - Header rows tend to have mostly non-empty, unique, text-only values.
 *     - Data rows beneath a real header are consistent: similar fill rates,
 *       columns that look numeric stay numeric, etc.
 *  3. Pick the highest-scoring candidate.
 */

const METADATA_PATTERNS =
  /^(report|generated|exported|printed|date|prepared|run |page |total|source:|file:|note:|#|\/\/)/i

function isNumeric(val) {
  if (!val) return false
  return !isNaN(Number(val.toString().replace(/[,$%]/g, '')))
}

function isBlankish(val) {
  return val === undefined || val === null || val.toString().trim() === ''
}

/**
 * Score a candidate header row. Higher = more likely to be the real header.
 */
function scoreCandidate(rows, candidateIndex) {
  const candidate = rows[candidateIndex]
  if (!candidate) return -Infinity

  const colCount = candidate.length
  const dataRows = rows.slice(candidateIndex + 1, candidateIndex + 21)

  if (dataRows.length === 0) return -Infinity

  let score = 0

  // 1. Header cells should mostly be non-empty strings (not numbers)
  const filledCells = candidate.filter((c) => !isBlankish(c))
  const fillRatio = filledCells.length / Math.max(colCount, 1)
  score += fillRatio * 30

  // Penalize if most header cells are numeric (headers are usually text)
  const numericHeaderCells = filledCells.filter((c) => isNumeric(c))
  if (filledCells.length > 0) {
    score -= (numericHeaderCells.length / filledCells.length) * 25
  }

  // 2. Header cells should be unique
  const uniqueCells = new Set(filledCells.map((c) => c.toString().toLowerCase().trim()))
  if (filledCells.length > 0) {
    score += (uniqueCells.size / filledCells.length) * 15
  }

  // 3. Penalize metadata-looking rows
  const firstCell = (candidate[0] || '').toString().trim()
  if (METADATA_PATTERNS.test(firstCell)) {
    score -= 20
  }

  // 4. Penalize rows where most cells are empty (sparse metadata)
  if (fillRatio < 0.4) {
    score -= 15
  }

  // 5. Data consistency below the candidate: columns should have consistent types
  let consistencyScore = 0
  for (let col = 0; col < colCount; col++) {
    const colValues = dataRows
      .map((r) => r[col])
      .filter((v) => !isBlankish(v))

    if (colValues.length === 0) continue

    const numericCount = colValues.filter((v) => isNumeric(v)).length
    const ratio = numericCount / colValues.length
    // Columns are consistent if they're mostly numeric or mostly text
    consistencyScore += Math.max(ratio, 1 - ratio)
  }
  if (colCount > 0) {
    score += (consistencyScore / colCount) * 20
  }

  // 6. Data rows should have a similar column count to the header
  const avgDataCols =
    dataRows.reduce((sum, r) => sum + r.length, 0) / dataRows.length
  if (Math.abs(avgDataCols - colCount) < 1.5) {
    score += 10
  }

  return score
}

/**
 * Given raw parsed rows (2D array), return the index of the detected header row.
 */
export function detectHeaderRow(rows) {
  if (!rows || rows.length === 0) return 0

  // Only check the first 20 rows as candidates
  const maxCandidates = Math.min(rows.length - 1, 20)
  let bestIndex = 0
  let bestScore = -Infinity

  for (let i = 0; i < maxCandidates; i++) {
    const s = scoreCandidate(rows, i)
    if (s > bestScore) {
      bestScore = s
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Given raw rows and a header index, return { headers, data }.
 */
export function extractWithHeader(rows, headerIndex) {
  const headerRow = rows[headerIndex] || []
  const headers = headerRow.map((h, i) =>
    isBlankish(h) ? `Column_${i + 1}` : h.toString().trim()
  )

  const dataRows = rows.slice(headerIndex + 1)
    .filter((row) => row.some((cell) => !isBlankish(cell)))
    .map((row) => {
      const obj = {}
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : ''
      })
      return obj
    })

  return { headers, data: dataRows }
}
