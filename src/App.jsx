import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { detectHeaderRow, extractWithHeader } from './detectHeader.js'
import { autoMatchColumns } from './fuzzyMatch.js'
import FileUpload from './components/FileUpload.jsx'
import ColumnMapper from './components/ColumnMapper.jsx'
import Preview from './components/Preview.jsx'
import LoadingOverlay from './components/LoadingOverlay.jsx'
import FaqModal from './components/FaqModal.jsx'
import InstructionsModal from './components/InstructionsModal.jsx'
import './App.css'

function App() {
  const [csvFiles, setCsvFiles] = useState([])
  const [step, setStep] = useState('upload') // upload | map | preview
  const [columnMappings, setColumnMappings] = useState({})
  const [mergedData, setMergedData] = useState(null)
  const [columnOrder, setColumnOrder] = useState([])
  const [loading, setLoading] = useState(null)
  const [showFaq, setShowFaq] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const processRawData = useCallback((rawRows, file, label) => {
    const detectedIndex = detectHeaderRow(rawRows)
    const { headers, data } = extractWithHeader(rawRows, detectedIndex)

    setCsvFiles((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name: file.name,
        label: label,
        headers,
        data,
        rowCount: data.length,
        rawRows,
        headerRowIndex: detectedIndex,
      },
    ])
  }, [])

  const handleFileUpload = useCallback((file, label) => {
    const isExcel = /\.xlsx?$/i.test(file.name)
    setLoading(`Parsing ${file.name}...`)

    if (isExcel) {
      import('xlsx').then((XLSX) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
          processRawData(rawRows, file, label)
          setLoading(null)
        }
        reader.readAsArrayBuffer(file)
      }).catch(() => {
        setLoading(null)
        alert('Error loading Excel support. Please ensure xlsx package is installed.')
      })
    } else {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          processRawData(results.data, file, label)
          setLoading(null)
        },
        error: (err) => {
          setLoading(null)
          alert(`Error parsing ${file.name}: ${err.message}`)
        },
      })
    }
  }, [processRawData])

  const handleRemoveFile = useCallback((id) => {
    setCsvFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const handleUpdateLabel = useCallback((id, newLabel) => {
    setCsvFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, label: newLabel } : f))
    )
  }, [])

  const handleUpdateHeaderRow = useCallback((id, newIndex) => {
    setCsvFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const { headers, data } = extractWithHeader(f.rawRows, newIndex)
        return { ...f, headers, data, rowCount: data.length, headerRowIndex: newIndex }
      })
    )
  }, [])

  const handleReorderFiles = useCallback((fromIndex, toIndex) => {
    setCsvFiles((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })
  }, [])

  const getAllSourceColumns = () => {
    const cols = new Set()
    csvFiles.forEach((f) => f.headers.forEach((h) => cols.add(h)))
    return Array.from(cols)
  }

  const handleStartMapping = () => {
    const sourceColumns = getAllSourceColumns()
    const initialMappings = autoMatchColumns(sourceColumns)
    setColumnMappings(initialMappings)
    setColumnOrder([...new Set(Object.values(initialMappings).filter(Boolean))])
    setStep('map')
  }

  const handleMerge = () => {
    setLoading('Merging data...')
    requestAnimationFrame(() => {
      // Use columnOrder for output column ordering
      const activeTargets = new Set(Object.values(columnMappings).filter(Boolean))
      const orderedColumns = columnOrder.filter((col) => activeTargets.has(col))

      // Add any new targets not yet in columnOrder
      activeTargets.forEach((col) => {
        if (!orderedColumns.includes(col)) orderedColumns.push(col)
      })
      orderedColumns.push('Source')

      const allRows = []
      csvFiles.forEach((file) => {
        file.data.forEach((row) => {
          const newRow = {}
          orderedColumns.forEach((col) => {
            newRow[col] = ''
          })
          file.headers.forEach((header) => {
            const mappedName = columnMappings[header]
            if (mappedName) {
              newRow[mappedName] = row[header] || ''
            }
          })
          newRow['Source'] = file.label
          allRows.push(newRow)
        })
      })

      setMergedData({ columns: orderedColumns, rows: allRows })
      setStep('preview')
      setLoading(null)
    })
  }

  const handleDownload = (filteredData) => {
    const toExport = filteredData || mergedData
    if (!toExport) return
    const csv = Papa.unparse({
      fields: toExport.columns,
      data: toExport.rows,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'merged.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setCsvFiles([])
    setStep('upload')
    setColumnMappings({})
    setMergedData(null)
    setColumnOrder([])
  }

  return (
    <div className="app">
      {loading && <LoadingOverlay message={loading} />}
      {showFaq && <FaqModal onClose={() => setShowFaq(false)} />}
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
      <button className="instructions-btn" onClick={() => setShowInstructions(true)}>Instructions</button>
      <button className="help-btn" onClick={() => setShowFaq(true)} title="FAQ">?</button>
      <header className="app-header">
        <h1>CSV Builder</h1>
        <p>Upload, map, and merge multiple CSVs into one</p>
      </header>

      <div className="steps">
        <div className={`step-indicator ${step === 'upload' ? 'active' : ''}`}>
          1. Upload
        </div>
        <div className="step-arrow">&rarr;</div>
        <div className={`step-indicator ${step === 'map' ? 'active' : ''}`}>
          2. Map Columns
        </div>
        <div className="step-arrow">&rarr;</div>
        <div className={`step-indicator ${step === 'preview' ? 'active' : ''}`}>
          3. Preview & Download
        </div>
      </div>

      <main className="app-main">
        {step === 'upload' && (
          <FileUpload
            files={csvFiles}
            onUpload={handleFileUpload}
            onRemove={handleRemoveFile}
            onUpdateLabel={handleUpdateLabel}
            onUpdateHeaderRow={handleUpdateHeaderRow}
            onReorderFiles={handleReorderFiles}
            onNext={handleStartMapping}
          />
        )}

        {step === 'map' && (
          <ColumnMapper
            files={csvFiles}
            mappings={columnMappings}
            columnOrder={columnOrder}
            onUpdateMapping={(sourceCol, targetCol) =>
              setColumnMappings((prev) => ({ ...prev, [sourceCol]: targetCol }))
            }
            onSetMappings={setColumnMappings}
            onSetColumnOrder={setColumnOrder}
            onBack={() => setStep('upload')}
            onMerge={handleMerge}
          />
        )}

        {step === 'preview' && (
          <Preview
            data={mergedData}
            onDownload={handleDownload}
            onBack={() => setStep('map')}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}

export default App
