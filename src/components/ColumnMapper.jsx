import { useState } from 'react'
import MappingTemplates from './MappingTemplates.jsx'
import './ColumnMapper.css'

function ColumnMapper({ files, mappings, columnOrder, onUpdateMapping, onSetMappings, onSetColumnOrder, onBack, onMerge }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // Group source columns by which file(s) they appear in
  const columnFileMap = {}
  files.forEach((file) => {
    file.headers.forEach((header) => {
      if (!columnFileMap[header]) {
        columnFileMap[header] = []
      }
      columnFileMap[header].push(file.label)
    })
  })

  const sourceColumns = Object.keys(columnFileMap)

  // Get sample values for each source column (up to 3 unique values)
  const columnSamples = {}
  sourceColumns.forEach((col) => {
    const samples = new Set()
    for (const file of files) {
      if (!file.headers.includes(col)) continue
      for (const row of file.data) {
        const val = row[col]
        if (val && val.toString().trim() !== '') {
          samples.add(val.toString().trim())
          if (samples.size >= 3) break
        }
      }
      if (samples.size >= 3) break
    }
    columnSamples[col] = Array.from(samples)
  })

  // Get all unique target column names currently in use
  const targetColumns = [...new Set(Object.values(mappings).filter(Boolean))]

  // Column drag reorder handlers
  const handleDragStart = (e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = (e, toIndex) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== toIndex) {
      const reordered = [...sourceColumns]
      const [moved] = reordered.splice(dragIndex, 1)
      reordered.splice(toIndex, 0, moved)

      // Update columnOrder based on new source column order
      const newOrder = []
      const seen = new Set()
      reordered.forEach((col) => {
        const target = mappings[col]
        if (target && !seen.has(target)) {
          seen.add(target)
          newOrder.push(target)
        }
      })
      onSetColumnOrder(newOrder)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleApplyTemplate = (newMappings) => {
    onSetMappings(newMappings)
    const newOrder = [...new Set(Object.values(newMappings).filter(Boolean))]
    onSetColumnOrder(newOrder)
  }

  return (
    <div className="column-mapper">
      <div className="mapper-header">
        <h2>Map Columns</h2>
        <p>
          Choose how columns from each CSV map to the merged output. Columns
          with the same target name will be combined. Drag rows to reorder output columns.
        </p>
      </div>

      <MappingTemplates
        currentMappings={mappings}
        onApplyTemplate={handleApplyTemplate}
        sourceColumns={sourceColumns}
      />

      <div className="mapping-table">
        <div className="mapping-row mapping-header-row">
          <div className="mapping-cell mapping-cell-handle"></div>
          <div className="mapping-cell">Source Column</div>
          <div className="mapping-cell">Found In</div>
          <div className="mapping-cell">Output Column Name</div>
          <div className="mapping-cell mapping-cell-toggle">Include?</div>
        </div>

        {sourceColumns.map((col, index) => {
          const included = Boolean(mappings[col])
          return (
            <div
              key={col}
              className={`mapping-row ${!included ? 'excluded' : ''} ${dragIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-target' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="mapping-cell mapping-cell-handle">
                <span className="drag-handle" title="Drag to reorder">&#x2807;</span>
              </div>
              <div className="mapping-cell source-col">
                <span>{col}</span>
                {columnSamples[col] && columnSamples[col].length > 0 && (
                  <span className="sample-values">
                    {columnSamples[col].map((s, i) => (
                      <span key={i} className="sample-value">
                        {s.length > 30 ? s.slice(0, 30) + '\u2026' : s}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <div className="mapping-cell found-in">
                {columnFileMap[col].map((label) => (
                  <span key={label} className="file-tag">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mapping-cell">
                <input
                  type="text"
                  value={mappings[col] || ''}
                  onChange={(e) => onUpdateMapping(col, e.target.value)}
                  placeholder={col}
                  className="map-input"
                  disabled={!included && mappings[col] === ''}
                />
              </div>
              <div className="mapping-cell mapping-cell-toggle">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onUpdateMapping(col, col)
                      } else {
                        onUpdateMapping(col, '')
                      }
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mapping-summary">
        <strong>{targetColumns.length}</strong> output columns will be created
        (plus a &quot;Source&quot; column)
      </div>

      <div className="button-row">
        <button className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onMerge}
          disabled={targetColumns.length === 0}
        >
          Merge & Preview
        </button>
      </div>
    </div>
  )
}

export default ColumnMapper
