import React, { useState, useEffect } from 'react';
import api from '../api/config';
import { useParams, useNavigate } from 'react-router-dom';
import './Leaderboard.css';

const Leaderboard = () => {
  const { quizId } = useParams();
  const [leaderboard, setLeaderboard] = useState([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/quizzes/${quizId}/leaderboard`);
        setLeaderboard(response.data.leaderboard || []);
        setQuizTitle(response.data.quizTitle || 'Quiz');
      } catch (error) {
        console.error('Fetch leaderboard error:', error);
        setError('Failed to load leaderboard. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [quizId]);

  if (loading) {
    return (
      <div className="leaderboard-container">
        <div className="loading-spinner">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h2>🏆 Leaderboard: {quizTitle}</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      {leaderboard.length === 0 ? (
        <div className="no-submissions">
          <p>No submissions yet for this quiz.</p>
          <p className="small-text">When students take the quiz, their scores will appear here.</p>
        </div>
      ) : (
        <>
          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-value">{leaderboard.length}</span>
              <span className="stat-label">Total Submissions</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {Math.round(leaderboard.reduce((acc, curr) => acc + curr.percentage, 0) / leaderboard.length)}%
              </span>
              <span className="stat-label">Average Score</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {leaderboard.filter(entry => entry.percentage >= 70).length}
              </span>
              <span className="stat-label">Passed (≥70%)</span>
            </div>
          </div>

          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr
                  key={index}
                  className={entry.rank <= 3 ? `rank-${entry.rank} top-three` : ''}
                >
                  <td>
                    {entry.rank === 1 && '🥇 '}
                    {entry.rank === 2 && '🥈 '}
                    {entry.rank === 3 && '🥉 '}
                    {entry.rank}
                  </td>
                  <td>{entry.studentName}</td>
                  <td>
                    <strong>{entry.score}</strong> / {entry.total}
                  </td>
                  <td>
                    <span className={`percentage-badge ${entry.percentage >= 70 ? 'success' : 'warning'}`}>
                      {entry.percentage}%
                    </span>
                  </td>
                  <td>{new Date(entry.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      
      <button onClick={() => navigate('/teacher/leaderboard')} className="back-btn">
        ← Back to Quiz Selection
      </button>
    </div>
  );
};

export default Leaderboard;