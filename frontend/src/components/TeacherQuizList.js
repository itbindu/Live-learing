import React, { useState, useEffect } from 'react';
import api from '../api/config';
import { useNavigate, Link } from 'react-router-dom';
import './TeacherQuizList.css';

const TeacherQuizList = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const response = await api.get('/api/quizzes/my-quizzes');
      
      setQuizzes(response.data.quizzes || []);
      
      const statsPromises = response.data.quizzes.map(async (quiz) => {
        try {
          const statsRes = await api.get(`/api/quizzes/${quiz._id}/stats`);
          return { quizId: quiz._id, ...statsRes.data };
        } catch (error) {
          return { quizId: quiz._id, submissions: 0, avgScore: 0 };
        }
      });
      
      const statsResults = await Promise.all(statsPromises);
      const statsMap = {};
      statsResults.forEach(stat => {
        statsMap[stat.quizId] = stat;
      });
      setStats(statsMap);
      
    } catch (error) {
      console.error('Failed to load quizzes:', error);
      alert('Could not load quizzes: ' + (error.response?.data?.message || error.message || 'Server error'));
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.delete(`/api/quizzes/${quizId}`);
      
      setQuizzes(quizzes.filter(q => q._id !== quizId));
      alert('Quiz deleted successfully');
    } catch (error) {
      alert('Failed to delete quiz: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) {
    return (
      <div className="teacher-quiz-list">
        <div className="loading-spinner">Loading your quizzes...</div>
      </div>
    );
  }

  return (
    <div className="teacher-quiz-list">
      <div className="quiz-list-header">
        <h2>My Quizzes</h2>
        <button onClick={() => navigate('/teacher/create-quiz')} className="create-quiz-btn">
          + Create New Quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="no-quizzes">
          <p>You haven't created any quizzes yet.</p>
          <button onClick={() => navigate('/teacher/create-quiz')} className="create-first-quiz-btn">
            Create Your First Quiz
          </button>
        </div>
      ) : (
        <div className="quizzes-table-container">
          <table className="quizzes-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Questions</th>
                <th>Time Limit</th>
                <th>Created</th>
                <th>Submissions</th>
                <th>Avg. Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz._id}>
                  <td className="quiz-title-cell">
                    <strong>{quiz.title}</strong>
                  </td>
                  <td>{quiz.questions?.length || 0}</td>
                  <td>{quiz.timeLimit} min</td>
                  <td>{new Date(quiz.createdAt).toLocaleDateString()}</td>
                  <td className="submissions-count">
                    {stats[quiz._id]?.submissions || 0}
                    {stats[quiz._id]?.submissions > 0 && (
                      <span className="view-submissions" onClick={() => navigate(`/teacher/leaderboard/${quiz._id}`)}>
                        View
                      </span>
                    )}
                  </td>
                  <td className="avg-score">
                    {stats[quiz._id]?.avgScore ? `${stats[quiz._id].avgScore}%` : 'N/A'}
                  </td>
                  <td className="actions-cell">
                    <Link to={`/teacher/leaderboard/${quiz._id}`} className="action-btn view-btn">
                      📊 Leaderboard
                    </Link>
                    <Link to={`/teacher/quiz/${quiz._id}/edit`} className="action-btn edit-btn">
                      ✏️ Edit
                    </Link>
                    <button 
                      onClick={() => deleteQuiz(quiz._id)} 
                      className="action-btn delete-btn"
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="back-to-dashboard">
        <button onClick={() => navigate('/teacher/dashboard')} className="back-btn">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default TeacherQuizList;