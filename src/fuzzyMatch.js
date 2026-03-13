/**
 * Fuzzy column name matching utility.
 * Two-tier: exact normalized match first, then Levenshtein (>70% similarity).
 */

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[_\-\s.]+/g, '')
    .trim()
}

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

function similarity(a, b) {
  const normA = normalize(a)
  const normB = normalize(b)
  if (normA === normB) return 1
  const maxLen = Math.max(normA.length, normB.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(normA, normB) / maxLen
}

/**
 * Given an array of source column names, cluster similar ones and
 * return a mapping: { sourceCol: bestTargetName }
 *
 * Strategy:
 * 1. Normalize all names and group exact matches
 * 2. For remaining ungrouped, use Levenshtein to find similar clusters
 * 3. Pick the shortest name in each cluster as the target name
 */
export function autoMatchColumns(sourceColumns) {
  const mappings = {}
  const normalizedGroups = {}

  // Phase 1: Group by exact normalized match
  sourceColumns.forEach((col) => {
    const norm = normalize(col)
    if (!normalizedGroups[norm]) {
      normalizedGroups[norm] = []
    }
    normalizedGroups[norm].push(col)
  })

  // For groups with multiple columns, pick the shortest as target
  Object.values(normalizedGroups).forEach((group) => {
    if (group.length > 1) {
      const target = group.reduce((best, col) =>
        col.length < best.length ? col : best
      )
      group.forEach((col) => {
        mappings[col] = target
      })
    }
  })

  // Phase 2: Fuzzy match ungrouped columns (>70% similarity)
  const unmapped = sourceColumns.filter((col) => !mappings[col])
  const assigned = new Set()

  for (let i = 0; i < unmapped.length; i++) {
    if (assigned.has(unmapped[i])) continue
    const cluster = [unmapped[i]]
    assigned.add(unmapped[i])

    for (let j = i + 1; j < unmapped.length; j++) {
      if (assigned.has(unmapped[j])) continue
      const sim = similarity(unmapped[i], unmapped[j])
      if (sim > 0.7) {
        cluster.push(unmapped[j])
        assigned.add(unmapped[j])
      }
    }

    if (cluster.length > 1) {
      const target = cluster.reduce((best, col) =>
        col.length < best.length ? col : best
      )
      cluster.forEach((col) => {
        mappings[col] = target
      })
    }
  }

  // Fill remaining unmapped columns with identity mapping
  sourceColumns.forEach((col) => {
    if (!mappings[col]) {
      mappings[col] = col
    }
  })

  return mappings
}
