// src/components/Teacher/StudentApprovalSection.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Add this import
import api from "../../api/config";
import "./StudentApprovalSection.css";

const StudentApprovalSection = () => {
  const [students, setStudents] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const navigate = useNavigate(); // Add navigate hook

  useEffect(() => {
    fetchRegisteredStudents();
    fetchAllTeachers();
  }, []);

  /* ===============================
     FETCH REGISTERED STUDENTS
     =============================== */
  const fetchRegisteredStudents = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/teachers/registered-students");
      if (response.data.success) {
        setStudents(response.data.students);
      } else {
        setStudents(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching students:", error.response?.data || error.message);
      setMessage('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     FETCH ALL TEACHERS
     =============================== */
  const fetchAllTeachers = async () => {
    try {
      const response = await api.get("/api/teachers/all-teachers");
      if (response.data.success) {
        setAllTeachers(response.data.teachers || []);
      }
    } catch (error) {
      console.error("Error fetching teachers:", error.response?.data || error.message);
    }
  };

  /* ===============================
     APPROVE/ASSIGN STUDENT
     =============================== */
  const handleApproveStudent = async (studentId) => {
    try {
      const response = await api.post("/api/teachers/approve-student", { studentId });
      setMessage(response.data.message || 'Student assigned successfully');
      fetchRegisteredStudents(); // Refresh the list
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error approving student:", error.response?.data || error.message);
      setMessage(error.response?.data?.message || 'Failed to assign student');
      setTimeout(() => setMessage(""), 3000);
    }
  };

  /* ===============================
     ASSIGN TO OTHER TEACHER
     =============================== */
  const handleAssignToOther = async (studentId, teacherId) => {
    try {
      const response = await api.post("/api/teachers/approve-student", { 
        studentId, 
        teacherId 
      });
      setMessage(response.data.message || 'Student assigned successfully');
      fetchRegisteredStudents();
      setShowAssignModal(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error assigning student:", error.response?.data || error.message);
      setMessage(error.response?.data?.message || 'Failed to assign student');
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const openAssignModal = (student) => {
    setSelectedStudent(student);
    setShowAssignModal(true);
  };

  const goToDashboard = () => {
    navigate("/teacher/dashboard");
  };

  const currentTeacherId = localStorage.getItem("teacherId");

  if (loading) {
    return (
      <div className="students-section">
        <h2>Student Management</h2>
        <p className="loading">Loading students...</p>
      </div>
    );
  }

  return (
    <div className="students-section">
      {/* Header with back button */}
      <div className="section-header">
        
        <h2>Student Management</h2>
      </div>
      
      {message && (
        <div className={`status-message ${message.includes("Failed") ? "error" : "success"}`}>
          {message}
        </div>
      )}

      {students.length === 0 ? (
        <p className="empty-list">No students registered yet.</p>
      ) : (
        <>
          <div className="students-header">
            <span>Student</span>
            <span>Email</span>
            <span>Teachers</span>
            <span>Actions</span>
          </div>
          
          <ul className="students-list">
            {students.map((student) => {
              const isMine = student.teachers?.some(t => t._id === currentTeacherId);
              
              return (
                <li key={student._id} className="student-row">
                  <div className="student-info">
                    <strong>{student.firstName} {student.lastName}</strong>
                  </div>
                  
                  <div className="student-email">
                    {student.email}
                  </div>
                  
                  <div className="teachers-list">
                    {student.teachers?.length > 0 ? (
                      student.teachers.map(teacher => (
                        <span key={teacher._id} className="teacher-tag">
                          {teacher.firstName} {teacher.lastName}
                          {teacher._id === currentTeacherId && " (You)"}
                        </span>
                      ))
                    ) : (
                      <span className="no-teachers">No teachers assigned</span>
                    )}
                  </div>
                  
                  <div className="student-actions">
                    {!isMine && (
                      <button 
                        onClick={() => handleApproveStudent(student._id)}
                        className="assign-button"
                      >
                        Assign to Me
                      </button>
                    )}
                    {isMine && <span className="already-assigned">✓ Assigned</span>}
                    
                    <button
                      onClick={() => openAssignModal(student)}
                      className="assign-other-btn"
                    >
                      Assign to Other
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Bottom action buttons */}
      <div className="section-footer">
        <button onClick={goToDashboard} className="dashboard-btn">
          Go to Dashboard
        </button>
      </div>

      {/* Assign to Other Teacher Modal */}
      {showAssignModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="assign-modal">
            <h3>Assign {selectedStudent.firstName} {selectedStudent.lastName} to Teacher</h3>
            
            <div className="teacher-list">
              {allTeachers.length === 0 ? (
                <p className="no-teachers-available">No teachers available</p>
              ) : (
                allTeachers
                  .filter(teacher => {
                    return !selectedStudent.teachers?.some(t => t._id === teacher._id);
                  })
                  .map(teacher => (
                    <div key={teacher._id} className="teacher-option">
                      <span>
                        {teacher.firstName} {teacher.lastName}
                        {teacher._id === currentTeacherId && " (You)"}
                      </span>
                      <button
                        onClick={() => handleAssignToOther(selectedStudent._id, teacher._id)}
                        className="assign-btn"
                      >
                        Assign
                      </button>
                    </div>
                  ))
              )}
            </div>
            
            <button
              className="close-modal"
              onClick={() => setShowAssignModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentApprovalSection;