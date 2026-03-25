// src/components/AttendancePage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, Download, ArrowLeft, Video, User, LogIn, LogOut } from 'lucide-react';
import { API_URL } from '../api/config';
import './AttendancePage.css';

const AttendancePage = ({ role = 'student' }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingDetails, setMeetingDetails] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadAttendance();
  }, [role]);

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Present';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Group attendance records by user and session
  const groupAttendanceByUser = (records) => {
    if (!records || !records.length) return [];
    
    // Group by userId first
    const userMap = new Map();
    
    records.forEach(record => {
      const key = record.userId;
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: record.userId,
          userName: record.userName,
          email: record.email,
          role: record.role,
          sessions: []
        });
      }
      
      userMap.get(key).sessions.push({
        joinedAt: record.joinedAt,
        leftAt: record.leftAt,
        duration: record.duration,
        isActive: record.isActive
      });
    });
    
    // Convert to array and calculate summary per user
    return Array.from(userMap.values()).map(user => {
      const totalSessions = user.sessions.length;
      const totalDuration = user.sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      const firstJoin = user.sessions[0]?.joinedAt;
      const lastLeave = user.sessions[user.sessions.length - 1]?.leftAt;
      const isCurrentlyActive = user.sessions.some(s => s.isActive === true);
      
      return {
        ...user,
        totalSessions,
        totalDuration,
        firstJoin,
        lastLeave,
        isCurrentlyActive,
        sessions: user.sessions
      };
    });
  };

  // Group attendance by user and show summary (for meeting cards)
  const getMeetingSummary = (records) => {
    if (!records || !records.length) return { uniqueUsers: 0, totalSessions: records.length, totalDuration: 0 };
    
    const uniqueUsers = new Set(records.map(r => r.userId)).size;
    const totalSessions = records.length;
    const totalDuration = records.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    return { uniqueUsers, totalSessions, totalDuration };
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/attendance/all`);
      const data = await response.json();
      console.log('Attendance data:', data);
      
      if (data.success && data.meetings) {
        const meetingsWithRecords = data.meetings.filter(m => m.records && m.records.length > 0);
        setAttendanceRecords(meetingsWithRecords);
      } else {
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (meetingId, groupedUsers, title) => {
    if (!groupedUsers || !groupedUsers.length) return;
    
    const headers = ['Name', 'Role', 'Email', 'Total Sessions', 'Total Duration', 'First Join', 'Last Leave', 'Status'];
    const rows = groupedUsers.map(user => [
      user.userName || 'Unknown',
      user.role === 'teacher' ? 'Host' : 'Student',
      user.email || '-',
      user.totalSessions,
      formatDuration(user.totalDuration),
      formatDateTime(user.firstJoin),
      user.lastLeave ? formatDateTime(user.lastLeave) : 'Active',
      user.isCurrentlyActive ? 'Active' : 'Completed'
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${title || meetingId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportFullDetailsCSV = (meetingId, records, title) => {
    if (!records || !records.length) return;
    
    const headers = ['Name', 'Role', 'Email', 'Joined At', 'Left At', 'Duration', 'Session #'];
    const rows = records.map((record, index) => [
      record.userName || 'Unknown',
      record.role === 'teacher' ? 'Host' : 'Student',
      record.email || '-',
      formatDateTime(record.joinedAt),
      record.leftAt ? formatDateTime(record.leftAt) : 'Active',
      formatDuration(record.duration),
      index + 1
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_detailed_${title || meetingId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="attendance-loading">
        <div className="spinner"></div>
        <p>Loading attendance records...</p>
      </div>
    );
  }

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(`/${role}/dashboard`)}>
            <ArrowLeft size={20} /> Back
          </button>
          <h1><Calendar size={24} /> Attendance Records</h1>
        </div>
      </div>

      {attendanceRecords.length === 0 ? (
        <div className="no-records">
          <Calendar size={64} />
          <h3>No Attendance Records Found</h3>
          <p>
            {role === 'teacher' 
              ? "You haven't conducted any meetings yet. Create a meeting to start tracking attendance."
              : "You haven't joined any meetings yet. Join a meeting to track your attendance."}
          </p>
          <button className="primary-btn" onClick={() => navigate(`/${role}/dashboard`)}>
            Go to Dashboard
          </button>
        </div>
      ) : selectedMeeting ? (
        <div>
          <button className="back-to-list-btn" onClick={() => { setSelectedMeeting(null); setMeetingDetails([]); }}>
            ← Back to Meetings
          </button>
          <h2>Meeting Details</h2>
          
          {/* Group by user for summary view */}
          {(() => {
            const groupedUsers = groupAttendanceByUser(meetingDetails);
            const totalUniqueUsers = groupedUsers.length;
            const totalSessions = meetingDetails.length;
            
            return (
              <>
                <div className="meeting-summary-cards">
                  <div className="summary-card">
                    <Users size={24} />
                    <div>
                      <span className="label">Unique Participants</span>
                      <span className="value">{totalUniqueUsers}</span>
                    </div>
                  </div>
                  <div className="summary-card">
                    <LogIn size={24} />
                    <div>
                      <span className="label">Total Sessions</span>
                      <span className="value">{totalSessions}</span>
                    </div>
                  </div>
                  <div className="summary-card">
                    <Clock size={24} />
                    <div>
                      <span className="label">Avg Sessions/User</span>
                      <span className="value">{(totalSessions / totalUniqueUsers).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="attendance-table-container">
                  <div className="table-header-actions">
                    <h3>Participant Summary (Grouped by User)</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="export-btn" onClick={() => exportCSV(selectedMeeting, groupedUsers, 'summary')}>
                        <Download size={16} /> Export Summary
                      </button>
                      <button className="export-btn" onClick={() => exportFullDetailsCSV(selectedMeeting, meetingDetails, 'full')}>
                        <Download size={16} /> Export Full Details
                      </button>
                    </div>
                  </div>
                  <div className="attendance-table">
                    <div className="table-header">
                      <div className="table-cell">Name</div>
                      <div className="table-cell">Role</div>
                      <div className="table-cell">Email</div>
                      <div className="table-cell">Sessions</div>
                      <div className="table-cell">Total Duration</div>
                      <div className="table-cell">First Join</div>
                      <div className="table-cell">Last Leave</div>
                      <div className="table-cell">Status</div>
                    </div>
                    {groupedUsers.map((user, i) => (
                      <div key={i} className="table-row">
                        <div className="table-cell"><span className="user-name">{user.userName}</span></div>
                        <div className="table-cell">
                          <span className={`role-badge ${user.role}`}>
                            {user.role === 'teacher' ? 'Host' : 'Student'}
                          </span>
                        </div>
                        <div className="table-cell">{user.email || '-'}</div>
                        <div className="table-cell">
                          <span className="session-badge">{user.totalSessions} session{user.totalSessions !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="table-cell">
                          <span className="duration-badge">{formatDuration(user.totalDuration)}</span>
                        </div>
                        <div className="table-cell">{formatDateTime(user.firstJoin)}</div>
                        <div className="table-cell">
                          {user.lastLeave ? formatDateTime(user.lastLeave) : 
                           <span className="present-badge">Active</span>}
                        </div>
                        <div className="table-cell">
                          <span className={`status-badge ${user.isCurrentlyActive ? 'present' : 'left'}`}>
                            {user.isCurrentlyActive ? 'Active' : 'Completed'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Show detailed sessions if there are multiple entries */}
                {meetingDetails.length > groupedUsers.length && (
                  <div className="attendance-table-container" style={{ marginTop: '24px' }}>
                    <div className="table-header-actions">
                      <h3>Detailed Session History ({meetingDetails.length} total sessions)</h3>
                    </div>
                    <div className="attendance-table">
                      <div className="table-header">
                        <div className="table-cell">Name</div>
                        <div className="table-cell">Role</div>
                        <div className="table-cell">Session #</div>
                        <div className="table-cell">Joined At</div>
                        <div className="table-cell">Left At</div>
                        <div className="table-cell">Duration</div>
                      </div>
                      {meetingDetails.map((record, index) => (
                        <div key={index} className="table-row">
                          <div className="table-cell"><span className="user-name">{record.userName}</span></div>
                          <div className="table-cell">
                            <span className={`role-badge ${record.role}`}>
                              {record.role === 'teacher' ? 'Host' : 'Student'}
                            </span>
                          </div>
                          <div className="table-cell">
                            <span className="session-number">#{index + 1}</span>
                          </div>
                          <div className="table-cell">{formatDateTime(record.joinedAt)}</div>
                          <div className="table-cell">
                            {record.leftAt ? formatDateTime(record.leftAt) : 
                             <span className="present-badge">Active</span>}
                          </div>
                          <div className="table-cell">
                            <span className="duration-badge">{formatDuration(record.duration)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="meetings-grid">
          {attendanceRecords.map((meeting) => {
            const { uniqueUsers, totalSessions, totalDuration } = getMeetingSummary(meeting.records);
            const avgDurationPerUser = uniqueUsers > 0 ? Math.round(totalDuration / uniqueUsers) : 0;
            
            return (
              <div key={meeting.meetingId} className="meeting-card">
                <div className="meeting-card-header">
                  <div className="meeting-id-badge">
                    <Video size={14} /> {meeting.title || `Meeting #${meeting.meetingId.slice(-6)}`}
                  </div>
                  <span className="participant-count">
                    <Users size={14} /> {uniqueUsers} Participant{uniqueUsers !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="meeting-times">
                  <div className="time-row">
                    <Calendar size={14} />
                    <div className="time-detail">
                      <span className="time-label">Date:</span>
                      <span className="time-value">{formatDateTime(meeting.createdAt)}</span>
                    </div>
                  </div>
                  <div className="time-row">
                    <User size={14} />
                    <div className="time-detail">
                      <span className="time-label">Total Sessions:</span>
                      <span className="time-value highlight">{totalSessions}</span>
                    </div>
                  </div>
                  <div className="time-row duration">
                    <Clock size={14} />
                    <div className="time-detail">
                      <span className="time-label">Avg Duration/User:</span>
                      <span className="time-value highlight">{formatDuration(avgDurationPerUser)}</span>
                    </div>
                  </div>
                </div>
                <div className="meeting-card-footer">
                  <button 
                    className="view-details-btn" 
                    onClick={() => { 
                      setSelectedMeeting(meeting.meetingId); 
                      setMeetingDetails(meeting.records); 
                    }}
                  >
                    View Details ({uniqueUsers} users, {totalSessions} sessions)
                  </button>
                  <button 
                    className="export-btn small" 
                    onClick={() => exportCSV(meeting.meetingId, groupAttendanceByUser(meeting.records), meeting.title)}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;