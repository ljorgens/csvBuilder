import { useEffect } from 'react'
import './FaqModal.css'

const FAQ_ITEMS = [
  {
    q: 'What file formats are supported?',
    a: 'CSV (.csv) and Excel (.xlsx, .xls) files are supported. You can upload multiple files at once by dragging them onto the drop zone or using the file picker.',
  },
  {
    q: 'How does column mapping work?',
    a: 'After uploading, the tool auto-matches columns with similar names (e.g. "First Name" and "first_name"). You can manually adjust any mapping using the dropdowns, and drag columns to reorder them in the output.',
  },
  {
    q: 'Can I save my column mappings for reuse?',
    a: 'Yes! Use the "Save Template" button in the mapping step. Templates are stored in your browser and can be loaded the next time you map files with similar columns.',
  },
  {
    q: 'What does "Detect Bad Data" do?',
    a: 'It scans for data quality issues like invalid emails, placeholder values (e.g. "test", "asdf"), suspicious phone numbers, gibberish names, and internal/team email domains. Each issue is rated by severity (high, medium, low).',
  },
  {
    q: 'How does duplicate detection work?',
    a: 'Select one or more "key" columns, then click "Find Duplicates." Rows that share the same values in all selected key columns are flagged as duplicates. You can remove them in bulk or individually.',
  },
  {
    q: 'What is the Pattern Finder?',
    a: 'If you spot rows you know are bad, check their seed checkbox in the table. Then click "Find Similar" — the tool builds a profile of shared traits (same email domain, similar names, same area code, etc.) and finds other rows matching that pattern.',
  },
  {
    q: 'Can I undo row removals?',
    a: 'Yes. Bad-data removals and duplicate removals each have their own "Undo" button, so you can reverse either action independently without affecting the other.',
  },
  {
    q: 'How do I search or jump to a specific row?',
    a: 'Use the search box above the table. Type text to filter rows, or type "#123" to jump directly to row 123. Clicking a row number in the flagged-data panel also scrolls to that row.',
  },
  {
    q: 'Is my data sent to a server?',
    a: 'No. All processing happens entirely in your browser. Your files never leave your machine.',
  },
  {
    q: 'What does the exported flagged report contain?',
    a: 'It\'s a CSV with every flagged row, its severity, the rule that triggered the flag, the column, the reason, and whether you kept, dismissed, or removed it — useful for audit trails.',
  },
]

function FaqModal({ onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="faq-overlay" onClick={onClose}>
      <div className="faq-modal" onClick={(e) => e.stopPropagation()}>
        <div className="faq-modal-header">
          <h2>FAQ</h2>
          <button className="faq-close" onClick={onClose}>&times;</button>
        </div>
        <div className="faq-modal-body">
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="faq-item">
              <summary className="faq-question">{item.q}</summary>
              <p className="faq-answer">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FaqModal
