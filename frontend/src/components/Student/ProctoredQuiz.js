// src/components/Student/ProctoredQuiz.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/config';
import './ProctoredQuiz.css';

const ProctoredQuiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  
  // --- SAMPLE QUIZ DATA (for demonstration, will be replaced by API data) ---
  const sampleQuiz = {
    _id: 'sample123',
    title: 'JavaScript Fundamentals',
    timeLimit: 5,
    questions: [
      {
        type: 'mcq',
        question: 'Which of the following is used to declare a variable in JavaScript?',
        options: ['var', 'let', 'const', 'All of the above']
      },
      {
        type: 'mcq',
        question: 'What does the `===` operator do?',
        options: ['Compares values only', 'Compares values and types', 'Assigns a value', 'None of the above']
      },
      {
        type: 'fill',
        question: 'The _______ keyword is used to declare a constant variable in JavaScript.',
        options: []
      },
      {
        type: 'mcq',
        question: 'Which company developed JavaScript?',
        options: ['Microsoft', 'Netscape', 'Google', 'Apple']
      }
    ]
  };
  // --- END SAMPLE DATA ---
  
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

  // Check if already submitted (skip for sample)
  useEffect(() => {
    // For demo, we skip API check and use sample data
    if (quizId === 'sample123') {
      setQuiz(sampleQuiz);
      const safeTimeLimit = sampleQuiz.timeLimit > 0 ? sampleQuiz.timeLimit : 60;
      setTimeLeft(safeTimeLimit * 60);
      setAnswers(new Array(sampleQuiz.questions.length).fill(''));
      setLoading(false);
      return;
    }
    
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

  // Fetch quiz data (will be overridden by sample for demo)
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        setError('');
        
        // For demo, if it's sample123, use sample data
        if (quizId === 'sample123') {
          setQuiz(sampleQuiz);
          const safeTimeLimit = sampleQuiz.timeLimit > 0 ? sampleQuiz.timeLimit : 60;
          setTimeLeft(safeTimeLimit * 60);
          setAnswers(new Array(sampleQuiz.questions.length).fill(''));
          setLoading(false);
          return;
        }
        
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
    } else if (quizId === 'sample123') {
      // Already handled above, but ensure it's set
      if (!quiz) {
        setQuiz(sampleQuiz);
        setTimeLeft(sampleQuiz.timeLimit * 60);
        setAnswers(new Array(sampleQuiz.questions.length).fill(''));
        setLoading(false);
      }
    } else if (quizId) {
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
      setQuizStarted(true);
      setFullscreen(true);
      setIsStartingQuiz(false);
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
      
      // Auto-submit if 3 warnings reached
      if (newCount >= 3 && !isSubmitting && !submissionResult) {
        alert('Maximum warnings (3) reached. Quiz will be submitted automatically.');
        handleSubmit();
      }
      
      return newCount;
    });
  };

  const handleAnswerChange = (questionIndex, value) => {
    const updated = [...answers];
    updated[questionIndex] = value;
    setAnswers(updated);
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      alert('This is the last question. Please submit your quiz.');
    }
  };

  const handleSkip = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      alert('This is the last question. Please submit your quiz.');
    }
  };

  const handleFinish = () => {
    const unanswered = answers.filter(ans => !ans || ans === '').length;
    if (unanswered > 0) {
      const confirmFinish = window.confirm(`You have ${unanswered} unanswered question(s). Are you sure you want to finish?`);
      if (confirmFinish) {
        handleSubmit();
      }
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || submissionResult) return;
    
    const confirmSubmit = window.confirm('Are you sure you want to submit your quiz?');
    if (!confirmSubmit) return;
    
    setIsSubmitting(true);

    try {
      // For demo, calculate score based on sample answers
      if (quizId === 'sample123') {
        let correct = 0;
        const correctAnswersMap = ['D', 'B', 'const', 'B']; // D, B, const, B
        answers.forEach((ans, idx) => {
          if (ans && ans.toUpperCase() === correctAnswersMap[idx].toUpperCase()) correct++;
        });
        const percentage = (correct / quiz.questions.length) * 100;
        setSubmissionResult({
          score: correct,
          percentage: Math.round(percentage),
          correctAnswers: correct,
        });
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
        setIsSubmitting(false);
        return;
      }
      
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
      alert('Could not submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Basic proctoring setup
  const setupProctoringFeatures = () => {
    addSafeEventListener(document, 'fullscreenchange', () => {
      setFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && quizStarted && !isSubmitting) {
        addWarning('Exited fullscreen mode');
        // Re-request fullscreen
        document.documentElement.requestFullscreen().catch(err => {});
      }
    });
    
    addSafeEventListener(document, 'visibilitychange', () => {
      if (document.hidden && quizStarted && !isSubmitting) {
        addWarning('Tab or window switched');
      }
    });
    
    addSafeEventListener(document, 'contextmenu', (e) => {
      e.preventDefault();
      addWarning('Right-click attempted');
    });
    
    // Detect copy/paste attempts
    addSafeEventListener(document, 'copy', (e) => {
      e.preventDefault();
      addWarning('Copy attempt detected');
    });
    
    addSafeEventListener(document, 'paste', (e) => {
      e.preventDefault();
      addWarning('Paste attempt detected');
    });
    
    // Detect keyboard shortcuts
    addSafeEventListener(document, 'keydown', (e) => {
      // Detect Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+P, Ctrl+S
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 's', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        addWarning(`Keyboard shortcut (Ctrl+${e.key.toUpperCase()}) detected`);
      }
      
      // Detect F12 (Developer Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        addWarning('Developer tools attempted');
      }
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusChipClass = (type) => {
    if (type === 'camera') {
      return videoStream ? 'active' : 'inactive';
    }
    if (type === 'fullscreen') {
      return fullscreen ? 'active' : 'inactive';
    }
    if (type === 'warnings') {
      if (warningCount >= 3) return 'danger';
      if (warningCount > 0) return 'warning';
      return 'active';
    }
    return '';
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
                  <p>Face must remain visible at all times. Camera access is mandatory.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">🎤</span>
                <div className="requirement-text">
                  <strong>Audio Environment Monitoring</strong>
                  <p>Background noise is monitored for suspicious activity.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">🖥️</span>
                <div className="requirement-text">
                  <strong>Locked Fullscreen Mode</strong>
                  <p>Exiting fullscreen triggers warnings. Maximum 3 warnings allowed.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">⚠️</span>
                <div className="requirement-text">
                  <strong>Zero Tolerance Policy</strong>
                  <p>3 warnings = Automatic submission. No exceptions.</p>
                </div>
              </div>
            </div>
          </div>

          {startError && (
            <div className="error-message">
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
    const currentQ = quiz.questions[currentQuestion];
    const answeredCount = answers.filter(ans => ans && ans !== '').length;
    
    return (
      <div className="proctored-quiz-container quiz-active">
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* HEADER - With Finish Button on Right */}
        <div className="quiz-header">
          <div className="header-left">
            <div className="quiz-name">{quiz.title}</div>
            <div className="timer-box">
              {formatTime(timeLeft)}
            </div>
            <div className="progress-container">
              {quiz.questions.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`progress-dot ${idx === currentQuestion ? 'active' : ''} ${answers[idx] && answers[idx] !== '' ? 'completed' : ''}`}
                  onClick={() => setCurrentQuestion(idx)}
                >
                  {idx + 1}
                </div>
              ))}
            </div>
          </div>
          <button className="finish-top-btn" onClick={handleFinish}>
            Finish Quiz
          </button>
        </div>

        {/* BODY */}
        <div className="quiz-body">
          {/* LEFT - QUESTION PANEL */}
          <div className="question-panel">
            <div className="question-header">
              <span className="question-number">Question {currentQuestion + 1} of {quiz.questions.length}</span>
              <span className="total-marks">Marks: 1</span>
            </div>
            <div className="question-text">
              {currentQ.question}
            </div>
            {currentQ.image && (
              <div className="image-container">
                <img src={currentQ.image} alt="Question illustration" />
              </div>
            )}
          </div>

          {/* RIGHT - ANSWER PANEL */}
          <div className="answer-panel">
            <h3>Your Answer</h3>
            {currentQ.type === 'mcq' ? (
              currentQ.options.map((opt, idx) => {
                const optionLetter = String.fromCharCode(65 + idx);
                return (
                  <label key={idx} className="option-label">
                    <input
                      type="radio"
                      name={`question-${currentQuestion}`}
                      checked={answers[currentQuestion] === optionLetter}
                      onChange={() => handleAnswerChange(currentQuestion, optionLetter)}
                    />
                    <span>
                      <strong>{optionLetter}.</strong> {opt}
                    </span>
                  </label>
                );
              })
            ) : (
              <input
                className="blank-input"
                type="text"
                value={answers[currentQuestion] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion, e.target.value)}
                placeholder="Type your answer here..."
              />
            )}
          </div>
        </div>

        {/* FOOTER - Simple Navigation */}
        <div className="quiz-footer">
          <button 
            className="footer-btn gray" 
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            Previous
          </button>
          <button className="footer-btn gray" onClick={handleSkip}>
            Skip
          </button>
          <button 
            className="footer-btn blue" 
            onClick={handleNext}
            disabled={currentQuestion === quiz.questions.length - 1}
          >
            Next
          </button>
        </div>

        {/* Video Container */}
        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="proctoring-video"
          />
        </div>

        {/* Warnings Panel */}
        {warnings.length > 0 && (
          <div className="warnings-panel">
            <h4>⚠️ Warnings ({warningCount}/3)</h4>
            {warnings.slice(-5).map((w, i) => (
              <div key={i} className="warning-item">
                {w.timestamp}: {w.message}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Result Screen
  return (
    <div className="proctored-quiz-container result-screen">
      <div className="result-content">
        <h1>✅ Quiz Submitted!</h1>
        <div className="score-circle">
          <span className="score-number">{submissionResult.percentage}%</span>
        </div>
        <div className="score-details">
          <p>Score: {submissionResult.score} / {quiz.questions.length}</p>
          <p>Correct Answers: {submissionResult.correctAnswers}</p>
          <p>Percentage: {submissionResult.percentage}%</p>
        </div>
        <button onClick={() => navigate('/student/quizzes')} className="back-btn">
          ← Back to Quizzes
        </button>
      </div>
    </div>
  );
};

export default ProctoredQuiz;