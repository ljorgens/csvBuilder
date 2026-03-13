import { useState } from 'react'
import './ValidationPanel.css'

function ValidationPanel({ warnings }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!warnings || warnings.length === 0) {
    return (
      <div className="validation-panel validation-clean">
        No data quality warnings detected.
      </div>
    )
  }

  const highCount = warnings.filter((w) => w.severity === 'high').length
  const medCount = warnings.filter((w) => w.severity === 'medium').length
  const lowCount = warnings.filter((w) => w.severity === 'low').length

  return (
    <div className="validation-panel">
      <div
        className="validation-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="validation-title">
          <strong>{warnings.length} Data Quality Warning{warnings.length !== 1 ? 's' : ''}</strong>
          <span className="validation-counts">
            {highCount > 0 && <span className="severity-badge high">{highCount} high</span>}
            {medCount > 0 && <span className="severity-badge medium">{medCount} medium</span>}
            {lowCount > 0 && <span className="severity-badge low">{lowCount} low</span>}
          </span>
        </div>
        <span className="collapse-toggle">{collapsed ? '>' : 'v'}</span>
      </div>

      {!collapsed && (
        <div className="validation-list">
          {warnings.map((w, i) => (
            <div key={i} className={`validation-item severity-${w.severity}`}>
              <span className="validation-col">{w.column}</span>
              <span className="validation-type">{w.type}</span>
              <span className="validation-msg">{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ValidationPanel
