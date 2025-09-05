import React, { useEffect, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import './EditorScreen.css'

// Set the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

interface EditorScreenProps {
  file: File | null
  onBack: () => void
}

interface QuestionData {
  questionNumber: number
  questionText: string
  question_images: string[]
  option_with_images_: string[]
  correct_answer: string
}

const EditorScreen: React.FC<EditorScreenProps> = ({ file, onBack }) => {
  const [pdfText, setPdfText] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [textLines, setTextLines] = useState<string[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData>({
    questionNumber: 1,
    questionText: '',
    question_images: [],
    option_with_images_: ['', '', '', ''],
    correct_answer: 'A'
  })
  const [questionsArray, setQuestionsArray] = useState<QuestionData[]>([])

  useEffect(() => {
    if (file) {
      extractTextFromPDF(file)
    }
  }, [file])

  // Smart quiz text parser - NO LINE BREAKS, SPLIT BY PATTERNS
  const parseQuizText = (text: string): string[] => {
    const lines: string[] = []
    
    // First, split by question numbers (1., 2., 3., etc.)
    const questionBlocks = text.split(/(?=\d+\.\s)/).filter(q => q.trim().length > 0)
    
    for (const block of questionBlocks) {
      let remainingText = block.trim()
      
      // Extract question number and text (everything before first option)
      const questionMatch = remainingText.match(/^(\d+\.)\s+(.*?)(?=\s*•\s*\([a-d]\)|$)/)
      if (questionMatch) {
        const questionText = questionMatch[2].trim()
        if (questionText) lines.push(`❓ ${questionText}`)
        remainingText = remainingText.replace(questionMatch[0], '').trim()
      }
      
      // Extract all options • (a), • (b), • (c), • (d)
      const optionMatches = remainingText.matchAll(/•\s*\(([a-d])\)\s+(.*?)(?=\s*•\s*\([a-d]\)|Answer:|$)/g)
      for (const match of optionMatches) {
        const optionLetter = match[1]
        const optionText = match[2].trim()
        if (optionText) lines.push(`🔘 (${optionLetter}) ${optionText}`)
        remainingText = remainingText.replace(match[0], '').trim()
      }
      
      // Extract answer
      const answerMatch = remainingText.match(/Answer:\s*(.+?)(?=\d+\.|$)/)
      if (answerMatch) {
        const answerText = answerMatch[1].trim()
        if (answerText) lines.push(`✅ Answer: ${answerText}`)
      }
    }
    
    return lines
  }

  const extractTextFromPDF = async (file: File) => {
    try {
      setIsLoading(true)
      
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
      setPdfDocument(pdf)
      
      let fullText = ''
      
      let allTextLines: string[] = []
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        
        fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`
        
        // Smart parsing for quiz format
        const smartParsedLines = parseQuizText(pageText)
        allTextLines = [...allTextLines, ...smartParsedLines]
      }
      
      setPdfText(fullText || 'No text found in PDF')
      setTextLines(allTextLines)
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
    <DndProvider backend={HTML5Backend}>
      <div className="editor-screen">
        <div className="editor-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Upload
          </button>
          <h2>PDF to JSON Builder - {file.name}</h2>
        </div>

        <div className="drag-drop-container">
          {/* LEFT SIDE - PDF Content */}
          <div className="pdf-content-panel">
            <h3>📄 PDF Content (Drag Items)</h3>
            {isLoading ? (
              <p>Loading PDF content...</p>
            ) : (
              <div className="draggable-text-list">
                {textLines.map((line, index) => (
                  <DraggableText key={index} text={line} index={index} />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT SIDE - JSON Builder */}
          <div className="json-builder-panel">
            <h3>📝 JSON Builder (Drop Here)</h3>
            <JSONBuilder 
              currentQuestion={currentQuestion}
              setCurrentQuestion={setCurrentQuestion}
              questionsArray={questionsArray}
              setQuestionsArray={setQuestionsArray}
            />
          </div>
        </div>
      </div>
    </DndProvider>
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

// Draggable Text Component
import { useDrag, useDrop } from 'react-dnd'

const DraggableText: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'text',
    item: () => ({ text, index, id: `${index}-${Date.now()}` }), // Create new item each time
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    canDrag: true, // Always allow dragging
  }), [text, index]) // Dependencies to recreate drag spec

  return (
    <div
      ref={drag}
      className={`draggable-text ${isDragging ? 'dragging' : ''}`}
      style={{
        opacity: isDragging ? 0.7 : 1,
        padding: '12px',
        margin: '4px 0',
        backgroundColor: '#ffffff',
        border: '2px solid #ddd',
        borderRadius: '6px',
        cursor: 'grab',
        color: '#333',
        fontSize: '14px',
        fontWeight: '500',
        minHeight: '40px',
        display: 'flex',
        alignItems: 'center',
        transform: isDragging ? 'scale(1.05) rotate(2deg)' : 'scale(1)',
        transition: 'all 0.2s ease',
        zIndex: isDragging ? 1000 : 1,
        pointerEvents: 'auto'
      }}
    >
      {text}
    </div>
  )
}

// Drop Zone Component

const DropZone: React.FC<{ 
  onDrop: (text: string) => void; 
  children: React.ReactNode;
  className?: string;
}> = ({ onDrop, children, className }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'text',
    drop: (item: { text: string; index: number; id?: string }) => {
      onDrop(item.text)
      return { success: true } // Return success indicator
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }), [onDrop]) // Add dependency

  return (
    <div
      ref={drop}
      className={`drop-zone ${className} ${isOver ? 'drop-over' : ''}`}
      style={{
        minHeight: '60px',
        padding: '12px',
        border: `2px dashed ${isOver ? '#007bff' : '#ccc'}`,
        borderRadius: '8px',
        backgroundColor: isOver ? '#e3f2fd' : '#ffffff',
        transition: 'all 0.2s ease',
        color: '#666',
        fontSize: '14px'
      }}
    >
      {children}
    </div>
  )
}

// JSON Builder Component
const JSONBuilder: React.FC<{
  currentQuestion: QuestionData;
  setCurrentQuestion: (q: QuestionData) => void;
  questionsArray: QuestionData[];
  setQuestionsArray: (arr: QuestionData[]) => void;
}> = ({ currentQuestion, setCurrentQuestion, questionsArray, setQuestionsArray }) => {
  
  const handleQuestionDrop = (text: string) => {
    setCurrentQuestion({ ...currentQuestion, questionText: text })
  }

  const handleOptionDrop = (text: string, optionIndex: number) => {
    const newOptions = [...currentQuestion.option_with_images_]
    newOptions[optionIndex] = text
    setCurrentQuestion({ ...currentQuestion, option_with_images_: newOptions })
  }

  const handleAnswerChange = (answer: string) => {
    setCurrentQuestion({ ...currentQuestion, correct_answer: answer })
  }

  const addQuestion = () => {
    if (currentQuestion.questionText && currentQuestion.option_with_images_.every(opt => opt.trim())) {
      setQuestionsArray([...questionsArray, { ...currentQuestion }])
      setCurrentQuestion({
        questionNumber: questionsArray.length + 2,
        questionText: '',
        question_images: [],
        option_with_images_: ['', '', '', ''],
        correct_answer: 'A'
      })
    }
  }

  const exportJSON = () => {
    const finalArray = [...questionsArray]
    if (currentQuestion.questionText && currentQuestion.option_with_images_.every(opt => opt.trim())) {
      finalArray.push(currentQuestion)
    }
    
    const jsonString = JSON.stringify(finalArray, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'questions.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="json-builder">
      <div className="question-builder">
        <h4>Question #{currentQuestion.questionNumber}</h4>
        
        <div className="form-group">
          <label>Question Text:</label>
          <DropZone onDrop={handleQuestionDrop}>
            {currentQuestion.questionText || "Drop question text here"}
          </DropZone>
        </div>

        <div className="form-group">
          <label>Options:</label>
          {['A', 'B', 'C', 'D'].map((letter, index) => (
            <div key={letter} style={{ marginBottom: '8px' }}>
              <small>Option {letter}:</small>
              <DropZone onDrop={(text) => handleOptionDrop(text, index)}>
                {currentQuestion.option_with_images_[index] || `Drop option ${letter} here`}
              </DropZone>
            </div>
          ))}
        </div>

        <div className="form-group">
          <label>Correct Answer:</label>
          <select 
            value={currentQuestion.correct_answer} 
            onChange={(e) => handleAnswerChange(e.target.value)}
            style={{ padding: '8px', width: '100px' }}
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>

        <div className="builder-actions">
          <button 
            onClick={addQuestion}
            disabled={!currentQuestion.questionText || !currentQuestion.option_with_images_.every(opt => opt.trim())}
            style={{ 
              padding: '10px 20px', 
              marginRight: '10px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Add Question
          </button>
          
          <button 
            onClick={exportJSON}
            disabled={questionsArray.length === 0}
            style={{ 
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            Export JSON ({questionsArray.length} questions)
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditorScreen