/**
 * Seed-based pattern finder using profile extraction + scoring.
 *
 * Analyzes "known bad" seed rows to build a profile of shared traits,
 * then scores every other row by how many of those traits it matches.
 * More seeds = tighter profile = better results.
 */

// ============================================================
// HELPERS
// ============================================================

function parseDateTime(str) {
  if (!str) return null
  const cleaned = str.replace(/\s+(EST|CST|MST|PST|EDT|CDT|MDT|PDT|UTC|GMT)/i, '')
  const d = new Date(cleaned)
  if (isNaN(d.getTime())) return null
  return d
}

function getVal(row, col) {
  return (row[col] || '').toString().trim()
}

// Find substrings of length >= minLen shared by all strings in the array
function sharedSubstrings(strings, minLen = 3) {
  if (strings.length === 0) return []
  // Get all substrings from the shortest string
  const sorted = [...strings].sort((a, b) => a.length - b.length)
  const base = sorted[0]
  const rest = sorted.slice(1)
  const found = []

  for (let len = base.length; len >= minLen; len--) {
    for (let start = 0; start <= base.length - len; start++) {
      const sub = base.slice(start, start + len)
      if (rest.every((s) => s.includes(sub))) {
        // Check it's not a substring of an already-found longer match
        if (!found.some((f) => f.includes(sub))) {
          found.push(sub)
        }
      }
    }
  }
  return found
}

// ============================================================
// PROFILE EXTRACTION
// ============================================================

function buildProfile(seedRows, columns, columnTypes) {
  const profile = { rules: [], description: [] }

  columns.forEach((col) => {
    const type = columnTypes[col]
    if (type === 'source') return

    const values = seedRows.map((row) => getVal(row, col))
    const nonEmpty = values.filter((v) => v)
    const emptyCount = values.length - nonEmpty.length

    // --- Shared exact values ---
    if (nonEmpty.length > 0) {
      const counts = {}
      nonEmpty.forEach((v) => { counts[v.toLowerCase()] = (counts[v.toLowerCase()] || 0) + 1 })
      Object.entries(counts).forEach(([val, count]) => {
        // Value shared by majority of seeds
        if (count >= Math.ceil(seedRows.length * 0.5) && count >= 2) {
          profile.rules.push({ type: 'exactValue', col, value: val, weight: 3 })
          profile.description.push(`"${col}" = "${val}"`)
        }
      })
    }

    // --- Missing field pattern ---
    if (emptyCount >= Math.ceil(seedRows.length * 0.6)) {
      profile.rules.push({ type: 'isEmpty', col, weight: 1 })
      profile.description.push(`"${col}" is empty`)
    }

    // --- Email-specific patterns ---
    if (type === 'email' && nonEmpty.length > 0) {
      // Shared domain
      const domains = nonEmpty.map((v) => (v.split('@')[1] || '').toLowerCase()).filter(Boolean)
      const domainCounts = {}
      domains.forEach((d) => { domainCounts[d] = (domainCounts[d] || 0) + 1 })
      Object.entries(domainCounts).forEach(([domain, count]) => {
        if (count >= Math.ceil(seedRows.length * 0.5)) {
          profile.rules.push({ type: 'emailDomain', col, value: domain, weight: 2 })
          profile.description.push(`Email domain "${domain}"`)
        }
      })

      // Shared local part substrings
      const locals = nonEmpty.map((v) => (v.split('@')[0] || '').toLowerCase().replace(/\d+/g, ''))
      if (locals.length >= 2) {
        const shared = sharedSubstrings(locals, 3)
        shared.forEach((sub) => {
          profile.rules.push({ type: 'emailLocalSubstring', col, value: sub, weight: 3 })
          profile.description.push(`Email contains "${sub}"`)
        })
      }

      // Shared local part prefix (before digits)
      const prefixes = nonEmpty.map((v) => {
        const local = (v.split('@')[0] || '').toLowerCase()
        const m = local.match(/^([a-z]+)/)
        return m ? m[1] : ''
      }).filter(Boolean)
      if (prefixes.length >= 2) {
        const prefixCounts = {}
        prefixes.forEach((p) => { prefixCounts[p] = (prefixCounts[p] || 0) + 1 })
        Object.entries(prefixCounts).forEach(([prefix, count]) => {
          if (count >= Math.ceil(seedRows.length * 0.5) && prefix.length >= 3) {
            profile.rules.push({ type: 'emailLocalPrefix', col, value: prefix, weight: 3 })
            profile.description.push(`Email starts with "${prefix}"`)
          }
        })
      }
    }

    // --- Phone-specific patterns ---
    if (type === 'phone' && nonEmpty.length > 0) {
      const areaCodes = nonEmpty.map((v) => {
        const digits = v.replace(/\D/g, '')
        return digits.length >= 10 ? digits.slice(0, 3) : ''
      }).filter(Boolean)
      const acCounts = {}
      areaCodes.forEach((ac) => { acCounts[ac] = (acCounts[ac] || 0) + 1 })
      Object.entries(acCounts).forEach(([ac, count]) => {
        if (count >= Math.ceil(seedRows.length * 0.5) && count >= 2) {
          profile.rules.push({ type: 'phoneAreaCode', col, value: ac, weight: 2 })
          profile.description.push(`Phone area code "${ac}"`)
        }
      })
    }

    // --- Text/Name shared substrings ---
    if ((type === 'text' || type === 'name') && nonEmpty.length >= 2) {
      const lowers = nonEmpty.map((v) => v.toLowerCase())
      const shared = sharedSubstrings(lowers, 3)
      shared.forEach((sub) => {
        profile.rules.push({ type: 'textSubstring', col, value: sub, weight: 2 })
        profile.description.push(`"${col}" contains "${sub}"`)
      })
    }

    // --- Datetime proximity ---
    if (type === 'datetime' && nonEmpty.length >= 2) {
      const dates = nonEmpty.map(parseDateTime).filter(Boolean)
      if (dates.length >= 2) {
        const timestamps = dates.map((d) => d.getTime())
        const minTime = Math.min(...timestamps)
        const maxTime = Math.max(...timestamps)
        const range = maxTime - minTime
        // If seeds cluster within 24 hours, use time window matching
        if (range < 24 * 60 * 60 * 1000) {
          // Expand window by 50% on each side
          const padding = Math.max(range * 0.5, 30 * 60 * 1000) // at least 30 min
          profile.rules.push({
            type: 'timeWindow', col,
            minTime: minTime - padding,
            maxTime: maxTime + padding,
            weight: 2,
          })
          profile.description.push(`Signed up within tight time window`)
        }
      }
    }

    // --- Boolean value pattern ---
    if (type === 'boolean' && nonEmpty.length > 0) {
      const lower = nonEmpty.map((v) => v.toLowerCase())
      const allSame = lower.every((v) => v === lower[0])
      if (allSame) {
        profile.rules.push({ type: 'exactValue', col, value: lower[0], weight: 1 })
      }
    }
  })

  return profile
}

