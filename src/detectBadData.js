/**
 * Bad data / bot / fake account detection engine.
 *
 * Libraries used:
 *  - mailchecker: 55,000+ disposable email domains
 *  - libphonenumber-js: Google phone metadata for real validation
 *  - gibberish-detective: Markov chain gibberish detection
 *  - human-names: 7,000+ known first names (6 languages)
 */

// ============================================================
// LIBRARY IMPORTS
// ============================================================
import MailChecker from 'mailchecker'
import { isValidPhoneNumber, isPossiblePhoneNumber } from 'libphonenumber-js'
import GibberishDetective from 'gibberish-detective'

// ============================================================
// NAME DATA — import JSON directly from human-names (no CLI deps)
// ============================================================
import femaleNamesEn from 'human-names/data/female-human-names-en.json'
import maleNamesEn from 'human-names/data/male-human-names-en.json'
import femaleNamesDe from 'human-names/data/female-human-names-de.json'
import maleNamesDe from 'human-names/data/male-human-names-de.json'
import femaleNamesEs from 'human-names/data/female-human-names-es.json'
import maleNamesEs from 'human-names/data/male-human-names-es.json'
import femaleNamesFr from 'human-names/data/female-human-names-fr.json'
import maleNamesFr from 'human-names/data/male-human-names-fr.json'
import femaleNamesIt from 'human-names/data/female-human-names-it.json'
import maleNamesIt from 'human-names/data/male-human-names-it.json'
import femaleNamesNl from 'human-names/data/female-human-names-nl.json'
import maleNamesNl from 'human-names/data/male-human-names-nl.json'

const KNOWN_NAMES = new Set([
  ...femaleNamesEn, ...maleNamesEn,
  ...femaleNamesDe, ...maleNamesDe,
  ...femaleNamesEs, ...maleNamesEs,
  ...femaleNamesFr, ...maleNamesFr,
  ...femaleNamesIt, ...maleNamesIt,
  ...femaleNamesNl, ...maleNamesNl,
].map((n) => n.toLowerCase()))

// Initialize gibberish detector (Markov chain model)
const gibberishDetector = new GibberishDetective()

// ============================================================
// CONSTANTS
// ============================================================

const PLACEHOLDER_VALUES = new Set([
  'test', 'testing', 'tester', 'test user', 'test account',
  'asdf', 'asdfg', 'asdfgh', 'asdfghjkl', 'qwerty', 'qwer',
  'aaa', 'bbb', 'ccc', 'xxx', 'zzz', 'aaaa', 'zzzz',
  'fake', 'faker', 'fakeuser', 'fake user', 'fake name',
  'none', 'n/a', 'na', 'null', 'undefined', 'nil',
  'admin', 'administrator', 'root', 'user', 'guest',
  'john doe', 'jane doe', 'foo bar', 'foo', 'bar', 'baz',
  'sample', 'example', 'demo', 'dummy', 'placeholder',
  'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg',
  'first last', 'firstname lastname', 'first name', 'last name',
  'no name', 'noname', 'anonymous', 'anon',
  'delete', 'remove', 'deleted', 'removed',
  'spam', 'junk', 'trash', 'temp', 'tmp',
])

// ============================================================
// COLUMN TYPE INFERENCE
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s\-()+ .]{7,}$/

const BOOLEAN_VALUES = new Set([
  'true', 'false', 'yes', 'no', 'y', 'n',
  '1', '0', 'on', 'off', 'enabled', 'disabled',
  'active', 'inactive', 'opted-in', 'opted-out',
  'opt-in', 'opt-out', 'subscribed', 'unsubscribed',
])

const EMAIL_COL_HINTS = /email|e-mail|e_mail|correo/i
const PHONE_COL_HINTS = /phone|tel|mobile|cell|fax|sms/i
const NAME_COL_HINTS = /\bname\b|nombre|first|last|full.?name|user.?name/i
const URL_COL_HINTS = /\burl\b|website|site|link|homepage/i
const COMPANY_COL_HINTS = /company|org|business|employer|firm/i
const BOOLEAN_COL_HINTS = /opt.?in|opt.?out|subscribe|consent|active|enabled|disabled|boolean|flag|agreed|accept/i
const DATETIME_COL_HINTS = /date|created|signed.?up|timestamp|time|updated|modified|registered|joined|expire|birth/i
const DATETIME_VALUE_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/

