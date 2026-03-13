import './LoadingOverlay.css'

function LoadingOverlay({ message = 'Processing...' }) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner" />
        <p className="loading-message">{message}</p>
      </div>
    </div>
  )
}

export default LoadingOverlay
