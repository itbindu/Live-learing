// src/components/AttendanceTracker.js
import React, { useState, useEffect } from 'react';
import { Clock, Users, Download, Calendar } from 'lucide-react';
import './AttendanceTracker.css';

const AttendanceTracker = ({ meetingId, userId, userName, role, participants }) => {
  const [attendance, setAttendance] = useState([]);
  const [meetingStartTime, setMeetingStartTime] = useState(null);
  const [meetingDuration, setMeetingDuration] = useState('00:00:00');
  const [myAttendance, setMyAttendance] = useState({
    joinedAt: null,
    leftAt: null,
    duration: '00:00'
  });

  useEffect(() => {
    const loadAttendance = () => {
      const storedAttendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
      
      if (storedAttendance.length === 0) {
        const startTime = new Date();
        setMeetingStartTime(startTime);
        
        const studentId = userId || 
                          localStorage.getItem('userId') || 
                          localStorage.getItem('studentId') || 
                          `student_${Date.now()}`;
        
        const newAttendance = [{
          userId: studentId,
          userName: userName || localStorage.getItem('currentStudentName') || 'Student',
          role: role || 'student',
          email: localStorage.getItem('currentStudentEmail') || '',
          joinedAt: startTime.toISOString(),
          leftAt: null,
          duration: '00:00'
        }];
        
        localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(newAttendance));
        setAttendance(newAttendance);
        setMyAttendance(newAttendance[0]);
      } else {
        setAttendance(storedAttendance);
        const myRecord = storedAttendance.find(r => r.userId === userId);
        if (myRecord) setMyAttendance(myRecord);
        
        if (storedAttendance.length > 0) {
          setMeetingStartTime(new Date(storedAttendance[0].joinedAt));
        }
      }
    };
    
    loadAttendance();
    
    const durationTimer = setInterval(() => {
      if (meetingStartTime) {
        const elapsed = new Date() - meetingStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        setMeetingDuration(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
      
      if (myAttendance.joinedAt && !myAttendance.leftAt) {
        const joined = new Date(myAttendance.joinedAt);
        const now = new Date();
        const diffMs = now - joined;
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        const duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        setMyAttendance(prev => ({ ...prev, duration }));
        
        const updatedAttendance = attendance.map(record =>
          record.userId === userId
            ? { ...record, duration }
            : record
        );
        localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
        setAttendance(updatedAttendance);
      }
    }, 1000);
    
    return () => clearInterval(durationTimer);
  }, [meetingId, userId, userName, role, meetingStartTime]);

  useEffect(() => {
    if (participants && participants.length > 0) {
      const currentAttendance = [...attendance];
      let updated = false;
      
      participants.forEach(participant => {
        const existing = currentAttendance.find(r => r.userId === participant.userId);
        if (!existing) {
          currentAttendance.push({
            userId: participant.userId,
            userName: participant.userName,
            role: participant.role,
            joinedAt: participant.joinedAt || new Date().toISOString(),
            leftAt: null,
            duration: '00:00'
          });
          updated = true;
        }
      });
      
      if (updated) {
        localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(currentAttendance));
        setAttendance(currentAttendance);
      }
    }
  }, [participants, meetingId]);

  const exportAttendanceCSV = () => {
    const csvHeaders = ['Name', 'Role', 'Joined At', 'Left At', 'Duration (mm:ss)', 'Status'];
    
    const csvRows = attendance.map(record => [
      record.userName,
      record.role,
      new Date(record.joinedAt).toLocaleString(),
      record.leftAt ? new Date(record.leftAt).toLocaleString() : 'Still Present',
      record.duration,
      record.leftAt ? 'Left' : 'Present'
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${meetingId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="attendance-tracker">
      <div className="attendance-summary">
        <div className="summary-item">
          <Clock size={16} />
          <span className="summary-label">Meeting Duration:</span>
          <span className="summary-value">{meetingDuration}</span>
        </div>
        
        <div className="summary-item">
          <Users size={16} />
          <span className="summary-label">Total Participants:</span>
          <span className="summary-value">{attendance.length}</span>
        </div>
        
        <div className="summary-item">
          <Calendar size={16} />
          <span className="summary-label">Your Attendance:</span>
          <span className="summary-value">{myAttendance.duration}</span>
        </div>
      </div>
      
      {role === 'teacher' && (
        <div className="attendance-controls">
          <button className="export-btn" onClick={exportAttendanceCSV}>
            <Download size={16} />
            Export Attendance Report
          </button>
        </div>
      )}
      
      {role === 'teacher' && (
        <div className="attendance-details">
          <h4>Attendance Details</h4>
          <div className="attendance-table">
            <div className="table-header">
              <div className="table-cell">Name</div>
              <div className="table-cell">Role</div>
              <div className="table-cell">Joined</div>
              <div className="table-cell">Left</div>
              <div className="table-cell">Duration</div>
              <div className="table-cell">Status</div>
            </div>
            
            {attendance.map(record => (
              <div key={record.userId} className="table-row">
                <div className="table-cell user-name-cell">
                  <span className="user-name">{record.userName}</span>
                  {record.userId === userId && <span className="you-tag">(You)</span>}
                </div>
                <div className="table-cell">
                  <span className={`role-tag ${record.role}`}>
                    {record.role === 'teacher' ? 'Host' : 'Student'}
                  </span>
                </div>
                <div className="table-cell">
                  {new Date(record.joinedAt).toLocaleTimeString()}
                </div>
                <div className="table-cell">
                  {record.leftAt 
                    ? new Date(record.leftAt).toLocaleTimeString()
                    : <span className="present">Present</span>
                  }
                </div>
                <div className="table-cell">{record.duration}</div>
                <div className="table-cell">
                  <span className={`status ${record.leftAt ? 'left' : 'present'}`}>
                    {record.leftAt ? 'Left' : 'Active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;