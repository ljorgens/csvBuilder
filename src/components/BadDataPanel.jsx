import { useState } from 'react'
import { RULE_LABELS } from '../detectBadData.js'
import './BadDataPanel.css'

function BadDataPanel({
  results, enabledRules, onToggleRule, onRemoveFlagged, onUndoRemoval,
  flaggedRows, removedCount, dismissedCount,
  onDismissRow, onRemoveSingleRow, onUndoRemoveSingleRow, onUndoDismissAll,
  onExportReport, removedRows, onReanalyze, detecting, onJumpToRow,
}) {
  const [expanded, setExpanded] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('all')

  const { columnTypes } = results

  // Severity counts
  let highCount = 0
  let medCount = 0
  let lowCount = 0
  flaggedRows.forEach((entry) => {
    if (entry.severity === 'high') highCount++
    else if (entry.severity === 'medium') medCount++
    else lowCount++
  })

  const totalFlagged = flaggedRows.size
  const typeEntries = Object.entries(columnTypes).filter(([, type]) => type !== 'source')

  // Filter entries by selected severity
  const filteredEntries = Array.from(flaggedRows.entries())
    .filter(([, entry]) => severityFilter === 'all' || entry.severity === severityFilter)
    .sort(([, a], [, b]) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.severity] - order[b.severity]
    })

  return (
    <div className="bad-data-panel">
      <div className="bad-data-header" onClick={() => setExpanded(!expanded)}>
        <div className="bad-data-title">
          <strong>Bad Data Detection</strong>
          {totalFlagged > 0 && (
            <span className="bad-data-counts">
              <span className="bad-data-total">{totalFlagged} flagged</span>
              {highCount > 0 && <span className="severity-badge high">{highCount} high</span>}
              {medCount > 0 && <span className="severity-badge medium">{medCount} med</span>}
              {lowCount > 0 && <span className="severity-badge low">{lowCount} low</span>}
            </span>
          )}
          {totalFlagged === 0 && (
            <span className="bad-data-clean">No suspicious rows detected</span>
          )}
        </div>
        <span className="collapse-toggle">{expanded ? 'v' : '>'}</span>
      </div>

      {expanded && (
        <div className="bad-data-body">
          <div className="bad-data-section">
            <h4>Detected Column Types</h4>
            <div className="column-types">
              {typeEntries.map(([col, type]) => (
                <span key={col} className={`type-badge type-${type}`}>
                  {col}: <strong>{type}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="bad-data-section">
            <h4>Detection Rules</h4>
            <div className="rules-grid">
              {Object.entries(RULE_LABELS).map(([rule, label]) => (
                <label key={rule} className="rule-toggle">
                  <input
                    type="checkbox"
                    checked={enabledRules[rule]}
                    onChange={() => onToggleRule(rule)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {(totalFlagged > 0 || removedCount > 0 || dismissedCount > 0) && (
            <div className="bad-data-section">
              <div className="bad-data-actions">
                {totalFlagged > 0 && (
                  <>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowDetails(!showDetails)}
                    >
                      {showDetails ? 'Hide Details' : `Show Details (${totalFlagged} rows)`}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={onRemoveFlagged}
                    >
                      Remove {totalFlagged} Flagged Rows
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={onExportReport}
                    >
                      Export Flagged Report
                    </button>
                  </>
                )}
                {removedCount > 0 && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={onUndoRemoval}
                  >
                    Undo Removal ({removedCount} rows)
                  </button>
                )}
                {dismissedCount > 0 && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={onUndoDismissAll}
                  >
                    Undo {dismissedCount} Dismissed
                  </button>
                )}
                {(removedCount > 0 || dismissedCount > 0) && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={onReanalyze}
                    disabled={detecting}
                  >
                    {detecting ? 'Analyzing...' : 'Re-analyze'}
                  </button>
                )}
              </div>
            </div>
          )}

          {showDetails && totalFlagged > 0 && (
            <>
              <div className="severity-filters">
                {['all', 'high', 'medium', 'low'].map((sev) => {
                  const count = sev === 'all' ? totalFlagged
                    : sev === 'high' ? highCount
                    : sev === 'medium' ? medCount
                    : lowCount
                  if (sev !== 'all' && count === 0) return null
                  return (
                    <button
                      key={sev}
                      className={`severity-filter-btn ${severityFilter === sev ? 'active' : ''} ${sev !== 'all' ? `sev-${sev}` : ''}`}
                      onClick={() => setSeverityFilter(sev)}
                    >
                      {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)} ({count})
                    </button>
                  )
                })}
              </div>
              <div className="flagged-details">
                {filteredEntries
                  .slice(0, 100)
                  .map(([rowIndex, entry]) => (
                    <div key={rowIndex} className={`flagged-row severity-${entry.severity}${removedRows.has(rowIndex) ? ' row-removed' : ''}`}>
                      <span
                        className="flagged-row-num clickable"
                        onClick={() => onJumpToRow(rowIndex)}
                        title="Jump to row in table"
                      >Row {rowIndex + 1}</span>
                      <span className={`severity-badge ${entry.severity}`}>{entry.severity}</span>
                      <div className="flagged-reasons">
                        {entry.flags.map((f, i) => (
                          <span key={i} className="flagged-reason">{f.reason}</span>
                        ))}
                      </div>
                      <div className="flagged-actions">
                        {removedRows.has(rowIndex) ? (
                          <button
                            className="btn btn-xs btn-secondary"
                            onClick={() => onUndoRemoveSingleRow(rowIndex)}
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              className="btn btn-xs btn-danger"
                              onClick={() => onRemoveSingleRow(rowIndex)}
                              title="Remove this row from output"
                            >
                              Remove
                            </button>
                            <button
                              className="btn btn-xs btn-secondary"
                              onClick={() => onDismissRow(rowIndex)}
                              title="Dismiss flag — keep this row"
                            >
                              Keep
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                {filteredEntries.length > 100 && (
                  <p className="flagged-more">...and {filteredEntries.length - 100} more rows</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default BadDataPanel
