// routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const Meeting = require('../Models/Meeting');
const Student = require('../Models/Student');
const Teacher = require('../Models/Teacher');
const authenticateToken = require('../middleware/auth');

// Get attendance for a specific meeting (teacher only)
router.get('/meeting/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    // Verify teacher owns this meeting
    const meeting = await Meeting.findOne({ 
      meetingId,
      teacherId: req.user.id 
    }).select('title attendance logs createdAt');
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found or unauthorized' });
    }
    
    res.status(200).json({
      success: true,
      meeting: {
        id: meeting.meetingId,
        title: meeting.title,
        createdAt: meeting.createdAt,
        attendance: meeting.attendance || [],
        logs: meeting.logs || [] // for backward compatibility
      }
    });
  } catch (error) {
    console.error('Fetch meeting attendance error:', error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

// Get all attendance for a teacher (all meetings)
router.get('/teacher', authenticateToken, async (req, res) => {
  try {
    const meetings = await Meeting.find({ 
      teacherId: req.user.id 
    })
    .select('title meetingId attendance logs createdAt endedAt')
    .sort({ createdAt: -1 });
    
    const formattedMeetings = meetings.map(meeting => ({
      meetingId: meeting.meetingId,
      title: meeting.title,
      date: meeting.createdAt,
      endedAt: meeting.endedAt,
      attendance: meeting.attendance || [],
      participantCount: meeting.attendance?.length || 0,
      uniqueParticipants: [...new Set(meeting.attendance?.map(a => a.userId))].length
    }));
    
    res.status(200).json({
      success: true,
      meetings: formattedMeetings
    });
  } catch (error) {
    console.error('Fetch teacher attendance error:', error);
    res.status(500).json({ message: 'Failed to fetch attendance records' });
  }
});

// Get attendance for a student (all meetings they attended)
router.get('/student', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Find all meetings where this student appears in attendance
    const meetings = await Meeting.find({
      'attendance.userId': req.user.id
    })
    .populate('teacherId', 'firstName lastName email')
    .select('title meetingId attendance logs createdAt endedAt teacherId')
    .sort({ createdAt: -1 });
    
    const studentAttendance = meetings.map(meeting => {
      // Get only this student's attendance records
      const myAttendance = meeting.attendance?.filter(
        a => a.userId === req.user.id
      ) || [];
      
      // Calculate total time in meeting
      let totalDuration = 0;
      myAttendance.forEach(record => {
        if (record.duration) {
          totalDuration += record.duration;
        } else if (record.joinedAt && !record.leftAt) {
          // Still active? shouldn't happen for past meetings
          const now = new Date();
          const joinTime = new Date(record.joinedAt).getTime();
          totalDuration += Math.round((now - joinTime) / 1000);
        }
      });
      
      return {
        meetingId: meeting.meetingId,
        title: meeting.title,
        teacherName: meeting.teacherId ? 
          `${meeting.teacherId.firstName} ${meeting.teacherId.lastName}` : 'Unknown',
        date: meeting.createdAt,
        endedAt: meeting.endedAt,
        attendance: myAttendance,
        totalDuration,
        sessions: myAttendance.length
      };
    });
    
    res.status(200).json({
      success: true,
      attendance: studentAttendance
    });
  } catch (error) {
    console.error('Fetch student attendance error:', error);
    res.status(500).json({ message: 'Failed to fetch attendance records' });
  }
});

// Save attendance record (can be called from client)
router.post('/record', authenticateToken, async (req, res) => {
  try {
    const { meetingId, type, record } = req.body;
    
    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    if (type === 'join') {
      // Check if already active
      const existing = meeting.attendance.find(
        a => a.userId === record.userId && a.isActive === true
      );
      
      if (!existing) {
        meeting.attendance.push({
          userId: record.userId,
          userName: record.userName,
          email: record.email || '',
          role: record.role || 'student',
          joinedAt: record.joinedAt || new Date(),
          isActive: true
        });
      }
    } else if (type === 'leave') {
      const attendanceRecord = meeting.attendance.find(
        a => a.userId === record.userId && a.isActive === true
      );
      
      if (attendanceRecord) {
        attendanceRecord.leftAt = record.leftAt || new Date();
        attendanceRecord.isActive = false;
        const joinTime = new Date(attendanceRecord.joinedAt).getTime();
        const leaveTime = new Date(attendanceRecord.leftAt).getTime();
        attendanceRecord.duration = Math.round((leaveTime - joinTime) / 1000);
      }
    }
    
    await meeting.save();
    
    res.status(200).json({
      success: true,
      message: 'Attendance recorded successfully'
    });
  } catch (error) {
    console.error('Record attendance error:', error);
    res.status(500).json({ message: 'Failed to record attendance' });
  }
});

// Export attendance as CSV
router.get('/export/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    // Check authorization (teacher or student in meeting)
    const isTeacher = meeting.teacherId.toString() === req.user.id;
    const isStudent = meeting.attendance.some(a => a.userId === req.user.id);
    
    if (!isTeacher && !isStudent) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Generate CSV
    const attendance = meeting.attendance || [];
    const csvRows = [];
    
    // Headers
    csvRows.push([
      'Name',
      'Email',
      'Role',
      'Joined At',
      'Left At',
      'Duration (seconds)',
      'Status'
    ].join(','));
    
    // Data rows
    attendance.forEach(record => {
      const joinedAt = record.joinedAt ? new Date(record.joinedAt).toISOString() : '';
      const leftAt = record.leftAt ? new Date(record.leftAt).toISOString() : '';
      const status = record.isActive ? 'Active' : (record.leftAt ? 'Left' : 'Unknown');
      
      csvRows.push([
        `"${record.userName || ''}"`,
        `"${record.email || ''}"`,
        record.role || 'student',
        joinedAt,
        leftAt,
        record.duration || '',
        status
      ].join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${meetingId}.csv`);
    res.status(200).send(csvContent);
    
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ message: 'Failed to export attendance' });
  }
});

module.exports = router;