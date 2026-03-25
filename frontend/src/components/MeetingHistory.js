// src/components/MeetingHistory.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/config';
import './MeetingHistory.css';

const MeetingHistory = ({ role = 'student' }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate(`/${role}/login`);
          return;
        }

        let endpoint = '';
        if (role === 'teacher') {
          endpoint = '/api/teachers/meetings';
        } else {
          endpoint = '/api/students/meetings';
        }

        const response = await api.get(endpoint);

        const fetchedMeetings = response.data.meetings || response.data || [];
        setMeetings(fetchedMeetings);

        if (response.data.message) {
          setInfoMessage(response.data.message);
        }

        setError('');
      } catch (err) {
        console.error('Fetch meetings error:', err);
        if (err.response?.status === 404 || err.response?.status === 500) {
          setMeetings([]);
          setInfoMessage(
            err.response?.data?.message ||
            `No ${role === 'teacher' ? 'created' : 'available'} meetings yet.`
          );
        } else {
          setError('Failed to load meetings. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, [role, navigate]);

  const copyLink = (meetingId) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  };

  const handleAction = (meetingId) => {
    if (role === 'teacher') {
      navigate(`/teacher/meeting/${meetingId}`);
    } else {
      navigate(`/meeting/${meetingId}`);
    }
  };

  const pageTitle = role === 'teacher' ? 'Meetings Links' : 'Your Meeting Links';
  const noMeetingsText =
    role === 'teacher'
      ? 'You have not created any meetings yet.'
      : 'No meetings available yet. Check back later or contact your teacher.';
  const actionButtonText = role === 'teacher' ? 'Join as Teacher' : 'Join Meeting';

  // Separate meetings into active and ended
  const activeMeetings = meetings.filter(m => m.isActive === true);
  const endedMeetings = meetings.filter(m => m.isActive === false);

  if (loading) {
    return <div className="meeting-history-loading">Loading meetings...</div>;
  }

  return (
    <div className="meeting-history-container">
      <h2>{pageTitle}</h2>

      {error && <p className="error">{error}</p>}
      {infoMessage && <p className="info">{infoMessage}</p>}

      {meetings.length > 0 ? (
        <div className="meetings-list">
          
          {/* Active Meetings Section */}
          {activeMeetings.length > 0 && (
            <>
              <h3 className="section-title">Active Meetings 🟢</h3>
              {activeMeetings.map((meeting) => (
                <div key={meeting._id || meeting.meetingId} className="meeting-item active">
                  <div className="meeting-info">
                    <h3>{meeting.title || 'Untitled Meeting'}</h3>
                    <p>
                      {role === 'teacher' ? 'Created' : 'Available'}:{' '}
                      {new Date(meeting.createdAt).toLocaleString()}
                    </p>
                    <small className="meeting-id">ID: {meeting.meetingId}</small>
                    <p className="meeting-status active">
                      Status: Active 🟢
                    </p>
                  </div>

                  <div className="meeting-actions">
                    <button
                      className="action-btn join-btn"
                      onClick={() => handleAction(meeting.meetingId)}
                    >
                      {actionButtonText}
                    </button>

                    {role === 'teacher' && (
                      <button
                        className="action-btn copy-btn"
                        onClick={() => copyLink(meeting.meetingId)}
                      >
                        Copy Link
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Ended Meetings Section */}
          {endedMeetings.length > 0 && (
            <>
              <h3 className="section-title ended">Completed Meetings 🔴</h3>
              {endedMeetings.map((meeting) => (
                <div key={meeting._id || meeting.meetingId} className="meeting-item ended">
                  <div className="meeting-info">
                    <h3>{meeting.title || 'Untitled Meeting'}</h3>
                    <p>
                      {role === 'teacher' ? 'Created' : 'Available'}:{' '}
                      {new Date(meeting.createdAt).toLocaleString()}
                    </p>
                    <small className="meeting-id">ID: {meeting.meetingId}</small>
                    {meeting.endedAt && (
                      <p className="meeting-ended-time">
                        Ended: {new Date(meeting.endedAt).toLocaleString()}
                      </p>
                    )}
                    <p className="meeting-status ended">
                      Status: Ended 🔴
                    </p>
                  </div>

                  <div className="meeting-actions">
                    <button
                      className="action-btn join-btn disabled"
                      disabled={true}
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    >
                      Meeting Ended
                    </button>

                    {role === 'teacher' && (
                      <button
                        className="action-btn copy-btn"
                        onClick={() => copyLink(meeting.meetingId)}
                      >
                        Copy Link
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        !error && <p className="no-meetings">{noMeetingsText}</p>
      )}

      <div className="back-section">
        <button
          onClick={() => navigate(`/${role}/dashboard`)}
          className="back-btn"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default MeetingHistory;