import React, { useEffect, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Set the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

interface EditorScreenProps {
  file: File | null
  onBack: () => void
}

const EditorScreen: React.FC<EditorScreenProps> = ({ file, onBack }) => {
  const [pdfText, setPdfText] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null)

  useEffect(() => {
    if (file) {
      extractTextFromPDF(file)
    }
  }, [file])

  const extractTextFromPDF = async (file: File) => {
    try {
      setIsLoading(true)
      
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
      setPdfDocument(pdf)
      
      let fullText = ''
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        
        fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`
      }
      
      setPdfText(fullText || 'No text found in PDF')
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      setPdfText('Error extracting text from PDF')
    } finally {
      setIsLoading(false)
    }
  }

  if (!file) {
    return <div>No file selected</div>
  }

  return (
    <div className="editor-screen">
      <div className="editor-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Upload
        </button>
        <h2>PDF Editor - {file.name}</h2>
      </div>

      <div className="editor-content">
        <div className="pdf-viewer-section">
          <h3>PDF Preview</h3>
          <div className="pdf-preview">
            {pdfDocument ? (
              <div>
                <div className="pdf-info">
                  <p>File: {file.name}</p>
                  <p>Pages: {pdfDocument.numPages}</p>
                  <p>Size: {(file.size / 1024).toFixed(2)} KB</p>
                </div>
                <div className="pdf-pages">
                  <PDFPages pdfDocument={pdfDocument} />
                </div>
              </div>
            ) : (
              <div className="pdf-loading">
                {isLoading ? (
                  <p>Loading PDF...</p>
                ) : (
                  <p>Unable to load PDF preview</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-extraction-section">
          <h3>Extracted Text</h3>
          <div className="text-content">
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <pre>{pdfText}</pre>
            )}
          </div>
        </div>
      </div>

      <div className="editor-actions">
        <button className="btn-primary">Generate JSON</button>
        <button className="btn-secondary">Download JSON</button>
      </div>
    </div>
  )
}

// PDF Pages rendering component
const PDFPages: React.FC<{ pdfDocument: pdfjsLib.PDFDocumentProxy }> = ({ pdfDocument }) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCanvas, setPageCanvas] = useState<string | null>(null)

  useEffect(() => {
    renderPage(currentPage)
  }, [currentPage, pdfDocument])

  const renderPage = async (pageNum: number) => {
    try {
      const page = await pdfDocument.getPage(pageNum)
      const viewport = page.getViewport({ scale: 0.8 })
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (context) {
        canvas.height = viewport.height
        canvas.width = viewport.width
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }
        
        await page.render(renderContext).promise
        setPageCanvas(canvas.toDataURL())
      }
    } catch (error) {
      console.error('Error rendering page:', error)
    }
  }

  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= pdfDocument.numPages) {
      setCurrentPage(pageNum)
    }
  }

  return (
    <div className="pdf-renderer">
      <div className="page-controls">
        <button 
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span>Page {currentPage} of {pdfDocument.numPages}</span>
        <button 
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= pdfDocument.numPages}
        >
          Next
        </button>
      </div>
      <div className="page-canvas">
        {pageCanvas ? (
          <img src={pageCanvas} alt={`PDF Page ${currentPage}`} />
        ) : (
          <p>Rendering page...</p>
        )}
      </div>
    </div>
  )
}

export default EditorScreen