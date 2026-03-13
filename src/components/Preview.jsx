import { useState, useMemo, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import { validateColumns } from '../validateData.js'
import { detectDuplicates } from '../detectDuplicates.js'
import { detectBadData, aggregateByRow, RULE_LABELS, inferColumnTypes } from '../detectBadData.js'
import { findSimilarRows } from '../patternFinder.js'
import ValidationPanel from './ValidationPanel.jsx'
import BadDataPanel from './BadDataPanel.jsx'
import LoadingOverlay from './LoadingOverlay.jsx'
import './Preview.css'

function Preview({ data, onDownload, onBack, onReset }) {
  const [selectedKeyColumns, setSelectedKeyColumns] = useState([])
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [keepEmptyColumns, setKeepEmptyColumns] = useState(false)

  // Bad data detection state
  const [badDataResults, setBadDataResults] = useState(null)
  const [enabledRules, setEnabledRules] = useState(
    Object.fromEntries(Object.keys(RULE_LABELS).map((r) => [r, true]))
  )
  const [removedRows, setRemovedRows] = useState(new Set())
  const [removedByBadData, setRemovedByBadData] = useState(new Set())
  const [removedByDuplicates, setRemovedByDuplicates] = useState(new Set())
  const [dismissedRows, setDismissedRows] = useState(new Set())
  const [detecting, setDetecting] = useState(false)
  const [seedRows, setSeedRows] = useState(new Set())
  const [similarRows, setSimilarRows] = useState(null) // null = not run, [] = no results
  const [patternProfile, setPatternProfile] = useState(null)
  const [findingSimilar, setFindingSimilar] = useState(false)
  const [showSimilarOnly, setShowSimilarOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredRow, setHoveredRow] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [visibleCount, setVisibleCount] = useState(100)
  const tableWrapperRef = useRef(null)

  const handleTableScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setVisibleCount((prev) => prev + 100)
    }
  }, [])

  const jumpToRow = useCallback((originalIndex) => {
    // Clear search so the row is visible, expand visible count if needed
    setSearchQuery('')
    // Find position among active rows
    const pos = data.rows.reduce((count, _, i) => {
      if (i < originalIndex && !removedRows.has(i)) return count + 1
      return count
    }, 0)
    // Ensure enough rows are rendered
    setVisibleCount((prev) => Math.max(prev, pos + 50))
    // Scroll to the row after state settles
    requestAnimationFrame(() => {
      const wrapper = tableWrapperRef.current
      if (!wrapper) return
      const rows = wrapper.querySelectorAll('tbody tr')
      if (rows[pos]) {
        rows[pos].scrollIntoView({ behavior: 'smooth', block: 'center' })
        rows[pos].classList.add('highlight-flash')
        setTimeout(() => rows[pos].classList.remove('highlight-flash'), 1500)
      }
    })
  }, [data, removedRows])

  const warnings = useMemo(() => {
    if (!data) return []
    return validateColumns(data)
  }, [data])

  const duplicateIndices = useMemo(() => {
    if (!showDuplicates || selectedKeyColumns.length === 0) return new Set()
    return new Set(detectDuplicates(data.rows, selectedKeyColumns))
  }, [data, selectedKeyColumns, showDuplicates])

  // Detect totally empty columns
  const emptyColumns = useMemo(() => {
    if (!data) return new Set()
    const empty = new Set()
    for (const col of data.columns) {
      if (col === 'Source') continue
      const allEmpty = data.rows.every((row) => {
        const val = row[col]
        return !val || val.toString().trim() === ''
      })
      if (allEmpty) empty.add(col)
    }
    return empty
  }, [data])

  // Bad data: aggregate flags by row, filtered by enabled rules and dismissals
  const flaggedRows = useMemo(() => {
    if (!badDataResults) return new Map()
    const allFlagged = aggregateByRow(badDataResults.flags, enabledRules)
    dismissedRows.forEach((i) => allFlagged.delete(i))
    return allFlagged
  }, [badDataResults, enabledRules, dismissedRows])

  if (!data) return null

  // Filter out empty columns unless checkbox is checked
  const visibleColumns = keepEmptyColumns
    ? data.columns
    : data.columns.filter((col) => !emptyColumns.has(col))

  // Active rows = original minus removed
  const activeRowEntries = data.rows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .filter(({ originalIndex }) => !removedRows.has(originalIndex))

  // Source breakdown
  const sourceCounts = {}
  activeRowEntries.forEach(({ row }) => {
    const src = row['Source'] || 'Unknown'
    sourceCounts[src] = (sourceCounts[src] || 0) + 1
  })
  const sourceNames = Object.keys(sourceCounts)

  const similarRowSet = useMemo(() => {
    if (!similarRows) return new Set()
    return new Set(similarRows.map((r) => r.rowIndex))
  }, [similarRows])

  // Filter: show only seeds + similar when active
  const similarFilteredEntries = showSimilarOnly && similarRows
    ? activeRowEntries.filter(({ originalIndex }) =>
        seedRows.has(originalIndex) || similarRowSet.has(originalIndex)
      )
    : activeRowEntries

  // Search filter — supports "#123" to jump to row number
  const rowNumMatch = searchQuery.match(/^#(\d+)$/)
  const searchFilteredEntries = searchQuery
    ? rowNumMatch
      ? similarFilteredEntries.filter(({ originalIndex }) => originalIndex === parseInt(rowNumMatch[1], 10) - 1)
      : similarFilteredEntries.filter(({ row }) =>
          visibleColumns.some((col) => {
            const val = row[col]
            return val && val.toString().toLowerCase().includes(searchQuery.toLowerCase())
          })
        )
    : similarFilteredEntries

  const displayEntries = searchFilteredEntries.slice(0, visibleCount)
  const hasMore = searchFilteredEntries.length > visibleCount
  const nonSourceColumns = data.columns.filter((c) => c !== 'Source')

  const toggleKeyColumn = (col) => {
    setSelectedKeyColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    )
  }

  const totalDuplicates = duplicateIndices.size

  const handleDetectBadData = () => {
    setDetecting(true)
    requestAnimationFrame(() => {
      setBadDataResults(detectBadData(data))
      setDetecting(false)
    })
  }

  const handleReanalyze = () => {
    setDetecting(true)
    requestAnimationFrame(() => {
      // Build dataset from only active rows, mapping indices back to originals
      const activeRows = []
      const indexMap = []
      data.rows.forEach((row, originalIndex) => {
        if (!removedRows.has(originalIndex)) {
          indexMap.push(originalIndex)
          activeRows.push(row)
        }
      })
      const activeData = { columns: data.columns, rows: activeRows }
      const results = detectBadData(activeData)
      results.flags = results.flags.map((flag) => ({
        ...flag,
        rowIndex: indexMap[flag.rowIndex],
      }))
      setBadDataResults(results)
      setDismissedRows(new Set())
      setDetecting(false)
    })
  }

  const handleToggleRule = (rule) => {
    setEnabledRules((prev) => ({ ...prev, [rule]: !prev[rule] }))
  }

  // Bad data removal (tracked separately so undo is independent)
  const handleRemoveFlagged = () => {
    const newRemoved = new Set(removedRows)
    const newBadData = new Set(removedByBadData)
    flaggedRows.forEach((_, rowIndex) => {
      newRemoved.add(rowIndex)
      newBadData.add(rowIndex)
    })
    setRemovedRows(newRemoved)
    setRemovedByBadData(newBadData)
  }

  const handleUndoRemoval = () => {
    const newRemoved = new Set(removedRows)
    removedByBadData.forEach((i) => newRemoved.delete(i))
    setRemovedRows(newRemoved)
    setRemovedByBadData(new Set())
  }

  // Per-row actions
  const handleDismissRow = (rowIndex) => {
    setDismissedRows((prev) => new Set(prev).add(rowIndex))
  }

  const handleRemoveSingleRow = (rowIndex) => {
    setRemovedRows((prev) => new Set(prev).add(rowIndex))
    setRemovedByBadData((prev) => new Set(prev).add(rowIndex))
  }

  const handleUndoRemoveSingleRow = (rowIndex) => {
    setRemovedRows((prev) => { const n = new Set(prev); n.delete(rowIndex); return n })
    setRemovedByBadData((prev) => { const n = new Set(prev); n.delete(rowIndex); return n })
  }

  // Duplicate removal
  const handleRemoveDuplicates = () => {
    const newRemoved = new Set(removedRows)
    const newDupRemoved = new Set(removedByDuplicates)
    duplicateIndices.forEach((i) => {
      newRemoved.add(i)
      newDupRemoved.add(i)
    })
    setRemovedRows(newRemoved)
    setRemovedByDuplicates(newDupRemoved)
  }

  const handleUndoDuplicateRemoval = () => {
    const newRemoved = new Set(removedRows)
    removedByDuplicates.forEach((i) => newRemoved.delete(i))
    setRemovedRows(newRemoved)
    setRemovedByDuplicates(new Set())
  }

  // Export flagged report (includes dismissed + removed for full audit trail)
  const handleExportReport = () => {
    if (!badDataResults) return
    const allFlagged = aggregateByRow(badDataResults.flags, enabledRules)
    const reportRows = []

    allFlagged.forEach((entry, rowIndex) => {
      const status = removedRows.has(rowIndex) ? 'Removed'
        : dismissedRows.has(rowIndex) ? 'Dismissed'
        : 'Kept'
      entry.flags.forEach((flag) => {
        reportRows.push({
          'Row Number': rowIndex + 1,
          'Status': status,
          'Severity': entry.severity,
          'Rule': RULE_LABELS[flag.rule] || flag.rule,
          'Column': flag.column,
          'Reason': flag.reason,
        })
      })
    })

    const csv = Papa.unparse(reportRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'flagged-data-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  // Seed-based pattern finder
  const toggleSeedRow = (originalIndex) => {
    setSeedRows((prev) => {
      const next = new Set(prev)
      if (next.has(originalIndex)) next.delete(originalIndex)
      else next.add(originalIndex)
      return next
    })
    setSimilarRows(null)
    setPatternProfile(null)
  }

  const handleFindSimilar = () => {
    if (seedRows.size === 0) return
    setFindingSimilar(true)
    requestAnimationFrame(() => {
      const columnTypes = badDataResults
        ? badDataResults.columnTypes
        : inferColumnTypes(data.columns, data.rows)
      const { results, profile } = findSimilarRows(data, columnTypes, seedRows, removedRows)
      setSimilarRows(results)
      setPatternProfile(profile)
      setFindingSimilar(false)
      if (results.length > 0) setShowSimilarOnly(true)
    })
  }

  const handleRemoveSimilar = () => {
    if (!similarRows) return
    const newRemoved = new Set(removedRows)
    const newBadData = new Set(removedByBadData)
    // Remove seeds + similar
    seedRows.forEach((i) => { newRemoved.add(i); newBadData.add(i) })
    similarRows.forEach(({ rowIndex }) => { newRemoved.add(rowIndex); newBadData.add(rowIndex) })
    setRemovedRows(newRemoved)
    setRemovedByBadData(newBadData)
  }


  // Data for download (respects empty-column filter + removed rows)
  const filteredData = {
    columns: visibleColumns,
    rows: activeRowEntries.map(({ row }) => row),
  }

  return (
    <div className="preview">
      <div className="preview-header">
        <h2>Merged Preview</h2>
        <p>
          {activeRowEntries.length} rows
          {removedRows.size > 0 && ` (${removedRows.size} removed)`}
          , {visibleColumns.length} columns
          {emptyColumns.size > 0 && !keepEmptyColumns &&
            ` (${emptyColumns.size} empty column${emptyColumns.size !== 1 ? 's' : ''} hidden)`}
          {hasMore && ' \u00b7 showing first 100 rows'}
        </p>
        {sourceNames.length > 1 && (
          <div className="source-breakdown">
            {sourceNames.map((src) => (
              <span key={src} className="source-chip">
                {src}: {sourceCounts[src]}
              </span>
            ))}
          </div>
        )}
      </div>

      {emptyColumns.size > 0 && (
        <label className="empty-columns-toggle">
          <input
            type="checkbox"
            checked={keepEmptyColumns}
            onChange={(e) => setKeepEmptyColumns(e.target.checked)}
          />
          Keep empty columns ({emptyColumns.size} column{emptyColumns.size !== 1 ? 's' : ''} with no data: {Array.from(emptyColumns).join(', ')})
        </label>
      )}

      <ValidationPanel warnings={warnings} />

      {/* Bad Data Detection */}
      {detecting && <LoadingOverlay message="Analyzing data quality..." />}
      {!badDataResults ? (
        <button
          className="btn btn-primary detect-bad-data-btn"
          onClick={handleDetectBadData}
          disabled={detecting}
        >
          {detecting ? 'Analyzing...' : 'Detect Bad Data'}
        </button>
      ) : (
        <BadDataPanel
          results={badDataResults}
          enabledRules={enabledRules}
          onToggleRule={handleToggleRule}
          onRemoveFlagged={handleRemoveFlagged}
          onUndoRemoval={handleUndoRemoval}
          flaggedRows={flaggedRows}
          removedCount={removedByBadData.size}
          dismissedCount={dismissedRows.size}
          onDismissRow={handleDismissRow}
          onRemoveSingleRow={handleRemoveSingleRow}
          onUndoRemoveSingleRow={handleUndoRemoveSingleRow}
          onUndoDismissAll={() => setDismissedRows(new Set())}
          onExportReport={handleExportReport}
          removedRows={removedRows}
          onReanalyze={handleReanalyze}
          detecting={detecting}
          onJumpToRow={jumpToRow}
        />
      )}

      {/* Duplicate Detection */}
      <div className="duplicate-detection">
        <div className="duplicate-header">
          <h3>Duplicate Detection</h3>
          <p className="duplicate-hint">Select key columns to detect duplicate rows</p>
        </div>
        <div className="key-column-selector">
          {nonSourceColumns.map((col) => (
            <label key={col} className="key-column-chip">
              <input
                type="checkbox"
                checked={selectedKeyColumns.includes(col)}
                onChange={() => toggleKeyColumn(col)}
              />
              <span className={selectedKeyColumns.includes(col) ? 'active' : ''}>{col}</span>
            </label>
          ))}
        </div>
        {selectedKeyColumns.length > 0 && (
          <div className="duplicate-controls">
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowDuplicates(!showDuplicates)}
            >
              {showDuplicates ? 'Hide Duplicates' : 'Find Duplicates'}
            </button>
            {showDuplicates && totalDuplicates > 0 && (
              <button
                className="btn btn-sm btn-danger"
                onClick={handleRemoveDuplicates}
              >
                Remove {totalDuplicates} Duplicates
              </button>
            )}
            {removedByDuplicates.size > 0 && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleUndoDuplicateRemoval}
              >
                Undo Duplicate Removal ({removedByDuplicates.size})
              </button>
            )}
            {showDuplicates && (
              <span className="duplicate-count">
                {totalDuplicates > 0
                  ? `${totalDuplicates} duplicate rows found`
                  : 'No duplicates found'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pattern Finder */}
      <div className="pattern-finder">
        <div className="pattern-header">
          <h3>Pattern Finder</h3>
          <p className="pattern-hint">
            Check rows you know are bad, then click "Find Similar" to detect others matching the same patterns
          </p>
        </div>
        <div className="pattern-controls">
          {seedRows.size > 0 && (
            <>
              <span className="pattern-seed-count">{seedRows.size} seed{seedRows.size !== 1 ? 's' : ''} marked</span>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleFindSimilar}
                disabled={findingSimilar}
              >
                {findingSimilar ? 'Analyzing...' : 'Find Similar'}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { setSeedRows(new Set()); setSimilarRows(null); setPatternProfile(null); setShowSimilarOnly(false) }}
              >
                Clear Seeds
              </button>
            </>
          )}
          {similarRows !== null && (
            <>
              <span className="pattern-result-count">
                {similarRows.length > 0
                  ? `${similarRows.length} similar row${similarRows.length !== 1 ? 's' : ''} found`
                  : 'No similar rows found'}
              </span>
              {similarRows.length > 0 && (
                <>
                  <button
                    className={`btn btn-sm ${showSimilarOnly ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowSimilarOnly(!showSimilarOnly)}
                  >
                    {showSimilarOnly ? 'Show All Rows' : 'Show Only Matches'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={handleRemoveSimilar}
                  >
                    Remove Seeds + {similarRows.length} Similar
                  </button>
                </>
              )}
            </>
          )}
        </div>
        {seedRows.size === 0 && (
          <p className="pattern-empty">Use the checkboxes in the table to mark known bad rows as seeds</p>
        )}
        {patternProfile && patternProfile.description.length > 0 && (
          <div className="pattern-profile">
            <span className="pattern-profile-label">Profile:</span>
            {patternProfile.description.map((d, i) => (
              <span key={i} className="pattern-trait">{d}</span>
            ))}
          </div>
        )}
      </div>
      {findingSimilar && <LoadingOverlay message="Finding similar patterns..." />}

      {/* Search */}
      <div className="table-search">
        <input
          type="text"
          placeholder="Search rows... (#123 for row number)"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(100) }}
          className="search-input"
        />
        {searchQuery && (
          <span className="search-count">
            {searchFilteredEntries.length} of {activeRowEntries.length} rows
          </span>
        )}
      </div>

      {/* Data Table */}
      <div className="table-wrapper" ref={tableWrapperRef} onScroll={handleTableScroll}>
        <table className="preview-table">
          <thead>
            <tr>
              <th className="seed-col"></th>
              <th className="row-num-col">#</th>
              {visibleColumns.map((col, i) => (
                <th key={`${col}-${i}`}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayEntries.map(({ row, originalIndex }) => {
              const flagEntry = flaggedRows.get(originalIndex)
              const isDuplicate = duplicateIndices.has(originalIndex)
              const isSeed = seedRows.has(originalIndex)
              const isSimilar = similarRowSet.has(originalIndex)
              const hasIssues = flagEntry || isDuplicate || isSimilar
              const classes = [
                isDuplicate ? 'duplicate-row' : '',
                flagEntry ? `flagged-${flagEntry.severity}` : '',
                isSeed ? 'seed-row' : '',
                isSimilar ? 'similar-row' : '',
              ].filter(Boolean).join(' ')

              return (
                <tr
                  key={originalIndex}
                  className={classes}
                  onMouseEnter={(e) => {
                    if (hasIssues) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTooltipPos({ x: rect.left, y: rect.bottom + 4 })
                      setHoveredRow(originalIndex)
                    }
                  }}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td className="seed-col">
                    <input
                      type="checkbox"
                      checked={isSeed}
                      onChange={() => toggleSeedRow(originalIndex)}
                      title="Mark as known bad (seed)"
                    />
                  </td>
                  <td className="row-num-col">{originalIndex + 1}</td>
                  {visibleColumns.map((col, i) => (
                    <td key={`${col}-${i}`}>{row[col]}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Row issue tooltip (rendered outside table to avoid overflow clipping) */}
      {hoveredRow !== null && (() => {
        const flagEntry = flaggedRows.get(hoveredRow)
        const isDuplicate = duplicateIndices.has(hoveredRow)
        const isSimilar = similarRowSet.has(hoveredRow)
        if (!flagEntry && !isDuplicate && !isSimilar) return null
        return (
          <div
            className="row-tooltip"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            {flagEntry && flagEntry.flags.map((f, i) => (
              <div key={i} className="tooltip-flag">
                <span className={`tooltip-severity ${flagEntry.severity}`}>{flagEntry.severity}</span>
                {f.reason}
              </div>
            ))}
            {isDuplicate && (
              <div className="tooltip-flag">
                <span className="tooltip-severity duplicate">duplicate</span>
                Duplicate row based on selected key columns
              </div>
            )}
            {isSimilar && (() => {
              const match = similarRows && similarRows.find((r) => r.rowIndex === hoveredRow)
              const reasons = match ? match.reasons : ['Matches pattern of marked seed rows']
              return reasons.map((reason, i) => (
                <div key={`sim-${i}`} className="tooltip-flag">
                  <span className="tooltip-severity similar">similar</span>
                  {reason}
                </div>
              ))
            })()}
          </div>
        )
      })()}

      <div className="button-row">
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Mapping
        </button>
        <button className="btn btn-secondary" onClick={onReset}>
          Start Over
        </button>
        <button className="btn btn-success" onClick={() => onDownload(filteredData)}>
          Download Merged CSV ({filteredData.rows.length} rows)
        </button>
      </div>
    </div>
  )
}

export default Preview