export function inferColumnTypes(columns, rows) {
  const types = {}
  const sampleSize = Math.min(rows.length, 100)

  columns.forEach((col) => {
    if (col === 'Source') {
      types[col] = 'source'
      return
    }

    const colLower = col.toLowerCase()

    // Column name hints (highest priority)
    if (BOOLEAN_COL_HINTS.test(colLower)) { types[col] = 'boolean'; return }
    if (DATETIME_COL_HINTS.test(colLower)) { types[col] = 'datetime'; return }
    if (EMAIL_COL_HINTS.test(colLower)) { types[col] = 'email'; return }
    if (PHONE_COL_HINTS.test(colLower)) { types[col] = 'phone'; return }
    if (NAME_COL_HINTS.test(colLower)) { types[col] = 'name'; return }
    if (URL_COL_HINTS.test(colLower)) { types[col] = 'url'; return }
    if (COMPANY_COL_HINTS.test(colLower)) { types[col] = 'company'; return }

    // Infer from actual values
    let emailCount = 0
    let phoneCount = 0
    let boolCount = 0
    let datetimeCount = 0
    let nonEmpty = 0
    for (let i = 0; i < sampleSize; i++) {
      const val = (rows[i][col] || '').toString().trim()
      if (!val) continue
      nonEmpty++
      if (BOOLEAN_VALUES.has(val.toLowerCase())) boolCount++
      if (DATETIME_VALUE_RE.test(val)) datetimeCount++
      if (EMAIL_RE.test(val)) emailCount++
      if (PHONE_RE.test(val)) phoneCount++
    }

    if (nonEmpty > 0) {
      if (boolCount / nonEmpty > 0.8) { types[col] = 'boolean'; return }
      if (datetimeCount / nonEmpty > 0.5) { types[col] = 'datetime'; return }
      const threshold = nonEmpty * 0.4
      if (emailCount > threshold) { types[col] = 'email'; return }
      if (phoneCount > threshold) { types[col] = 'phone'; return }
    }

    // Low-cardinality check
    const uniqueValues = new Set()
    for (let i = 0; i < sampleSize; i++) {
      const val = (rows[i][col] || '').toString().trim().toLowerCase()
      if (val) uniqueValues.add(val)
    }
    if (nonEmpty > 10 && uniqueValues.size <= Math.max(5, nonEmpty * 0.05)) {
      types[col] = 'categorical'
      return
    }

    types[col] = 'text'
  })

  return types
}

// ============================================================
// KNOWN NAME HELPERS
// ============================================================

function isKnownName(value) {
  const lower = value.toLowerCase().trim()
  if (KNOWN_NAMES.has(lower)) return true
  const words = lower.split(/\s+/)
  return words.length > 1 && words.every((w) => w.length > 0 && KNOWN_NAMES.has(w))
}

// ============================================================
// PER-ROW DETECTORS
// ============================================================

// Custom internal/team domains that should be flagged as test accounts
const INTERNAL_DOMAINS = new Set(['sqwadhq.com', 'sqwadapp.co'])

// --- EMAIL: disposable domain check via mailchecker (55K+ domains) + internal domains ---
function checkDisposableEmail(value) {
  if (!value) return null
  const email = value.toString().trim()
  if (!EMAIL_RE.test(email)) return null
  const domain = email.split('@')[1].toLowerCase()
  if (INTERNAL_DOMAINS.has(domain)) {
    return { reason: `Internal/team email domain: ${domain}`, severity: 'high' }
  }
  if (!MailChecker.isValid(email)) {
    return { reason: `Disposable email domain: ${domain}`, severity: 'high' }
  }
  return null
}

// --- EMAIL: gibberish local part ---
// Only checks for obvious keyboard mash patterns (qwerty, asdf, etc.)
// Gibberish-detective has too many false positives on concatenated-name emails
// (e.g., "kblackwell", "aprilriley", "jugal.gajjar")
function checkEmailGibberish(value) {
  if (!value) return null
  const match = value.toString().trim().match(/^([^@]+)@/)
  if (!match) return null
  const local = match[1].toLowerCase()
  const alpha = local.replace(/[^a-z]/g, '')
  // Only flag if local part (without digits/symbols) is a known keyboard mash
  if (PLACEHOLDER_VALUES.has(alpha)) {
    return { reason: `Gibberish email local part: "${local}"`, severity: 'high' }
  }
  return null
}

// --- PHONE: validate via libphonenumber-js ---
function checkSuspiciousPhone(value) {
  if (!value) return null
  const str = value.toString().trim()
  const digits = str.replace(/\D/g, '')
  if (digits.length < 7) return null

  // All same digit (0000000, 1111111, etc.)
  if (/^(\d)\1+$/.test(digits)) {
    return { reason: `All same digit: "${str}"`, severity: 'high' }
  }

  // Long sequential runs
  if (/1234567|2345678|3456789|9876543|8765432|7654321/.test(digits)) {
    return { reason: `Sequential digits: "${str}"`, severity: 'high' }
  }

  // Mostly the same digit (>70%)
  const counts = {}
  for (const d of digits) counts[d] = (counts[d] || 0) + 1
  const maxCount = Math.max(...Object.values(counts))
  if (maxCount / digits.length > 0.7 && digits.length >= 7) {
    return { reason: `Mostly repeated digit: "${str}"`, severity: 'medium' }
  }

  // libphonenumber-js: check if the number is valid for US (most common)
  // Try with and without country code
  const tryCountries = ['US', undefined]
  let isValid = false
  let isPossible = false
  for (const cc of tryCountries) {
    try {
      if (isValidPhoneNumber(str, cc)) { isValid = true; break }
      if (isPossiblePhoneNumber(str, cc)) { isPossible = true }
    } catch {
      // Skip invalid formats
    }
  }

  // Only flag if not even possible — "valid but not possible" is too strict for raw digit input
  if (!isValid && !isPossible && digits.length >= 10) {
    return { reason: `Invalid phone number format: "${str}"`, severity: 'medium' }
  }

  return null
}

function containsKnownName(str) {
  for (let len = 3; len <= Math.min(str.length, 12); len++) {
    for (let start = 0; start <= str.length - len; start++) {
      if (KNOWN_NAMES.has(str.slice(start, start + len))) return true
    }
  }
  return false
}

// --- TEXT: gibberish detection (Markov chain + known names whitelist) ---
function checkGibberishText(value, colType, colName) {
  if (!value) return null
  const str = value.toString().trim()
  if (str.length < 3) return null

  // Skip gibberish check on last-name columns — surnames are too diverse for detection
  const isLastName = /last/i.test(colName)
  if (isLastName) return null

  // Skip if it's a known human name
  if (isKnownName(str)) return null

  // For name columns, also check if it contains a known name substring
  if (colType === 'name' && str.length >= 3 && containsKnownName(str.toLowerCase())) return null

  // For multi-word strings or longer text, use gibberish-detective (Markov chain)
  if (str.length >= 8) {
    if (gibberishDetector.detect(str)) {
      // Lower severity for name columns — diverse names are common
      const sev = colType === 'name' ? 'low' : 'high'
      return { reason: `Gibberish text detected: "${str}"`, severity: sev }
    }
  }

  // Repeating characters (aaaa, xxxx, etc.)
  if (hasRepeatingChars(str, 4)) {
    return { reason: `Repeating characters: "${str}"`, severity: 'medium' }
  }

  return null
}

function hasRepeatingChars(str, minRepeat = 4) {
  const lower = str.toLowerCase()
  for (let i = 0; i <= lower.length - minRepeat; i++) {
    if (lower.slice(i, i + minRepeat).split('').every((c) => c === lower[i])) return true
  }
  return false
}

// --- TEXT: placeholder / test value detection ---
function checkPlaceholderValue(value, colType) {
  if (!value) return null
  const str = value.toString().trim()
  const lower = str.toLowerCase()
  if (lower.length === 0) return null

  if (PLACEHOLDER_VALUES.has(lower)) {
    return { reason: `Placeholder / test value: "${str}"`, severity: 'high' }
  }

  if (/^test\d/i.test(lower)) {
    return { reason: `Test pattern: "${str}"`, severity: 'high' }
  }

  if (/^user\d/i.test(lower)) {
    return { reason: `Generic user pattern: "${str}"`, severity: 'medium' }
  }

  // Single character — only flag for non-name columns (initials are common in names)
  if (str.length === 1 && /[a-z]/i.test(str) && colType !== 'name') {
    return { reason: `Single character value: "${str}"`, severity: 'medium' }
  }

  return null
}

// ============================================================
// CROSS-ROW DETECTORS
// ============================================================

function analyzeFrequencies(colName, rows) {
  const flags = []
  const counts = {}

  rows.forEach((row, i) => {
    const val = (row[colName] || '').toString().trim().toLowerCase()
    if (!val) return
    if (!counts[val]) counts[val] = []
    counts[val].push(i)
  })

  const skipValues = new Set(['', 'n/a', 'na', '-', 'none', 'null', 'undefined'])

  const uniqueCount = Object.keys(counts).length
  const nonEmptyCount = rows.filter((r) => {
    const v = (r[colName] || '').toString().trim()
    return v && !skipValues.has(v.toLowerCase())
  }).length
  if (uniqueCount <= Math.max(5, Math.ceil(nonEmptyCount * 0.03))) return flags

  const threshold = Math.max(4, Math.ceil(rows.length * 0.02))

  Object.entries(counts).forEach(([val, indices]) => {
    if (skipValues.has(val)) return
    if (indices.length >= threshold) {
      const sev = indices.length > threshold * 3 ? 'high' : 'medium'
      indices.forEach((i) => {
        flags.push({
          rowIndex: i,
          column: colName,
          rule: 'frequencyAnomaly',
          reason: `"${val}" appears ${indices.length} times in "${colName}"`,
          severity: sev,
        })
      })
    }
  })

  return flags
}

