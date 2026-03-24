import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/config';
import './TakeQuiz.css';

const TakeQuiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [checking, setChecking] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const checkSubmission = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/student/login');
          return;
        }
        const res = await api.get(`/api/quizzes/check-submission/${quizId}`);
        if (isMounted) {
          if (res.data.submitted) {
            alert('You have already taken this quiz.');
            navigate('/student/quizzes');
          } else {
            setChecking(false);
          }
        }
      } catch (err) {
        console.error('Check submission error:', err);
        if (isMounted) setChecking(false);
      }
    };
    checkSubmission();
    return () => { isMounted = false; };
  }, [quizId, navigate]);

  useEffect(() => {
    if (checking) return;
    
    const fetchQuiz = async () => {
      try {
        const res = await api.get(`/api/quizzes/${quizId}`);
        
        const quizData = res.data.quiz;
        setQuiz(quizData);

        const safeTimeLimit = quizData.timeLimit > 0 ? quizData.timeLimit : 60;
        setTimeLeft(safeTimeLimit * 60);
        
        setAnswers(new Array(quizData.questions.length).fill(''));
      } catch (err) {
        console.error('Fetch quiz error:', err);
        
        if (err.response?.status === 404) {
          alert('Quiz not found. It may have been deleted.');
        } else if (err.response?.status === 401) {
          alert('Your session has expired. Please login again.');
          navigate('/student/login');
        } else {
          alert('Could not load quiz: ' + (err.response?.data?.message || err.message));
        }
        
        navigate('/student/quizzes');
      }
    };
    
    fetchQuiz();
  }, [checking, quizId, navigate]);

  useEffect(() => {
    if (!quiz || submissionResult || timeLeft === null || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft, quiz, submissionResult]);

  useEffect(() => {
    if (timeLeft === 0 && !submissionResult && !isSubmitting) {
      handleSubmit();
    }
  }, [timeLeft]);

  const handleAnswerChange = (questionIndex, value) => {
    const updated = [...answers];
    updated[questionIndex] = value;
    setAnswers(updated);
  };

  const handleSubmit = async () => {
    if (isSubmitting || submissionResult) return;
    setIsSubmitting(true);
    clearInterval(timerRef.current);

    try {
      const res = await api.post(`/api/quizzes/submit/${quizId}`, { answers });

      setSubmissionResult({
        score: res.data.score,
        percentage: res.data.percentage,
        correctAnswers: res.data.correctAnswers,
      });
    } catch (err) {
      console.error('Submit failed:', err);
      if (err.response?.status === 400 && err.response?.data?.message?.includes('already submitted')) {
        alert('You have already submitted this quiz.');
        navigate('/student/quizzes');
      } else {
        alert('Could not submit quiz: ' + (err.response?.data?.message || 'Server error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="take-quiz-container loading">
        <div className="spinner"></div>
        <p>Verifying access...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="take-quiz-container loading">
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (!submissionResult) {
    if (timeLeft === null) {
      return (
        <div className="take-quiz-container loading">
          <p>Preparing quiz...</p>
        </div>
      );
    }

    return (
      <div className="take-quiz-container">
        <h2>{quiz.title}</h2>
        <div className="timer">
          ⏱️ Time left: {Math.floor(timeLeft / 60)}:
          {(timeLeft % 60).toString().padStart(2, '0')}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {quiz.questions.map((q, i) => (
            <div key={i} className="question-block">
              <p><strong>Q{i + 1}:</strong> {q.question}</p>

              {q.type === 'mcq' ? (
                q.options.map((opt, j) => (
                  <label key={j} className="option-label">
                    <input
                      type="radio"
                      name={`q-${i}`}
                      value={opt}
                      checked={answers[i] === opt}
                      onChange={() => handleAnswerChange(i, opt)}
                    />
                    {opt}
                  </label>
                ))
              ) : (
                <input
                  type="text"
                  value={answers[i] || ''}
                  onChange={(e) => handleAnswerChange(i, e.target.value)}
                  placeholder="Type your answer"
                  className="blank-input"
                />
              )}
            </div>
          ))}

          <button type="submit" disabled={isSubmitting} className="submit-btn">
            {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="quiz-result-container">
      <h2>✅ Quiz Submitted!</h2>
      <div className="score-card">
        <h3>Your Score</h3>
        <div className="big-score">{submissionResult.score}</div>
        <p className="percentage">{submissionResult.percentage}%</p>
      </div>

      <button 
        onClick={() => setShowReview(!showReview)} 
        className="review-toggle-btn"
      >
        {showReview ? 'Hide Review' : 'Review Answers'}
      </button>

      {showReview && (
        <div className="review-section">
          <h4>Question Review</h4>
          {quiz.questions.map((q, i) => (
            <div key={i} className="result-question">
              <p><strong>Q{i + 1}:</strong> {q.question}</p>
              <p>
                Your answer:{' '}
                <span className={answers[i] === submissionResult.correctAnswers[i] ? 'correct' : 'wrong'}>
                  {answers[i] || '(not answered)'}
                </span>
              </p>
              <p>
                Correct answer:{' '}
                <span className="correct">{submissionResult.correctAnswers[i]}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => navigate('/student/quizzes')} className="back-btn">
        ← Back to Quizzes
      </button>
    </div>
  );
};

export default TakeQuiz;