// src/components/Teacher/TeacherLeaderboardSelection.js
import React, { useState, useEffect } from 'react';
import api from '../../api/config';
import { useNavigate, Link } from 'react-router-dom';
import './TeacherLeaderboardSelection.css';

const TeacherLeaderboardSelection = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuizzesWithStats();
  }, []);

  const fetchQuizzesWithStats = async () => {
    try {
      const response = await api.get('/api/quizzes/my-quizzes');

      const quizzesData = response.data.quizzes || [];
      
      const quizzesWithStats = await Promise.all(
        quizzesData.map(async (quiz) => {
          try {
            const statsRes = await api.get(`/api/quizzes/${quiz._id}/stats`);
            return {
              ...quiz,
              submissions: statsRes.data.submissions || 0,
              avgScore: statsRes.data.avgScore || 0
            };
          } catch (error) {
            return {
              ...quiz,
              submissions: 0,
              avgScore: 0
            };
          }
        })
      );

      setQuizzes(quizzesWithStats);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
      setError('Could not load quizzes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="leaderboard-selection-container">
        <div className="loading-spinner">Loading your quizzes...</div>
      </div>
    );
  }

  return (
    <div className="leaderboard-selection-container">
      <div className="leaderboard-header">
        <h2>🏆 Quiz Leaderboards</h2>
        <p>Select a quiz to view student performance and rankings</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {quizzes.length === 0 ? (
        <div className="no-quizzes">
          <div className="empty-state-icon">📝</div>
          <h3>No Quizzes Available</h3>
          <p>You haven't created any quizzes yet.</p>
          <Link to="/teacher/create-quiz" className="create-quiz-btn">
            Create Your First Quiz
          </Link>
        </div>
      ) : (
        <div className="quizzes-leaderboard-grid">
          {quizzes.map(quiz => (
            <div key={quiz._id} className="quiz-leaderboard-card">
              <div className="quiz-card-header">
                <h3>{quiz.title}</h3>
                <span className="quiz-date">
                  {new Date(quiz.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="quiz-stats">
                <div className="stat-item">
                  <span className="stat-label">Questions</span>
                  <span className="stat-value">{quiz.questions?.length || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Time Limit</span>
                  <span className="stat-value">{quiz.timeLimit} min</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Submissions</span>
                  <span className="stat-value submission-count">{quiz.submissions}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Avg. Score</span>
                  <span className="stat-value">{quiz.avgScore}%</span>
                </div>
              </div>

              {quiz.submissions > 0 ? (
                <Link 
                  to={`/teacher/leaderboard/${quiz._id}`} 
                  className="view-leaderboard-btn"
                >
                  View Leaderboard →
                </Link>
              ) : (
                <button className="no-submissions-btn" disabled>
                  No Submissions Yet
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={() => navigate('/teacher/dashboard')} className="back-btn">
        ← Back to Dashboard
      </button>
    </div>
  );
};

export default TeacherLeaderboardSelection;