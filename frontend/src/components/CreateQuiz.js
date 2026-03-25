import React, { useState } from 'react';
import api from '../api/config';
import { useNavigate } from 'react-router-dom';
import './CreateQuiz.css';

const CreateQuiz = () => {
  const [title, setTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState(10);
  const [questions, setQuestions] = useState([{ 
    type: 'mcq', 
    question: '', 
    options: ['', '', '', ''], 
    correctAnswer: '' 
  }]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const addQuestion = () => {
    setQuestions([...questions, { 
      type: 'mcq', 
      question: '', 
      options: ['', '', '', ''], 
      correctAnswer: '' 
    }]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      const updated = [...questions];
      updated.splice(index, 1);
      setQuestions(updated);
    }
  };

  const updateQuestion = (index, field, value, optionIndex = null) => {
    const updated = [...questions];
    if (field === 'options') {
      updated[index].options[optionIndex] = value;
    } else {
      updated[index][field] = value;
    }
    setQuestions(updated);
  };

  const validateQuiz = () => {
    if (!title.trim()) {
      setMessage('Quiz title is required');
      setMessageType('error');
      return false;
    }
    
    if (timeLimit < 1) {
      setMessage('Time limit must be at least 1 minute');
      setMessageType('error');
      return false;
    }
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.question.trim()) {
        setMessage(`Question ${i + 1}: Question text is required`);
        setMessageType('error');
        return false;
      }
      
      if (q.type === 'mcq') {
        // Check if all options are filled
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].trim()) {
            setMessage(`Question ${i + 1}: Option ${String.fromCharCode(65 + j)} is required`);
            setMessageType('error');
            return false;
          }
        }
        
        if (!q.correctAnswer.trim()) {
          setMessage(`Question ${i + 1}: Correct answer is required`);
          setMessageType('error');
          return false;
        }
        
        const validOptions = ['A', 'B', 'C', 'D'];
        if (!validOptions.includes(q.correctAnswer.toUpperCase())) {
          setMessage(`Question ${i + 1}: Correct answer must be A, B, C, or D`);
          setMessageType('error');
          return false;
        }
      }
      
      if (q.type === 'blank' && !q.correctAnswer.trim()) {
        setMessage(`Question ${i + 1}: Correct answer is required`);
        setMessageType('error');
        return false;
      }
    }
    
    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!validateQuiz()) {
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      // Format questions properly for the API
      const formattedQuestions = questions.map(q => {
        if (q.type === 'mcq') {
          // Filter out empty options just in case
          const validOptions = q.options.filter(opt => opt.trim() !== '');
          return {
            type: q.type,
            question: q.question.trim(),
            options: validOptions,
            correctAnswer: q.correctAnswer.toUpperCase()
          };
        } else {
          return {
            type: q.type,
            question: q.question.trim(),
            correctAnswer: q.correctAnswer.trim()
          };
        }
      });
      
      console.log('Sending quiz data:', {
        title: title.trim(),
        questions: formattedQuestions,
        timeLimit: parseInt(timeLimit)
      });
      
      const response = await api.post('/api/quizzes/create', { 
        title: title.trim(), 
        questions: formattedQuestions, 
        timeLimit: parseInt(timeLimit) 
      });
      
      console.log('Quiz creation response:', response.data);
      
      setMessage('Quiz created successfully! Notifications sent to students.');
      setMessageType('success');
      
      // Reset form
      setTitle('');
      setTimeLimit(10);
      setQuestions([{ 
        type: 'mcq', 
        question: '', 
        options: ['', '', '', ''], 
        correctAnswer: '' 
      }]);
      
      setTimeout(() => {
        navigate('/teacher/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Create quiz error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      let errorMessage = 'Failed to create quiz. ';
      if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-quiz-container">
      <h2>Create New Quiz</h2>

      {message && (
        <div className={messageType === 'success' ? 'success-message' : 'error-message'}>
          {message}
        </div>
      )}

      <form onSubmit={handleCreate}>
        {/* QUIZ INFO */}
        <div className="section-card">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Quiz Title *</label>
              <input
                type="text"
                placeholder="Enter quiz title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Time Limit (minutes) *</label>
              <input
                type="number"
                min="1"
                max="240"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
            </div>
          </div>
        </div>

        <h3>Questions</h3>

        {questions.map((q, i) => (
          <div key={i} className="question-card">
            <div className="question-header">
              <h4>Question {i + 1}</h4>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="remove-text-btn"
                  onClick={() => removeQuestion(i)}
                >
                  ✕ Remove
                </button>
              )}
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Type</label>
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(i, 'type', e.target.value)}
                >
                  <option value="mcq">Multiple Choice</option>
                  <option value="blank">Fill in Blank</option>
                </select>
              </div>

              <div className="form-group" style={{ flex: 3 }}>
                <label>Question *</label>
                <input
                  type="text"
                  placeholder="Enter question"
                  value={q.question}
                  onChange={(e) => updateQuestion(i, 'question', e.target.value)}
                  required
                />
              </div>
            </div>
            
            {q.type === 'mcq' && (
              <>
                <div className="options-grid">
                  {q.options.map((opt, j) => (
                    <div key={j} className="option-item">
                      <span className="option-label">
                        {String.fromCharCode(65 + j)}
                      </span>
                      <input
                        type="text"
                        placeholder={`Option ${String.fromCharCode(65 + j)} *`}
                        value={opt}
                        onChange={(e) =>
                          updateQuestion(i, 'options', e.target.value, j)
                        }
                        className="option-input"
                        required
                      />
                    </div>
                  ))}
                </div>

                <div className="correct-answer-row">
                  <label>Correct Answer *:</label>
                  <select
                    value={q.correctAnswer}
                    onChange={(e) =>
                      updateQuestion(i, 'correctAnswer', e.target.value)
                    }
                    className="correct-select"
                    required
                  >
                    <option value="">Select correct option</option>
                    {['A', 'B', 'C', 'D'].map(opt => (
                      <option key={opt} value={opt}>
                        Option {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {q.type === 'blank' && (
              <div className="correct-answer-row">
                <label>Correct Answer *:</label>
                <input
                  type="text"
                  placeholder="Enter the exact correct answer"
                  value={q.correctAnswer}
                  onChange={(e) =>
                    updateQuestion(i, 'correctAnswer', e.target.value)
                  }
                  className="blank-input"
                  required
                />
              </div>
            )}
          </div>
        ))}

        <div className="button-group">
          <button type="button" className="add-btn" onClick={addQuestion}>
            + Add Question
          </button>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating...' : 'Create Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;