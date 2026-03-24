// src/components/Student/StudentDashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/config"; // Import the configured API instance
import {
  FileText,
  BookOpen,
  Trophy,
  Video,
  Calendar,
} from "lucide-react";
import "./StudentDashboard.css";
// import studentImage from "../../assets/student.png"; // Commented out if not used

function StudentDashboard() {
  const [approved, setApproved] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/student/login");
        return;
      }

      try {
        // Check approval status
        const approvalRes = await api.get("/api/students/check-approval");

        setApproved(approvalRes.data.isApproved);

        if (approvalRes.data.isApproved) {
          // Get profile
          const profileRes = await api.get("/api/students/profile");
          
          const fullName = `${profileRes.data.firstName || ''} ${profileRes.data.lastName || ''}`.trim() || 'Student';
          const email = profileRes.data.email || '';
          
          setStudentName(fullName);
          setStudentEmail(email);
          
          // Store in localStorage for other components
          localStorage.setItem('currentStudentName', fullName);
          localStorage.setItem('currentStudentEmail', email);
          localStorage.setItem('userId', profileRes.data._id || `student_${Date.now()}`);
          
          // Get notifications
          setNotifications(profileRes.data.notifications || []);
          
          // Load recent attendance
          loadRecentAttendance(fullName);
        }
      } catch (err) {
        console.error('Dashboard init error:', err);
        if (err.response?.status === 403) {
          alert("Account not approved yet.");
        } else {
          // Don't navigate away immediately, check if token exists
          if (!localStorage.getItem("token")) {
            navigate("/student/login");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  const loadRecentAttendance = (studentName) => {
    try {
      const attendance = [];
      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('attendance_')) {
          try {
            const storedValue = localStorage.getItem(key);
            if (!storedValue) continue;
            
            // Parse the stored value
            const records = JSON.parse(storedValue);
            
            // Check if records is an array before using filter
            if (Array.isArray(records)) {
              // Find records matching this student
              const myRecords = records.filter(r => 
                r.userName === studentName || 
                r.userId === localStorage.getItem('userId')
              );
              
              if (myRecords.length > 0) {
                attendance.push({
                  meetingId: key.replace('attendance_', ''),
                  ...myRecords[0]
                });
              }
            } else if (records && typeof records === 'object') {
              // If it's a single object, not an array
              if (records.userName === studentName || records.userId === localStorage.getItem('userId')) {
                attendance.push({
                  meetingId: key.replace('attendance_', ''),
                  ...records
                });
              }
            }
          } catch (e) {
            console.error('Error parsing attendance for key:', key, e);
            // Continue to next key even if this one fails
          }
        }
      }
      
      // Sort by date (newest first) and take last 3
      const sortedAttendance = attendance.sort((a, b) => {
        const dateA = a.joinedAt ? new Date(a.joinedAt) : new Date(0);
        const dateB = b.joinedAt ? new Date(b.joinedAt) : new Date(0);
        return dateB - dateA;
      });
      
      setRecentAttendance(sortedAttendance.slice(0, 3));
    } catch (error) {
      console.error('Error loading attendance:', error);
      setRecentAttendance([]); // Set empty array on error
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentStudentName");
    localStorage.removeItem("currentStudentEmail");
    localStorage.removeItem("userId");
    navigate("/student/login");
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Present';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  if (loading) return <div className="loading-screen">Loading dashboard...</div>;

  if (!approved) {
    return (
      <div className="awaiting-approval">
        <h2>Awaiting Teacher Approval</h2>
        <p>Your account is waiting for teacher approval. You will be notified via email once approved.</p>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>
    );
  }

  return (
    <div className="student-dashboard-page">
      {/* HEADER */}
      <div className="dashboard-header">
        <h1>Welcome, {studentName}</h1>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* SECTION TITLE */}
      <h2 className="section-title">Quick Actions</h2>

      {/* ACTION CARDS */}
      <div className="actions-grid">
        <div className="action-card" onClick={() => navigate("/student/quizzes")}>
          <div className="icon-box">
            <FileText />
          </div>
          <p>Quizzes & Assignments</p>
        </div>

        <div className="action-card" onClick={() => navigate("/student/lms")}>
          <div className="icon-box">
            <BookOpen />
          </div>
          <p>Learning Materials</p>
        </div>

        <div className="action-card" onClick={() => navigate("/student/leaderboard")}>
          <div className="icon-box">
            <Trophy />
          </div>
          <p>Leaderboard</p>
        </div>

        <div className="action-card" onClick={() => navigate("/meeting-links")}>
          <div className="icon-box">
            <Video />
          </div>
          <p>Live Meetings</p>
        </div>

        <div className="action-card" onClick={() => navigate("/student/attendance")}>
          <div className="icon-box">
            <Calendar />
          </div>
          <p>Attendance</p>
        </div>
      </div>

      {/* Optional: Display recent attendance if available */}
      {recentAttendance.length > 0 && (
        <div className="recent-attendance">
          <h3>Recent Attendance</h3>
          <ul>
            {recentAttendance.map((att, index) => (
              <li key={index}>
                Meeting: {att.meetingId} - Joined: {formatDate(att.joinedAt)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;