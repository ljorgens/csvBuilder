import { useState, useEffect } from 'react'
import './MappingTemplates.css'

const STORAGE_KEY = 'csvBuilder_mappingTemplates'

function MappingTemplates({ currentMappings, onApplyTemplate, sourceColumns }) {
  const [templates, setTemplates] = useState([])
  const [newName, setNewName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [applyResult, setApplyResult] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setTemplates(JSON.parse(stored))
      } catch {
        // Ignore corrupted data
      }
    }
  }, [])

  const saveToStorage = (updated) => {
    setTemplates(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const handleSave = () => {
    if (!newName.trim()) return
    const template = {
      id: Date.now(),
      name: newName.trim(),
      mappings: { ...currentMappings },
      createdAt: new Date().toISOString(),
    }
    saveToStorage([...templates, template])
    setNewName('')
    setShowSave(false)
  }

  const handleDelete = (id) => {
    saveToStorage(templates.filter((t) => t.id !== id))
  }

  const handleApply = (template) => {
    const applied = {}
    const unmatched = []

    // Best-effort apply: match by source column name
    Object.entries(template.mappings).forEach(([sourceCol, targetCol]) => {
      if (sourceColumns.includes(sourceCol)) {
        applied[sourceCol] = targetCol
      } else {
        unmatched.push(sourceCol)
      }
    })

    // Keep current mappings for columns not in the template
    sourceColumns.forEach((col) => {
      if (!(col in applied)) {
        applied[col] = col
      }
    })

    onApplyTemplate(applied)

    if (unmatched.length > 0) {
      setApplyResult(`Applied. ${unmatched.length} column(s) not found: ${unmatched.join(', ')}`)
    } else {
      setApplyResult('Template applied successfully.')
    }
    setTimeout(() => setApplyResult(null), 4000)
  }

  return (
    <div className="mapping-templates">
      <div className="templates-header">
        <h3>Mapping Templates</h3>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setShowSave(!showSave)}
        >
          {showSave ? 'Cancel' : 'Save Current'}
        </button>
      </div>

      {showSave && (
        <div className="template-save-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name..."
            className="template-name-input"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button className="btn btn-sm btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      )}

      {applyResult && (
        <div className="template-result">{applyResult}</div>
      )}

      {templates.length === 0 ? (
        <p className="templates-empty">No saved templates yet.</p>
      ) : (
        <div className="templates-list">
          {templates.map((t) => (
            <div key={t.id} className="template-item">
              <div className="template-info">
                <span className="template-name">{t.name}</span>
                <span className="template-meta">
                  {Object.keys(t.mappings).length} columns
                </span>
              </div>
              <div className="template-actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleApply(t)}
                >
                  Apply
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(t.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MappingTemplates
