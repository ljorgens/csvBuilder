import { useRef, useState } from 'react'
import './FileUpload.css'

function FileUpload({ files, onUpload, onRemove, onUpdateLabel, onUpdateHeaderRow, onReorderFiles, onNext }) {
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [pendingLabel, setPendingLabel] = useState('')
  const [dragFileIndex, setDragFileIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const getNextLabel = () => {
    const num = files.length + 1
    return `CSV${num}`
  }

  const isAcceptedFile = (file) => {
    return (
      file.type === 'text/csv' ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    )
  }

  const handleFiles = (fileList) => {
    const toProcess = Array.from(fileList)
    toProcess.forEach((file, i) => {
      if (isAcceptedFile(file)) {
        const label = pendingLabel || `CSV${files.length + i + 1}`
        onUpload(file, label)
      } else {
        alert(`"${file.name}" is not a supported file. Use CSV or Excel files.`)
      }
    })
    setPendingLabel('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    // Ignore if this is a file card reorder drop
    if (e.dataTransfer.getData('text/plain') === 'reorder') return
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(true)
    }
  }

  // File reorder drag handlers
  const handleFileDragStart = (e, index) => {
    setDragFileIndex(index)
    e.dataTransfer.setData('text/plain', 'reorder')
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleFileDragOver = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverIndex(index)
  }

  const handleFileDrop = (e, toIndex) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragFileIndex !== null && dragFileIndex !== toIndex) {
      onReorderFiles(dragFileIndex, toIndex)
    }
    setDragFileIndex(null)
    setDragOverIndex(null)
  }

  const handleFileDragEnd = () => {
    setDragFileIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="file-upload">
      <div className="upload-label-row">
        <label htmlFor="csv-label">Source label for next upload:</label>
        <input
          id="csv-label"
          type="text"
          value={pendingLabel}
          onChange={(e) => setPendingLabel(e.target.value)}
          placeholder={getNextLabel()}
          className="label-input"
        />
      </div>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
          <>
            <p className="drop-icon">+</p>
            <p>
              Drop CSV or Excel files here or <span className="link">browse</span>
            </p>
            <p className="drop-hint">
              Supports .csv, .xlsx, .xls &mdash; multiple files at once &middot; {files.length} uploaded
            </p>
          </>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <h3>Uploaded Files</h3>
          <p className="reorder-hint">Drag cards to reorder files</p>
          {files.map((f, index) => (
            <div
              key={f.id}
              className={`file-card-wrapper ${dragFileIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-target' : ''}`}
              draggable
              onDragStart={(e) => handleFileDragStart(e, index)}
              onDragOver={(e) => handleFileDragOver(e, index)}
              onDrop={(e) => handleFileDrop(e, index)}
              onDragEnd={handleFileDragEnd}
            >
              <div className="file-card">
                <div className="drag-handle" title="Drag to reorder">&#x2807;</div>
                <div className="file-info">
                  <span className="file-name">{f.name}</span>
                  <span className="file-meta">
                    {f.rowCount} rows, {f.headers.length} columns
                  </span>
                </div>
                <div className="file-label">
                  <label>Source label:</label>
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => onUpdateLabel(f.id, e.target.value)}
                    className="label-input small"
                  />
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onRemove(f.id)}
                >
                  Remove
                </button>
              </div>

              <div className="header-detect">
                <span className="detect-label">
                  Header detected at row {f.headerRowIndex + 1}
                  {f.headerRowIndex > 0 && ` (${f.headerRowIndex} metadata row${f.headerRowIndex > 1 ? 's' : ''} skipped)`}
                </span>
                <div className="raw-preview">
                  <table className="raw-table">
                    <tbody>
                      {f.rawRows.slice(0, Math.min(f.headerRowIndex + 6, f.rawRows.length)).map((row, ri) => (
                        <tr
                          key={ri}
                          className={
                            ri === f.headerRowIndex
                              ? 'header-row'
                              : ri < f.headerRowIndex
                                ? 'meta-row'
                                : 'data-row'
                          }
                          onClick={() => onUpdateHeaderRow(f.id, ri)}
                          title={`Click to set row ${ri + 1} as header`}
                        >
                          <td className="row-num">{ri + 1}</td>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="raw-hint">
                    Click any row to change the header. <span className="legend-header">Header</span>{' '}
                    <span className="legend-meta">Skipped</span>{' '}
                    <span className="legend-data">Data</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="button-row">
        <button
          className="btn btn-primary"
          disabled={files.length === 0}
          onClick={onNext}
        >
          Next: Map Columns
        </button>
      </div>
    </div>
  )
}

export default FileUpload
