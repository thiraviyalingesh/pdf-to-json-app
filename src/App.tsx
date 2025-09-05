import { useState } from 'react'
import './App.css'
import UploadScreen from './components/UploadScreen'
import EditorScreen from './components/EditorScreen'

function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [currentScreen, setCurrentScreen] = useState<'upload' | 'editor'>('upload')

  const handleFileUpload = (file: File) => {
    setUploadedFile(file)
    setCurrentScreen('editor')
  }

  const handleBackToUpload = () => {
    setUploadedFile(null)
    setCurrentScreen('upload')
  }

  return (
    <div className="app">
      {currentScreen === 'upload' ? (
        <UploadScreen onFileUpload={handleFileUpload} />
      ) : (
        <EditorScreen file={uploadedFile} onBack={handleBackToUpload} />
      )}
    </div>
  )
}

export default App
