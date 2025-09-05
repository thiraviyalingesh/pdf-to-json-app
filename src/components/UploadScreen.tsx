import React, { useCallback, useState } from 'react'

interface UploadScreenProps {
  onFileUpload: (file: File) => void
}

const UploadScreen: React.FC<UploadScreenProps> = ({ onFileUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0 && files[0].type === 'application/pdf') {
      onFileUpload(files[0])
    } else {
      alert('Please upload a PDF file')
    }
  }, [onFileUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      if (files[0].type === 'application/pdf') {
        onFileUpload(files[0])
      } else {
        alert('Please upload a PDF file')
      }
    }
  }, [onFileUpload])

  return (
    <div className="upload-screen">
      <div className="upload-container">
        <h1>PDF to JSON Converter</h1>
        <p>Upload your PDF file to convert it to structured JSON format</p>
        
        <div 
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <div className="drop-zone-content">
            <div className="upload-icon">📄</div>
            <h3>Drag and drop PDF file here</h3>
            <p>or <span className="browse-text">click to browse</span></p>
            <input
              id="fileInput"
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadScreen