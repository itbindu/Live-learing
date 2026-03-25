// src/components/Student/ProctoredQuiz.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/config';
import './ProctoredQuiz.css';

const ProctoredQuiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  
  const [mediaPermissions, setMediaPermissions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [videoStream, setVideoStream] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [faceDetected, setFaceDetected] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [mouseLeaveCount, setMouseLeaveCount] = useState(0);
  const [keyPressCount, setKeyPressCount] = useState(0);
  const [internetStatus, setInternetStatus] = useState(true);
  const [isStartingQuiz, setIsStartingQuiz] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startError, setStartError] = useState('');
  
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const eventListenersRef = useRef([]);
  const isComponentMountedRef = useRef(true);
  const isExitingFullscreenRef = useRef(false);
  const fullscreenCheckIntervalRef = useRef(null);

  useEffect(() => {
    console.log('ProctoredQuiz mounted');
    console.log('Quiz ID from URL:', quizId);
    
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
      if (fullscreenCheckIntervalRef.current) {
        clearInterval(fullscreenCheckIntervalRef.current);
      }
    };
  }, [quizId]);


  // Check if already submitted
  useEffect(() => {
    const checkSubmission = async () => {
      try {
        if (!quizId || quizId.length < 10) {
          console.error('Invalid quiz ID:', quizId);
          return;
        }
        
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/student/login');
          return;
        }
        
        const res = await api.get(`/api/quizzes/check-submission/${quizId}`);
        if (res.data.submitted && isComponentMountedRef.current) {
          alert('You have already taken this quiz.');
          navigate('/student/quizzes');
        }
      } catch (err) {
        console.error('Check submission error:', err);
      }
    };
    checkSubmission();
  }, [quizId, navigate]);

  // Fetch quiz data
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setError('');
        
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/student/login');
          return;
        }
        
        console.log('Fetching quiz with ID:', quizId);
        const res = await api.get(`/api/quizzes/${quizId}`);
        console.log('Quiz data received');
        
        if (isComponentMountedRef.current) {
          const quizData = res.data.quiz || res.data;
          setQuiz(quizData);
          const safeTimeLimit = quizData.timeLimit > 0 ? quizData.timeLimit : 60;
          setTimeLeft(safeTimeLimit * 60);
          setAnswers(new Array(quizData.questions.length).fill(''));
          setLoading(false);
        }
      } catch (err) {
        console.error('Fetch quiz error:', err);
        if (isComponentMountedRef.current) {
          setError('Could not load quiz');
          setLoading(false);
        }
      }
    };
    
    if (quizId && quizId.length > 10) {
      fetchQuiz();
    } else {
      setError('Invalid quiz ID');
      setLoading(false);
    }
  }, [quizId, navigate]);

  // Timer effect
  useEffect(() => {
    if (!quizStarted || !quiz || submissionResult || timeLeft <= 0 || isSubmitting) {
      return;
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!isSubmitting && !submissionResult) {
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quizStarted]);

  // Setup proctoring features when quiz starts
  useEffect(() => {
    if (quizStarted && isComponentMountedRef.current) {
      console.log('Setting up proctoring features...');
      setupProctoringFeatures();
    }
  }, [quizStarted]);

  useEffect(() => {
  if (videoStream && videoRef.current) {
    console.log("Attaching stream to video...");

    videoRef.current.srcObject = videoStream;

    videoRef.current.onloadedmetadata = () => {
      videoRef.current.play()
        .then(() => {
          console.log("✅ Video playing");
        })
        .catch(err => {
          console.error("❌ Play error:", err);
        });
    };
  }
}, [videoStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
      
      removeAllEventListeners();
      
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
      }
    };
  }, [videoStream]);

  const addSafeEventListener = (target, type, listener, options) => {
    target.addEventListener(type, listener, options);
    eventListenersRef.current.push({ target, type, listener, options });
  };

  const removeAllEventListeners = () => {
    eventListenersRef.current.forEach(({ target, type, listener, options }) => {
      try {
        target.removeEventListener(type, listener, options);
      } catch (err) {}
    });
    eventListenersRef.current = [];
  };

  const startQuiz = async () => {
  if (isStartingQuiz || quizStarted) return;

  console.log('Start quiz button clicked');
  setIsStartingQuiz(true);
  setStartError('');

  try {
    console.log('Requesting camera...');

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    console.log('Camera access granted:', stream);

    setVideoStream(stream);
    

    // Start quiz AFTER video setup
    setQuizStarted(true);
    setFullscreen(true);
    setIsStartingQuiz(false);

    // Fullscreen (non-blocking)
    setTimeout(() => {
      document.documentElement.requestFullscreen().catch(() => {});
    }, 500);

  } catch (err) {
    console.error('Error:', err);
    setStartError(err.message || "Camera not working");
    setIsStartingQuiz(false);
  }
};

  const addWarning = (message) => {
    setWarningCount(prev => {
      const newCount = prev + 1;
      setWarnings(prevWarnings => [...prevWarnings, {
        message,
        timestamp: new Date().toLocaleTimeString()
      }]);
      return newCount;
    });
  };

  const handleAnswerChange = (questionIndex, value) => {
    const updated = [...answers];
    updated[questionIndex] = value;
    setAnswers(updated);
  };

  const handleSubmit = async () => {
    if (isSubmitting || submissionResult) return;
    
    const confirmSubmit = window.confirm('Submit quiz?');
    if (!confirmSubmit) return;
    
    setIsSubmitting(true);

    try {
      const res = await api.post(`/api/quizzes/submit/${quizId}`, { answers });

      setSubmissionResult({
        score: res.data.score,
        percentage: res.data.percentage,
        correctAnswers: res.data.correctAnswers,
      });
      
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      
    } catch (err) {
      console.error('Submit failed:', err);
      alert('Could not submit quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Basic proctoring setup
  const setupProctoringFeatures = () => {
    addSafeEventListener(document, 'fullscreenchange', () => {
      setFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && quizStarted) {
        addWarning('Exited fullscreen');
        document.documentElement.requestFullscreen().catch(err => {});
      }
    });
    
    addSafeEventListener(document, 'visibilitychange', () => {
      if (document.hidden && quizStarted) {
        addWarning('Tab switched');
      }
    });
    
    addSafeEventListener(document, 'contextmenu', (e) => {
      e.preventDefault();
      addWarning('Right click attempted');
    });
  };

  if (loading) {
    return (
      <div className="proctored-quiz-container loading">
        <div className="spinner"></div>
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="proctored-quiz-container error-screen">
        <h2>Error</h2>
        <p>{error || 'Quiz not found'}</p>
        <button onClick={() => navigate('/student/quizzes')} className="back-btn">
          Back to Quizzes
        </button>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="proctored-quiz-container start-screen">
        <div className="start-screen-content">
          <h1>📝 {quiz.title}</h1>
          
          <div className="quiz-info">
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Time Limit</span>
              <span className="info-value">{quiz.timeLimit} minutes</span>
            </div>
            <div className="info-card">
              <span className="info-icon">📋</span>
              <span className="info-label">Questions</span>
              <span className="info-value">{quiz.questions.length}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">🎥</span>
              <span className="info-label">Type</span>
              <span className="info-value">Proctored</span>
            </div>
          </div>

          <div className="proctoring-requirements">
            <h3>📋 Strict Proctoring Requirements</h3>
            <div className="requirements-list">
              <div className="requirement-item">
                <span className="requirement-icon">📹</span>
                <div className="requirement-text">
                  <strong>Continuous Camera Monitoring</strong>
                  <p>Face must remain visible at all times.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">🎤</span>
                <div className="requirement-text">
                  <strong>Audio Environment Monitoring</strong>
                  <p>Background noise is monitored.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">🖥️</span>
                <div className="requirement-text">
                  <strong>Locked Fullscreen Mode</strong>
                  <p>Exiting fullscreen triggers warnings.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">⚠️</span>
                <div className="requirement-text">
                  <strong>Zero Tolerance Policy</strong>
                  <p>3 warnings = Automatic submission.</p>
                </div>
              </div>
            </div>
          </div>

          {startError && (
            <div style={{
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              <strong>Error:</strong> {startError}
            </div>
          )}

          <button 
            onClick={startQuiz} 
            className="start-quiz-btn"
            disabled={isStartingQuiz}
          >
            {isStartingQuiz ? 'Starting Quiz...' : 'Start Proctored Quiz'}
          </button>
          <button 
            onClick={() => navigate('/student/quizzes')} 
            className="cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!submissionResult) {
     const q = quiz.questions[currentQuestion];
    return (
      <div className="proctored-quiz-container quiz-active">
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        <div className="quiz-header">
          <div className="quiz-title-section">
            <h2>{quiz.title}</h2>
            <div className="timer-section">
              <span className="timer-icon">⏱️</span>
              <span className="timer">
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
          
          <div className="proctoring-status">
            <div className="status-item">
              <span className={`status-indicator ${videoStream ? 'active' : 'inactive'}`}></span>
              <span>Camera</span>
            </div>
            <div className="status-item">
              <span className={`status-indicator ${fullscreen ? 'active' : 'inactive'}`}></span>
              <span>Fullscreen</span>
            </div>
            <div className="status-item warning">
              <span>⚠️ {warningCount}/3</span>
            </div>
          </div>
        </div>
        
        <div className="quiz-main-content">

  {/* LEFT SIDE (QUESTION AREA) */}
  <div className="questions-container">

  <div className="question-block">

    <h3 className="question-title">
      Question {currentQuestion + 1}
    </h3>

    <p className="question-text">{q.question}</p>

    {q.type === 'mcq' ? (
      <div className="options-container">
        {q.options.map((opt, j) => {
  const optionLetter = String.fromCharCode(65 + j); // A, B, C, D

  return (
    <label key={j} className="option-label">
      <input
        type="radio"
        value={optionLetter}
        checked={answers[currentQuestion] === optionLetter}
        onChange={() => handleAnswerChange(currentQuestion, optionLetter)}
      />
      <span className="option-text">
        <strong>{optionLetter}.</strong> {opt}
      </span>
    </label>
  );
})}
      </div>
    ) : (
      <input
        className="blank-input"
        type="text"
        value={answers[currentQuestion] || ''}
        onChange={(e) =>
          handleAnswerChange(currentQuestion, e.target.value)
        }
        placeholder="Type your answer"
      />
    )}

  </div>

  <button onClick={handleSubmit} className="submit-quiz-btn">
    Submit
  </button>

</div>


  {/* RIGHT SIDE (QUESTION PALETTE) */}
  <div className="palette-container">
    <h3>Questions</h3>

    <div className="palette-grid">
  {quiz.questions.map((_, i) => (
    <div
      key={i}
      className="palette-item"
      onClick={() => setCurrentQuestion(i)}
    >
      {i + 1}
    </div>
  ))}
</div>
  </div>

</div>


<div className="video-container">
  <video
    ref={videoRef}
    autoPlay
    muted
    playsInline
    className="proctoring-video"
  />
</div> 


        {warnings.length > 0 && (
          <div className="warnings-panel">
            <h4>⚠️ Warnings ({warningCount}/3)</h4>
            {warnings.map((w, i) => (
              <div key={i}>{w.timestamp}: {w.message}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="proctored-quiz-container result-screen">
      <div className="result-content">
        <h1>✅ Quiz Submitted!</h1>
        <div className="score-circle">
          <span className="score-number">{submissionResult.percentage}%</span>
        </div>
        <button onClick={() => navigate('/student/quizzes')} className="back-btn">
          ← Back to Quizzes
        </button>
      </div>
    </div>
  );
};

export default ProctoredQuiz;