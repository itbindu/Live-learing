import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/config';

const QuizResult = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await api.get(`/api/quizzes/result/${quizId}`);
        setResult(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchResult();
  }, [quizId]);

  if (!result) return <p>Loading result...</p>;

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', position: 'relative' }}>

      {/* 🔥 BACK BUTTON */}
      <button
        onClick={() => navigate('/student/quizzes')}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: '#1e293b',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '18px'
        }}
      >
        ←
      </button>

      <h1>✅ Quiz Result</h1>
      <h2>{result.score} / {result.total}</h2>
      <h3>{result.percentage}%</h3>

    </div>
  );
};

export default QuizResult;