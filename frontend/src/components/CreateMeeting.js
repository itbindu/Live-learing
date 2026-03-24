// src/components/CreateMeeting.js
import React, { useState } from 'react';
import api from '../api/config';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './CreateMeeting.css';

const CreateMeeting = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMeetingLink('');
    try {
      const response = await api.post('/api/teachers/create-meeting', { title });

      setMessage(response.data.message);
      setMeetingLink(response.data.link);
      setMeetingId(response.data.meetingId);
      setTitle('');
    } catch (error) {
      setMessage('Failed to create meeting: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const startMeeting = () => {
    if (meetingId) {
      navigate(`/teacher/meeting/${meetingId}`);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(meetingLink);
    setMessage('Link copied to clipboard!');
  };

  return (
    <div className="create-meeting-wrapper">
      <div className="create-meeting-container">
        {/* BACK ARROW */}
        <button
          className="back-arrow"
          onClick={() => navigate("/teacher/dashboard")}
          title="Back to Dashboard"
        >
          <ArrowLeft size={20} />
        </button>

        <h2>Create Meeting</h2>

        <form onSubmit={handleCreateMeeting}>
          <input
            type="text"
            placeholder="Meeting Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Meeting"}
          </button>
        </form>

        {message && <p className="success-message">{message}</p>}

        {meetingLink && (
          <div className="meeting-link-section">
            <h3>Your Meeting Link</h3>

            <input
              type="text"
              value={meetingLink}
              readOnly
              className="link-input"
            />

            <div className="link-actions">
              <button onClick={copyToClipboard} className="copy-btn">
                Copy Link
              </button>

              <button onClick={startMeeting} className="start-btn">
                Start Meeting
              </button>
            </div>

            <p className="helper-text">
              Share this link with approved students.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateMeeting;