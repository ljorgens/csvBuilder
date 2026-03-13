import { useEffect, useState } from 'react'
import './InstructionsModal.css'

const STEPS = [
  {
    num: 1,
    title: 'Upload',
    desc: 'Drop your CSV or Excel files here.',
    details: [
      'Drag and drop multiple files at once, or click to browse.',
      'Give each file a label — this becomes the "Source" column.',
      'Adjust the header row if auto-detection picks the wrong one.',
      'Drag file cards to reorder them.',
    ],
  },
  {
    num: 2,
    title: 'Map Columns',
    desc: 'Match columns across files. We auto-match what we can.',
    details: [
      'Similar column names are auto-matched (e.g. "First Name" and "first_name").',
      'Use dropdowns to adjust, or type a new name to create a target column.',
      'Drag columns to set their order in the output.',
      'Save mappings as templates to reuse later.',
    ],
  },
  {
    num: 3,
    title: 'Preview & Clean',
    desc: 'Review the merge, remove bad data and duplicates.',
    details: [
      '"Detect Bad Data" scans for invalid emails, placeholders, and gibberish.',
      'Select key columns and "Find Duplicates" to spot repeated rows.',
      'Check known-bad rows as seeds, then "Find Similar" to catch more.',
      'Search by text, or type "#123" to jump to a specific row.',
      'Remove or dismiss rows individually or in bulk — each action is undoable.',
    ],
  },
  {
    num: 4,
    title: 'Download',
    desc: 'Export your cleaned, merged CSV.',
    details: [
      'Removed rows are excluded automatically.',
      '"Export Flagged Report" generates an audit trail of all flagged rows.',
    ],
  },
]

function InstructionsModal({ onClose }) {
  const [expandedStep, setExpandedStep] = useState(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="instructions-overlay" onClick={onClose}>
      <div className="instructions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="instructions-modal-header">
          <h2>How to Use CSV Builder</h2>
          <button className="instructions-close" onClick={onClose}>&times;</button>
        </div>
        <div className="instructions-modal-body">
          {STEPS.map((step) => {
            const isOpen = expandedStep === step.num
            return (
              <div
                key={step.num}
                className={`instructions-step ${isOpen ? 'expanded' : ''}`}
                onClick={() => setExpandedStep(isOpen ? null : step.num)}
              >
                <div className="instructions-step-num">{step.num}</div>
                <div className="instructions-step-content">
                  <h3>{step.title} <span className="instructions-chevron">{isOpen ? '\u25B4' : '\u25BE'}</span></h3>
                  <p>{step.desc}</p>
                  {isOpen && (
                    <ul className="instructions-details">
                      {step.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default InstructionsModal
