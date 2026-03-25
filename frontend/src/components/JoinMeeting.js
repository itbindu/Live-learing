// src/components/JoinMeeting.js
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./JoinMeeting.css";

const JoinMeeting = () => {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  useEffect(() => {
    fetchMeeting();
  }, [meetingId]);

  const fetchMeeting = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/students/meeting/${meetingId}`);
      setMeeting(response.data.meeting);
    } catch (error) {
      setMessage("Meeting not found or inactive.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_URL}/api/students/join-meeting/${meetingId}`, { name, email });
      setJoined(true);
      
      // 🔥 FIX: Create consistent userId based on email (NO TIMESTAMP)
      let studentId = localStorage.getItem(`studentId_${email}`);
      if (!studentId) {
        studentId = `student_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        localStorage.setItem(`studentId_${email}`, studentId);
        console.log("✅ Created student ID:", studentId);
      } else {
        console.log("✅ Using existing student ID:", studentId);
      }
      
      localStorage.setItem("currentStudentName", name);
      localStorage.setItem("studentEmail", email);
      localStorage.setItem("meetingUserId", studentId);

      navigate(`/meeting-room/${meetingId}`);
    } catch (error) {
      setMessage("Failed to join: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading meeting...</div>;
  if (!meeting) return <div className="loading">{message}</div>;

  return (
    <div className="join-page">
      <div className="back-arrow" onClick={() => navigate("/student/dashboard")}>←</div>
      <div className="join-card">
        <h2>Join Meeting</h2>
        <div className="meeting-info">
          <p className="meeting-title">{meeting.title}</p>
          <p className="host">Hosted by {meeting.teacherId?.firstName} {meeting.teacherId?.lastName}</p>
          <p className="meeting-id-info">Meeting ID: {meetingId}</p>
        </div>
        {!joined ? (
          <form onSubmit={handleJoin}>
            <div className="input-group">
              <label>Your Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Your Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="join-btn" type="submit">Join Meeting</button>
          </form>
        ) : (
          <div className="welcome"><h3>Welcome {name}!</h3><p>Redirecting...</p></div>
        )}
        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
};

export default JoinMeeting;