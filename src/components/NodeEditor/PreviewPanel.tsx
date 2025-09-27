import React from 'react';

const PreviewPanel: React.FC = () => {
  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h3>Preview</h3>
        <div className="preview-controls">
          <button className="preview-button">Play</button>
          <button className="preview-button">Pause</button>
          <button className="preview-button">Stop</button>
        </div>
      </div>

      <div className="preview-content">
        <div className="video-preview">
          <div className="preview-placeholder">
            <div className="preview-icon">📹</div>
            <p>Video preview will appear here</p>
            <small>Upload a video and connect nodes to see preview</small>
          </div>
        </div>

        <div className="preview-info">
          <div className="info-section">
            <h4>Timeline</h4>
            <div className="timeline">
              <div className="timeline-track">
                <div className="timeline-progress" style={{ width: '0%' }}></div>
              </div>
              <span className="time-display">00:00 / 00:00</span>
            </div>
          </div>

          <div className="info-section">
            <h4>Output Info</h4>
            <div className="output-info">
              <div className="info-item">
                <span className="info-label">Resolution:</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-item">
                <span className="info-label">Duration:</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-item">
                <span className="info-label">Format:</span>
                <span className="info-value">-</span>
              </div>
              <div className="info-item">
                <span className="info-label">Size:</span>
                <span className="info-value">-</span>
              </div>
            </div>
          </div>

          <div className="info-section">
            <h4>Processing Status</h4>
            <div className="processing-status">
              <div className="status-item">
                <span className="status-dot idle"></span>
                <span>Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;