import React, { useEffect, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import './EditorScreen.css'

// MuPDF.js will be loaded dynamically to handle async initialization
let mupdfLib: any = null

// Configure MuPDF.js WASM path - must be set before module loads
declare const globalThis: any

// Set global Module configuration for Emscripten
globalThis.Module = {
  locateFile: (path: string, prefix: string) => {
    console.log(`MuPDF.js locateFile called: path=${path}, prefix=${prefix}`)
    if (path.endsWith('.wasm')) {
      return '/mupdf-wasm.wasm'
    }
    return prefix + path
  }
}

// Also set the specific MuPDF module config
globalThis.$libmupdf_wasm_Module = {
  locateFile: (path: string) => {
    console.log(`MuPDF.js $libmupdf_wasm_Module locateFile called: path=${path}`)
    if (path.endsWith('.wasm')) {
      return '/mupdf-wasm.wasm'
    }
    return path
  }
}

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
  const [isLoading, setIsLoading] = useState(true)
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

  // Dynamic quiz text parser - works with any PDF format
  const parseQuizText = (text: string): string[] => {
    const lines: string[] = []
    
    // Split text into logical chunks by common delimiters
    const chunks = text.split(/\n+/).filter(chunk => chunk.trim().length > 5)
    
    for (const chunk of chunks) {
      const trimmed = chunk.trim().replace(/\s+/g, ' ')
      
      // Detect questions (starts with number and dot/bracket)
      if (/^\d+[\.\)]\s+/.test(trimmed)) {
        lines.push(`❓ ${trimmed}`)
      }
      // Detect options (various formats: (a), a), A., •(a), etc.)
      else if (/^[•\-\*]?\s*[\(\[]?[a-dA-D][\)\.\]]\s+/.test(trimmed)) {
        lines.push(`🔘 ${trimmed}`)
      }
      // Detect answers (Answer:, Ans:, Correct:, etc.)
      else if (/^(Answer|Ans|Correct|Solution)s?[:]\s*/i.test(trimmed)) {
        lines.push(`✅ ${trimmed}`)
      }
      // Detect explanations (Explanation:, Because:, etc.)
      else if (/^(Explanation|Because|Reason|Solution)s?[:]\s*/i.test(trimmed)) {
        lines.push(`💡 ${trimmed}`)
      }
      // Regular text content (filter out very short or header-like text)
      else if (trimmed.length > 15 && !/^[A-Z\s]+$/.test(trimmed)) {
        lines.push(`📝 ${trimmed}`)
      }
    }
    
    console.log(`Parsed ${lines.length} lines from PDF text`)
    return lines
  }

  const extractTextFromPDF = async (file: File) => {
    try {
      setIsLoading(true)
      
      // Load MuPDF.js dynamically
      if (!mupdfLib) {
        console.log('Loading MuPDF.js...')
        mupdfLib = await import('mupdf')
        console.log('MuPDF.js loaded successfully!')
      }
      
      const arrayBuffer = await file.arrayBuffer()
      const document = mupdfLib.Document.openDocument(new Uint8Array(arrayBuffer), 'application/pdf')
      
      let allTextLines: string[] = []
      const pageCount = document.countPages()
      
      console.log(`PDF loaded with ${pageCount} pages using MuPDF.js v${mupdfLib.version || '1.26+'}`)
      
      for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        try {
          const page = document.loadPage(pageNum)
          
          // Extract structured text with MuPDF.js - try different options for best results
          let pageText = ''
          try {
            const structuredText = page.toStructuredText('preserve-whitespace,preserve-spans')
            pageText = structuredText.asText()
          } catch (structError) {
            console.warn(`Structured text failed for page ${pageNum + 1}, trying basic extraction:`, structError)
            // Fallback to basic text extraction
            const basicStructuredText = page.toStructuredText()
            pageText = basicStructuredText.asText()
          }
          
          console.log(`Page ${pageNum + 1} text extracted (${pageText.length} chars):`, pageText.substring(0, 100) + '...')
          
          // Smart parsing for quiz format using the extracted text
          if (pageText.trim()) {
            const smartParsedLines = parseQuizText(pageText)
            allTextLines = [...allTextLines, ...smartParsedLines]
          }
        } catch (pageError) {
          console.error(`Error processing page ${pageNum + 1}:`, pageError)
          allTextLines.push(`⚠️ Error processing page ${pageNum + 1}`)
        }
      }
      
      setTextLines(allTextLines)
      console.log(`Total parsed lines with MuPDF.js: ${allTextLines.length}`)
    } catch (error) {
      console.error('Error extracting text from PDF with MuPDF.js:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      })
      setTextLines(['❌ Error loading PDF with MuPDF.js. Check console for details.'])
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
            <h3>📄 PDF Content (Drag Items) - ⚡ MuPDF.js Official</h3>
            {isLoading ? (
              <p>Loading PDF content with MuPDF.js (WebAssembly-powered)...</p>
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

// PDF Pages rendering component - removed for now to focus on text extraction
// const PDFPages component will be implemented later if needed

// Draggable Text Component
import { useDrag, useDrop } from 'react-dnd'

const DraggableText: React.FC<{ text: string; index: number }> = ({ text, index }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'text',
    item: () => ({ text, index, id: `${index}-${Date.now()}` }),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    canDrag: true,
  }), [text, index])

  return (
    <div
      ref={drag as any}
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
      ref={drop as any}
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