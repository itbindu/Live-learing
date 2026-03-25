// src/components/AttendancePage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, Download, ArrowLeft, Video } from 'lucide-react';
import { API_URL } from '../api/config';
import './AttendancePage.css';

const AttendancePage = ({ role = 'student' }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingDetails, setMeetingDetails] = useState(null);
  const [allMeetings, setAllMeetings] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadAllAttendanceFromServer();
  }, [role]);

  // ============ LOAD FROM MONGODB (NOT localStorage) ============
  const loadAllAttendanceFromServer = async () => {
    setLoading(true);
    try {
      // Fetch all meetings from server
      const response = await fetch(`${API_URL}/api/attendance/all`);
      const data = await response.json();
      
      if (data.success && data.meetings) {
        // Group records by meetingId
        const meetingsMap = new Map();
        
        data.meetings.forEach(meeting => {
          if (meeting.records && meeting.records.length > 0) {
            meetingsMap.set(meeting.meetingId, {
              meetingId: meeting.meetingId,
              records: meeting.records,
              allParticipants: meeting.records.length
            });
          }
        });
        
        // Convert to array and sort by most recent
        const meetings = Array.from(meetingsMap.values());
        meetings.sort((a, b) => {
          const dateA = a.records[0]?.joinedAt ? new Date(a.records[0].joinedAt) : new Date(0);
          const dateB = b.records[0]?.joinedAt ? new Date(b.records[0].joinedAt) : new Date(0);
          return dateB - dateA;
        });
        
        setAttendanceRecords(meetings);
        setAllMeetings(meetings);
      }
    } catch (error) {
      console.error('Error loading attendance from server:', error);
      // Fallback to localStorage if server fails
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Fallback function (kept for compatibility)
  const loadFromLocalStorage = () => {
    try {
      const allRecords = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('attendance_')) {
          const meetingId = key.replace('attendance_', '');
          const records = JSON.parse(localStorage.getItem(key) || '[]');
          
          if (records && Array.isArray(records) && records.length > 0) {
            allRecords.push({
              meetingId,
              records: records,
              allParticipants: records.length
            });
          }
        }
      }
      
      allRecords.sort((a, b) => {
        const dateA = a.records[0]?.joinedAt ? new Date(a.records[0].joinedAt) : new Date(0);
        const dateB = b.records[0]?.joinedAt ? new Date(b.records[0].joinedAt) : new Date(0);
        return dateB - dateA;
      });
      
      setAttendanceRecords(allRecords);
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  };

  const viewMeetingDetails = (meetingId, records) => {
    setSelectedMeeting(meetingId);
    setMeetingDetails(records);
  };

  const calculateMeetingDuration = (records) => {
    if (!records || !Array.isArray(records) || records.length === 0) {
      return '00:00:00';
    }
    
    const validRecords = records.filter(r => r && r.joinedAt);
    if (validRecords.length === 0) return '00:00:00';
    
    const startTimes = validRecords.map(r => {
      try {
        return new Date(r.joinedAt).getTime();
      } catch {
        return Date.now();
      }
    });
    
    const endTimes = validRecords.map(r => {
      if (r.leftAt) {
        try {
          return new Date(r.leftAt).getTime();
        } catch {
          return Date.now();
        }
      }
      return Date.now();
    });
    
    const earliestStart = Math.min(...startTimes);
    const latestEnd = Math.max(...endTimes);
    
    const durationMs = latestEnd - earliestStart;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculateUserDuration = (record) => {
    if (!record) return '00:00:00';
    
    if (record.duration) {
      const hours = Math.floor(record.duration / 3600);
      const minutes = Math.floor((record.duration % 3600) / 60);
      const seconds = record.duration % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (record.joinedAt) {
      const joinTime = new Date(record.joinedAt).getTime();
      const leaveTime = record.leftAt ? new Date(record.leftAt).getTime() : Date.now();
      const durationSec = Math.round((leaveTime - joinTime) / 1000);
      
      const hours = Math.floor(durationSec / 3600);
      const minutes = Math.floor((durationSec % 3600) / 60);
      const seconds = durationSec % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return '00:00:00';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Present';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const exportAttendanceCSV = (meetingId, records) => {
    if (!records || !Array.isArray(records)) return;
    
    const csvHeaders = ['Name', 'Role', 'Email', 'Joined At', 'Left At', 'Duration', 'Status'];
    
    const csvRows = records.map(record => {
      if (!record) return [];
      return [
        record.userName || 'Unknown',
        record.role === 'teacher' ? 'Host' : 'Student',
        record.email || '',
        formatDateTime(record.joinedAt),
        record.leftAt ? formatDateTime(record.leftAt) : 'Still Present',
        calculateUserDuration(record),
        record.leftAt ? 'Left' : (record.isActive ? 'Present' : 'Unknown')
      ];
    }).filter(row => row.length > 0);
    
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

  const exportAllAttendance = () => {
    const allData = [];
    
    attendanceRecords.forEach(({ meetingId, records }) => {
      if (records && Array.isArray(records)) {
        records.forEach(record => {
          if (record) {
            allData.push({
              meetingId,
              ...record
            });
          }
        });
      }
    });

    if (allData.length === 0) return;

    const csvHeaders = ['Meeting ID', 'Name', 'Role', 'Email', 'Joined At', 'Left At', 'Duration', 'Status'];
    
    const csvRows = allData.map(record => [
      record.meetingId || '',
      record.userName || 'Unknown',
      record.role === 'teacher' ? 'Host' : 'Student',
      record.email || '',
      formatDateTime(record.joinedAt),
      record.leftAt ? formatDateTime(record.leftAt) : 'Still Present',
      calculateUserDuration(record),
      record.leftAt ? 'Left' : (record.isActive ? 'Present' : 'Unknown')
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_attendance_records_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(`/${role}/dashboard`)}>
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <h1>
            <Calendar size={24} />
            {role === 'teacher' ? 'All Meeting Attendance Records' : 'Meeting Attendance'}
          </h1>
        </div>
        {attendanceRecords.length > 0 && (
          <button className="export-all-btn" onClick={exportAllAttendance}>
            <Download size={18} />
            Export All Records
          </button>
        )}
      </div>

      {loading ? (
        <div className="attendance-loading">
          <div className="spinner"></div>
          <p>Loading attendance records...</p>
        </div>
      ) : attendanceRecords.length === 0 ? (
        <div className="no-records">
          <Calendar size={64} />
          <h3>No Attendance Records Found</h3>
          <p>
            {role === 'teacher' 
              ? "You haven't conducted any meetings yet. Create a meeting to start tracking attendance."
              : "You haven't joined any meetings yet. Join a meeting to track your attendance."}
          </p>
          <button 
            className="primary-btn"
            onClick={() => navigate(`/${role}/dashboard`)}
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="attendance-content">
          {selectedMeeting ? (
            <div className="meeting-details-view">
              <div className="details-header">
                <button 
                  className="back-to-list-btn"
                  onClick={() => {
                    setSelectedMeeting(null);
                    setMeetingDetails(null);
                  }}
                >
                  ← Back to Meetings
                </button>
                <h2>Meeting Details: {selectedMeeting.slice(-6)}</h2>
              </div>

              {meetingDetails && Array.isArray(meetingDetails) && (
                <>
                  <div className="meeting-summary-cards">
                    <div className="summary-card">
                      <Clock size={24} />
                      <div>
                        <span className="label">Total Duration</span>
                        <span className="value">{calculateMeetingDuration(meetingDetails)}</span>
                      </div>
                    </div>
                    <div className="summary-card">
                      <Users size={24} />
                      <div>
                        <span className="label">Total Participants</span>
                        <span className="value">{meetingDetails.length}</span>
                      </div>
                    </div>
                    <div className="summary-card">
                      <Video size={24} />
                      <div>
                        <span className="label">Meeting ID</span>
                        <span className="value">{selectedMeeting.slice(-8)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="attendance-table-container">
                    <div className="table-header-actions">
                      <h3>Participant Attendance (All Users)</h3>
                      <button 
                        className="export-btn"
                        onClick={() => exportAttendanceCSV(selectedMeeting, meetingDetails)}
                      >
                        <Download size={16} />
                        Export CSV
                      </button>
                    </div>
                    
                    <div className="attendance-table">
                      <div className="table-header">
                        <div className="table-cell">Name</div>
                        <div className="table-cell">Role</div>
                        <div className="table-cell">Email</div>
                        <div className="table-cell">Start Time</div>
                        <div className="table-cell">End Time</div>
                        <div className="table-cell">Duration</div>
                        <div className="table-cell">Status</div>
                      </div>
                      
                      {meetingDetails.map((record, index) => (
                        record && (
                          <div key={index} className="table-row">
                            <div className="table-cell">
                              <span className="user-name">{record.userName || 'Unknown'}</span>
                              {record.userId === localStorage.getItem('userId') && 
                               <span className="you-badge">You</span>}
                            </div>
                            <div className="table-cell">
                              <span className={`role-badge ${record.role === 'teacher' ? 'teacher' : 'student'}`}>
                                {record.role === 'teacher' ? 'Host' : 'Student'}
                              </span>
                            </div>
                            <div className="table-cell">
                              {record.email || '-'}
                            </div>
                            <div className="table-cell">
                              {formatDateTime(record.joinedAt)}
                            </div>
                            <div className="table-cell">
                              {record.leftAt ? formatDateTime(record.leftAt) : 
                               <span className="present-badge">Present</span>}
                            </div>
                            <div className="table-cell">
                              <span className="duration-badge">{calculateUserDuration(record)}</span>
                            </div>
                            <div className="table-cell">
                              <span className={`status-badge ${record.leftAt ? 'left' : 'present'}`}>
                                {record.leftAt ? 'Left' : (record.isActive ? 'Active' : 'Present')}
                              </span>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="meetings-list-view">
              <div className="meetings-grid">
                {attendanceRecords.map(({ meetingId, records, allParticipants }) => {
                  if (!records || !Array.isArray(records) || records.length === 0) return null;
                  
                  const meetingStart = records[0]?.joinedAt;
                  const meetingEnd = records[records.length - 1]?.leftAt;
                  const duration = calculateMeetingDuration(records);
                  
                  return (
                    <div key={meetingId} className="meeting-card">
                      <div className="meeting-card-header">
                        <div className="meeting-id-badge">
                          <Video size={14} />
                          Meeting #{meetingId.slice(-6)}
                        </div>
                        <span className="participant-count">
                          <Users size={14} />
                          {allParticipants} {allParticipants === 1 ? 'Participant' : 'Participants'}
                        </span>
                      </div>
                      
                      <div className="meeting-times">
                        <div className="time-row">
                          <Calendar size={14} />
                          <div className="time-detail">
                            <span className="time-label">Start:</span>
                            <span className="time-value">{formatDateTime(meetingStart)}</span>
                          </div>
                        </div>
                        
                        {meetingEnd && (
                          <div className="time-row">
                            <div className="time-detail">
                              <span className="time-label">End:</span>
                              <span className="time-value">{formatDateTime(meetingEnd)}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="time-row duration">
                          <Clock size={14} />
                          <div className="time-detail">
                            <span className="time-label">Duration:</span>
                            <span className="time-value highlight">{duration}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="meeting-card-footer">
                        <button 
                          className="view-details-btn"
                          onClick={() => viewMeetingDetails(meetingId, records)}
                        >
                          View All Participants ({allParticipants})
                        </button>
                        <button 
                          className="export-btn small"
                          onClick={() => exportAttendanceCSV(meetingId, records)}
                        >
                          <Download size={14} />
                          Export
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;