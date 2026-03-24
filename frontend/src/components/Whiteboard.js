// src/components/Whiteboard.js
import React, { useState, useRef, useEffect } from 'react';
import { 
  PenTool, Eraser, Download, X, Square, Circle, Type, 
  Minus, Trash2, Save, Eye, EyeOff 
} from 'lucide-react';
import './Whiteboard.css';

const Whiteboard = ({ meetingId, userId, userName, role, socket }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#1a73e8');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState('pen');
  const [shape, setShape] = useState('rectangle');
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(true);
  const [currentNote, setCurrentNote] = useState('');
  const [savedDrawings, setSavedDrawings] = useState([]);
  
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctxRef.current = ctx;
    
    const saved = localStorage.getItem(`whiteboard_${meetingId}`);
    if (saved) {
      const img = new Image();
      img.src = saved;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
    }
  }, [meetingId]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      const savedData = canvas.toDataURL();
      
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      
      const img = new Image();
      img.src = savedData;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [color, brushSize]);

  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    lastX.current = x;
    lastY.current = y;
    isDrawingRef.current = true;
    setIsDrawing(true);
    
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    
    if (tool === 'text') {
      const text = prompt('Enter text:', '');
      if (text) {
        ctxRef.current.font = `${brushSize * 4}px Arial`;
        ctxRef.current.fillStyle = color;
        ctxRef.current.fillText(text, x, y);
      }
      isDrawingRef.current = false;
      setIsDrawing(false);
    }
  };

  const draw = (e) => {
    if (!isDrawingRef.current || tool === 'text') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (tool === 'pen') {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = brushSize;
      ctxRef.current.lineTo(x, y);
      ctxRef.current.stroke();
    } else if (tool === 'eraser') {
      ctxRef.current.strokeStyle = '#1e1e1e';
      ctxRef.current.lineWidth = brushSize * 2;
      ctxRef.current.lineTo(x, y);
      ctxRef.current.stroke();
    }
    
    lastX.current = x;
    lastY.current = y;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const saveDrawing = () => {
    const dataUrl = canvasRef.current.toDataURL();
    localStorage.setItem(`whiteboard_${meetingId}`, dataUrl);
    
    const drawing = {
      id: Date.now(),
      dataUrl,
      createdAt: new Date().toISOString(),
      createdBy: userName
    };
    
    setSavedDrawings(prev => [drawing, ...prev]);
    
    const link = document.createElement('a');
    link.download = `whiteboard_${meetingId}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const addNote = () => {
    if (!currentNote.trim()) return;
    
    const note = {
      id: Date.now(),
      text: currentNote,
      author: userName,
      role,
      timestamp: new Date().toLocaleTimeString(),
      pinned: false
    };
    
    setNotes(prev => [note, ...prev]);
    setCurrentNote('');
  };

  const pinNote = (noteId) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, pinned: !note.pinned } : note
    ));
  };

  const deleteNote = (noteId) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
  };

  return (
    <div className="whiteboard-container">
      <div className="whiteboard-header">
        <h3>
          <PenTool size={16} />
          Whiteboard & Notes
        </h3>
        <div className="whiteboard-actions">
          <button 
            className={`tool-btn ${showNotes ? 'active' : ''}`}
            onClick={() => setShowNotes(!showNotes)}
            title="Toggle Notes"
          >
            {showNotes ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button 
            className="icon-btn close"
            onClick={() => {}}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="whiteboard-content">
        <div className="canvas-section">
          <div className="canvas-toolbar">
            <div className="tool-group">
              <button 
                className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
                onClick={() => setTool('pen')}
                title="Pen"
              >
                <PenTool size={16} />
              </button>
              <button 
                className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                onClick={() => setTool('eraser')}
                title="Eraser"
              >
                <Eraser size={16} />
              </button>
              <button 
                className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
                onClick={() => setTool('text')}
                title="Text"
              >
                <Type size={16} />
              </button>
            </div>

            <div className="tool-group">
              <input 
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (ctxRef.current) {
                    ctxRef.current.strokeStyle = e.target.value;
                  }
                }}
                className="color-picker"
              />
              <select 
                value={brushSize} 
                onChange={(e) => {
                  setBrushSize(parseInt(e.target.value));
                  if (ctxRef.current) {
                    ctxRef.current.lineWidth = parseInt(e.target.value);
                  }
                }}
                className="brush-size"
              >
                <option value="2">Small</option>
                <option value="5">Medium</option>
                <option value="8">Large</option>
                <option value="12">XL</option>
              </select>
            </div>

            <div className="tool-group">
              <button 
                className="tool-btn"
                onClick={clearCanvas}
                title="Clear"
              >
                <Trash2 size={16} />
              </button>
              <button 
                className="tool-btn"
                onClick={saveDrawing}
                title="Save & Download"
              >
                <Save size={16} />
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>

        {showNotes && (
          <div className="notes-section">
            <div className="notes-header">
              <h4>Notes</h4>
            </div>

            <div className="notes-input">
              <textarea
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                placeholder="Type your note here..."
                rows="3"
              />
              <button 
                className="add-note-btn"
                onClick={addNote}
                disabled={!currentNote.trim()}
              >
                Add Note
              </button>
            </div>

            <div className="notes-list">
              {notes.filter(n => n.pinned).length > 0 && (
                <div className="pinned-notes">
                  <h5>📌 Pinned</h5>
                  {notes.filter(n => n.pinned).map(note => (
                    <div key={note.id} className="note-item pinned">
                      <div className="note-content">
                        <p>{note.text}</p>
                        <div className="note-meta">
                          <span className="note-author">{note.author}</span>
                          <span className="note-time">{note.timestamp}</span>
                        </div>
                      </div>
                      <div className="note-actions">
                        <button 
                          className="pin-btn active"
                          onClick={() => pinNote(note.id)}
                        >
                          📌
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => deleteNote(note.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="all-notes">
                <h5>All Notes</h5>
                {notes.filter(n => !n.pinned).length === 0 ? (
                  <p className="no-notes">No notes yet</p>
                ) : (
                  notes.filter(n => !n.pinned).map(note => (
                    <div key={note.id} className="note-item">
                      <div className="note-content">
                        <p>{note.text}</p>
                        <div className="note-meta">
                          <span className="note-author">{note.author}</span>
                          <span className="note-time">{note.timestamp}</span>
                          {note.role === 'teacher' && (
                            <span className="role-badge teacher">Teacher</span>
                          )}
                        </div>
                      </div>
                      <div className="note-actions">
                        <button 
                          className="pin-btn"
                          onClick={() => pinNote(note.id)}
                        >
                          📌
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => deleteNote(note.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Whiteboard;