// ============================================================
// SCORING
// ============================================================

function scoreRow(row, profile, columnTypes) {
  let score = 0
  let maxScore = 0
  const matchedRules = []

  profile.rules.forEach((rule) => {
    maxScore += rule.weight
    const val = getVal(row, rule.col)

    switch (rule.type) {
      case 'exactValue':
        if (val.toLowerCase() === rule.value) {
          score += rule.weight
          matchedRules.push(rule)
        }
        break
      case 'isEmpty':
        if (!val) {
          score += rule.weight
          matchedRules.push(rule)
        }
        break
      case 'emailDomain': {
        const domain = (val.split('@')[1] || '').toLowerCase()
        if (domain === rule.value) {
          score += rule.weight
          matchedRules.push(rule)
        }
        break
      }
      case 'emailLocalSubstring':
      case 'emailLocalPrefix': {
        const local = (val.split('@')[0] || '').toLowerCase()
        if (rule.type === 'emailLocalPrefix' ? local.startsWith(rule.value) : local.includes(rule.value)) {
          score += rule.weight
          matchedRules.push(rule)
        }
        break
      }
      case 'phoneAreaCode': {
        const digits = val.replace(/\D/g, '')
        if (digits.length >= 10 && digits.slice(0, 3) === rule.value) {
          score += rule.weight
          matchedRules.push(rule)
        }
        break
      }
      case 'textSubstring':
        if (val.toLowerCase().includes(rule.value)) {
          score += rule.weight
          matchedRules.push(rule)
        }
        break
      case 'timeWindow': {
        const d = parseDateTime(val)
        if (d) {
          const t = d.getTime()
          if (t >= rule.minTime && t <= rule.maxTime) {
            score += rule.weight
            matchedRules.push(rule)
          }
        }
        break
      }
    }
  })

  const confidence = maxScore > 0 ? score / maxScore : 0
  return { score, confidence, matchedRules }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Find rows similar to the marked seeds using profile-based matching.
 *
 * @param {Object} data - { columns, rows }
 * @param {Object} columnTypes - from inferColumnTypes
 * @param {Set<number>} seedIndices - original row indices marked as "known bad"
 * @param {Set<number>} removedRows - rows already removed
 * @returns {{ results: Array<{rowIndex, confidence, reasons}>, profile: {description} }}
 */
export function findSimilarRows(data, columnTypes, seedIndices, removedRows) {
  const { columns, rows } = data
  if (seedIndices.size === 0) return { results: [], profile: { description: [] } }

  // Build seed profile
  const seedRowData = [...seedIndices].map((i) => rows[i])
  const profile = buildProfile(seedRowData, columns, columnTypes)

  if (profile.rules.length === 0) {
    return { results: [], profile }
  }

  // Score every non-seed, non-removed row
  const results = []
  // Require matching at least 40% of the profile weight, and at least 2 rules
  const minConfidence = 0.4
  const minRules = Math.min(2, profile.rules.length)

  rows.forEach((row, i) => {
    if (seedIndices.has(i) || removedRows.has(i)) return
    const { confidence, matchedRules } = scoreRow(row, profile, columnTypes)
    if (confidence >= minConfidence && matchedRules.length >= minRules) {
      const reasons = matchedRules.map((r) => {
        switch (r.type) {
          case 'exactValue': return `"${r.col}" matches seed value`
          case 'isEmpty': return `"${r.col}" is empty (like seeds)`
          case 'emailDomain': return `Same email domain: ${r.value}`
          case 'emailLocalSubstring': return `Email contains "${r.value}"`
          case 'emailLocalPrefix': return `Email starts with "${r.value}"`
          case 'phoneAreaCode': return `Same area code: ${r.value}`
          case 'textSubstring': return `"${r.col}" contains "${r.value}"`
          case 'timeWindow': return `Signed up in same time window`
          default: return `Matches seed pattern`
        }
      })
      results.push({ rowIndex: i, confidence, reasons })
    }
  })

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence)

  return { results, profile }
}