function isYearLike(val) {
  const n = parseInt(val, 10)
  return /^\d{4}$/.test(val) && n >= 1900 && n <= 2099
}

function detectSequentialPatterns(colName, rows) {
  const flags = []

  const prefixGroups = {}
  rows.forEach((row, index) => {
    const val = (row[colName] || '').toString().trim()
    if (!val) return
    if (isYearLike(val)) return
    const match = val.match(/^(.+?)(\d+)$/)
    if (!match) return
    const prefix = match[1].toLowerCase()
    if (!prefix) return
    if (!prefixGroups[prefix]) prefixGroups[prefix] = []
    prefixGroups[prefix].push({ index, num: parseInt(match[2], 10) })
  })

  Object.entries(prefixGroups).forEach(([prefix, entries]) => {
    if (entries.length < 3) return

    const nums = entries.map((e) => e.num).sort((a, b) => a - b)
    let sequentialCount = 0
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] <= 2) sequentialCount++
    }

    if (sequentialCount / (nums.length - 1) > 0.5 && entries.length >= 3) {
      const sev = entries.length > 5 ? 'high' : 'medium'
      entries.forEach(({ index }) => {
        flags.push({
          rowIndex: index,
          column: colName,
          rule: 'sequentialPattern',
          reason: `Sequential pattern "${prefix}N" (${entries.length} entries in "${colName}")`,
          severity: sev,
        })
      })
    }
  })

  return flags
}

// ============================================================
// PUBLIC API
// ============================================================

export const RULE_LABELS = {
  disposableEmail: 'Disposable email domains',
  keyboardMash: 'Keyboard mash / gibberish',
  fakePlaceholder: 'Fake / test placeholder values',
  suspiciousPhone: 'Suspicious phone numbers',
  frequencyAnomaly: 'Unusual value frequency',
  sequentialPattern: 'Sequential patterns (test1, test2 ...)',
}

export function detectBadData(data) {
  const { columns, rows } = data
  const columnTypes = inferColumnTypes(columns, rows)
  const allFlags = []

  // ---- Per-row, per-column analysis ----
  rows.forEach((row, rowIndex) => {
    columns.forEach((col) => {
      const type = columnTypes[col]
      if (type === 'source' || type === 'boolean' || type === 'categorical' || type === 'datetime') return
      const value = (row[col] || '').toString().trim()
      if (!value) return

      // Email detectors
      if (type === 'email') {
        const d = checkDisposableEmail(value)
        if (d) allFlags.push({ rowIndex, column: col, rule: 'disposableEmail', ...d })
        const m = checkEmailGibberish(value)
        if (m) allFlags.push({ rowIndex, column: col, rule: 'keyboardMash', ...m })
      }

      // Phone detectors
      if (type === 'phone') {
        const p = checkSuspiciousPhone(value)
        if (p) allFlags.push({ rowIndex, column: col, rule: 'suspiciousPhone', ...p })
      }

      // Name / text / company detectors
      if (type === 'name' || type === 'text' || type === 'company') {
        const g = checkGibberishText(value, type, col)
        if (g) allFlags.push({ rowIndex, column: col, rule: 'keyboardMash', ...g })
        const pl = checkPlaceholderValue(value, type)
        if (pl) allFlags.push({ rowIndex, column: col, rule: 'fakePlaceholder', ...pl })
      }
    })
  })

  // ---- Cross-row analysis (only on name/email/phone — not generic text) ----
  columns.forEach((col) => {
    const type = columnTypes[col]
    if (type === 'source' || type === 'boolean' || type === 'categorical' || type === 'datetime') return
    if (type === 'text' || type === 'company') return
    allFlags.push(...analyzeFrequencies(col, rows))
    allFlags.push(...detectSequentialPatterns(col, rows))
  })

  return { columnTypes, flags: allFlags }
}

export function aggregateByRow(flags, enabledRules) {
  const rowMap = new Map()

  flags.forEach((flag) => {
    if (!enabledRules[flag.rule]) return

    if (!rowMap.has(flag.rowIndex)) {
      rowMap.set(flag.rowIndex, { flags: [], severity: 'low' })
    }
    const entry = rowMap.get(flag.rowIndex)
    entry.flags.push(flag)

    if (flag.severity === 'high') entry.severity = 'high'
    else if (flag.severity === 'medium' && entry.severity !== 'high') entry.severity = 'medium'
  })

  return rowMap
}
