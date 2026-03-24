// src/components/Teacher/TeacherDashboard.js
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/config";
import './TeacherDashboard.css';
import { 
  Calendar, 
  Video, 
  CalendarDays, 
  FileText, 
  Trophy, 
  BookOpen, 
  BarChart3,
  Users,
  ClipboardList // Add this import for the quiz list icon
} from 'lucide-react';

const TeacherDashboard = () => {
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [showApprovalPage, setShowApprovalPage] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState('');
  const [teacherName, setTeacherName] = useState('Teacher');
  const [teacherId, setTeacherId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeacherProfile();
    fetchRegisteredStudents();
    fetchAllStudents();
  }, []);

  const fetchTeacherProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      const response = await api.get("/api/teachers/profile");
      const fullName = `${response.data.firstName || ''} ${response.data.lastName || ''}`.trim();
      setTeacherName(fullName || 'Teacher');
      
      // Store teacherId for later use
      if (response.data._id) {
        localStorage.setItem('teacherId', response.data._id);
        setTeacherId(response.data._id);
      }
    } catch (error) {
      console.error("Error fetching teacher profile:", error.response?.data || error.message);
      const stored = JSON.parse(localStorage.getItem('teacherUser') || '{}');
      const fullName = `${stored.firstName || ''} ${stored.lastName || ''}`.trim();
      setTeacherName(fullName || 'Teacher');
      
      const storedTeacherId = localStorage.getItem('teacherId');
      if (storedTeacherId) {
        setTeacherId(storedTeacherId);
      }
    }
  };

  const fetchRegisteredStudents = async () => {
    try {
      const response = await api.get("/api/teachers/registered-students");
      if (response.data.success) {
        setRegisteredStudents(response.data.students);
      } else {
        setRegisteredStudents(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching students:", error.response?.data || error.message);
      setMessage('Failed to load students');
    }
  };

  const fetchAllStudents = async () => {
    try {
      const response = await api.get("/api/teachers/all-students");
      if (response.data.success) {
        setStudents(response.data.students);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error("Error fetching all students:", error.response?.data || error.message);
      setStudents([]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem('teacherUser');
    localStorage.removeItem('teacherId');
    navigate("/teacher/login");
  };

  return (
    <div className="teacher-dashboard">
      {/* HEADER */}
      <header className="dashboard-header">
        <h1>Welcome, {teacherName}!</h1>
        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {/* QUICK ACTIONS */}
      <h2 className="section-title">Quick Actions</h2>

      <section className="quick-actions">
        <Link className="action-card" to="/teacher/create-meeting">
          <Video className="card-icon" size={42} />
          Create Meeting
        </Link>

        <Link className="action-card" to="/teacher/my-meetings">
          <CalendarDays className="card-icon" size={42} />
          My Meetings
        </Link>

        <Link className="action-card" to="/teacher/create-quiz">
          <FileText className="card-icon" size={42} />
          Create Quiz
        </Link>

        {/* NEW: Quiz List Link - Add this right after Create Quiz */}
        <Link className="action-card" to="/teacher/quiz-list">
          <ClipboardList className="card-icon" size={42} />
          My Quiz List
        </Link>

        <Link className="action-card" to="/teacher/leaderboard">
          <Trophy className="card-icon" size={42} />
          Leaderboard
        </Link>

        <Link className="action-card" to="/teacher/lms">
          <BookOpen className="card-icon" size={42} />
          Course Materials
        </Link>

        <Link className="action-card" to="/teacher/attendance">
          <BarChart3 className="card-icon" size={42} />
          Attendance Records
        </Link>

        {/* Student Approval Navigation Button */}
        <Link className="action-card" to="/teacher/student-approval">
          <Users className="card-icon" size={42} />
          Student Approval
        </Link>
      </section>

      {/* REGISTERED STUDENTS */}
    </div>
  );
};

export default TeacherDashboard;