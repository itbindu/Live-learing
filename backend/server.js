// ================== IMPORTS ==================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);

// ================== CORS CONFIG ==================
const allowedOrigins = [
  "https://live-learing.vercel.app/",
  "http://localhost:3000"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS not allowed'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ================== STATIC FILES ==================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// ================== ROUTES ==================
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
// Add attendance routes
const attendanceRoutes = require('./routes/attendanceRoutes');

app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attendance', attendanceRoutes); // New attendance routes

app.get('/', (req, res) => {
  res.send('🚀 Virtual Classroom Server Running');
});

// ================== SOCKET.IO with WebRTC Support ==================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store active meetings and users
const meetings = new Map(); // meetingId -> Map of socketId -> userInfo
const users = new Map(); // socketId -> userInfo

// Import Meeting model for attendance tracking
const Meeting = require('./Models/Meeting');

// Helper function to save attendance to database
async function saveAttendanceLog(meetingId, userInfo, type = 'join') {
  try {
    const meeting = await Meeting.findOne({ meetingId });
    if (!meeting) {
      console.log(`Meeting ${meetingId} not found for attendance log`);
      return;
    }

    if (type === 'join') {
      // Add user to attendance
      await meeting.userJoined({
        userId: userInfo.userId,
        userName: userInfo.userName,
        email: userInfo.email,
        role: userInfo.role,
        joinedAt: userInfo.joinedAt
      });
      console.log(`✅ Attendance joined: ${userInfo.userName} in meeting ${meetingId}`);
    } else if (type === 'leave') {
      // Mark user as left
      await meeting.userLeft(userInfo.userId, new Date());
      console.log(`✅ Attendance left: ${userInfo.userName} from meeting ${meetingId}`);
    }
  } catch (error) {
    console.error('Error saving attendance:', error);
  }
}

io.on('connection', (socket) => {
  console.log('🔵 User connected:', socket.id);

  // ============ MEETING EVENTS ============
  socket.on('join-meeting', async ({ meetingId, userId, userName, role, email }) => {
    console.log(`👤 ${userName} (${role}) joining meeting: ${meetingId}`);
    
    socket.join(meetingId);
    
    const joinedAt = new Date();
    
    // Store user info with email for attendance
    const userInfo = {
      socketId: socket.id,
      userId,
      userName,
      email: email || '',
      role,
      meetingId,
      audioEnabled: true,
      videoEnabled: true,
      isScreenSharing: false,
      joinedAt: joinedAt
    };
    
    users.set(socket.id, userInfo);
    
    // Store in meetings map
    if (!meetings.has(meetingId)) {
      meetings.set(meetingId, new Map());
    }
    meetings.get(meetingId).set(socket.id, userInfo);
    
    // Save attendance to database
    await saveAttendanceLog(meetingId, userInfo, 'join');
    
    // Also save to localStorage via client (optional, but AttendancePage uses localStorage)
    // We'll emit an event to the client to also save locally
    socket.emit('attendance-recorded', {
      type: 'join',
      meetingId,
      record: {
        userId,
        userName,
        email,
        role,
        joinedAt,
        isActive: true
      }
    });
    
    // Get all users in this meeting except current user
    const meetingUsers = Array.from(meetings.get(meetingId).values())
      .filter(u => u.userId !== userId)
      .map(u => ({
        userId: u.userId,
        userName: u.userName,
        role: u.role,
        audioEnabled: u.audioEnabled,
        videoEnabled: u.videoEnabled,
        isScreenSharing: u.isScreenSharing
      }));
    
    console.log(`Sending ${meetingUsers.length} existing users to new user`);
    
    // Send all existing users to the new user
    socket.emit('all-users', meetingUsers);
    
    // Notify others about new user
    socket.to(meetingId).emit('user-joined', {
      userId,
      userName,
      role,
      audioEnabled: true,
      videoEnabled: true,
      isScreenSharing: false
    });
    
    console.log(`✅ Total users in meeting ${meetingId}: ${meetings.get(meetingId).size}`);
  });

  // ============ LEAVE MEETING ============
  socket.on('leave-meeting', async ({ meetingId, userId }) => {
    console.log(`👋 User ${userId} leaving meeting ${meetingId}`);
    
    const user = users.get(socket.id);
    if (user) {
      const leftAt = new Date();
      
      // Save leave attendance to database
      await saveAttendanceLog(meetingId, user, 'leave');
      
      // Emit to client to save locally
      socket.emit('attendance-recorded', {
        type: 'leave',
        meetingId,
        record: {
          userId: user.userId,
          userName: user.userName,
          email: user.email,
          role: user.role,
          leftAt,
          duration: Math.round((leftAt - user.joinedAt) / 1000)
        }
      });
      
      // Remove from meetings
      const meeting = meetings.get(meetingId);
      if (meeting) {
        meeting.delete(socket.id);
        if (meeting.size === 0) {
          meetings.delete(meetingId);
        }
      }
      
      users.delete(socket.id);
      
      // Notify others
      socket.to(meetingId).emit('user-left', userId);
    }
    
    socket.leave(meetingId);
  });

  // ============ DISCONNECT ============
  socket.on('disconnect', async () => {
    console.log('🔴 User disconnected:', socket.id);
    
    const user = users.get(socket.id);
    if (user) {
      const { meetingId, userId, userName, email, role, joinedAt, isScreenSharing } = user;
      
      const leftAt = new Date();
      
      // Save leave attendance to database
      await saveAttendanceLog(meetingId, user, 'leave');
      
      // Emit to client (if still connected) to save locally
      socket.emit('attendance-recorded', {
        type: 'leave',
        meetingId,
        record: {
          userId,
          userName,
          email,
          role,
          leftAt,
          duration: Math.round((leftAt - joinedAt) / 1000)
        }
      });
      
      // Remove from meetings
      const meeting = meetings.get(meetingId);
      if (meeting) {
        meeting.delete(socket.id);
        if (meeting.size === 0) {
          meetings.delete(meetingId);
        }
      }
      
      users.delete(socket.id);
      
      // Notify others
      socket.to(meetingId).emit('user-left', userId);
      
      // If they were screen sharing, notify stop
      if (isScreenSharing) {
        io.to(meetingId).emit('screen-share-stopped', { userId });
      }
    }
  });

  // ============ WEBRTC SIGNALING ============
  socket.on('send-offer', ({ meetingId, targetUserId, offer }) => {
    console.log(`📤 Offer from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-offer', {
        fromUserId: users.get(socket.id)?.userId,
        fromUserName: users.get(socket.id)?.userName,
        offer
      });
    }
  });

  socket.on('send-answer', ({ meetingId, targetUserId, answer }) => {
    console.log(`📥 Answer from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-answer', {
        fromUserId: users.get(socket.id)?.userId,
        fromUserName: users.get(socket.id)?.userName,
        answer
      });
    }
  });

  socket.on('send-ice-candidate', ({ meetingId, targetUserId, candidate }) => {
    console.log(`🧊 ICE candidate from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-ice-candidate', {
        fromUserId: users.get(socket.id)?.userId,
        fromUserName: users.get(socket.id)?.userName,
        candidate
      });
    }
  });

  // ============ SCREEN SHARE WEBRTC SIGNALING ============
  socket.on('send-screen-offer', ({ meetingId, targetUserId, offer }) => {
    console.log(`📺 Screen offer from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-screen-offer', {
        fromUserId: users.get(socket.id)?.userId,
        fromUserName: users.get(socket.id)?.userName,
        offer
      });
    }
  });

  socket.on('send-screen-answer', ({ meetingId, targetUserId, answer }) => {
    console.log(`📺 Screen answer from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-screen-answer', {
        fromUserId: users.get(socket.id)?.userId,
        fromUserName: users.get(socket.id)?.userName,
        answer
      });
    }
  });

  socket.on('send-screen-ice-candidate', ({ meetingId, targetUserId, candidate }) => {
    console.log(`📺 Screen ICE candidate from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-screen-ice-candidate', {
        fromUserId: users.get(socket.id)?.userId,
        fromUserName: users.get(socket.id)?.userName,
        candidate
      });
    }
  });

  // ============ SCREEN SHARE STATE EVENTS ============
  socket.on('screen-share-started', ({ meetingId, userId, userName }) => {
    console.log(`🖥️ Screen share started by ${userName} (${userId})`);
    
    const user = users.get(socket.id);
    if (user) {
      user.isScreenSharing = true;
    }
    
    io.to(meetingId).emit('screen-share-started', { userId, userName, meetingId });
  });

  socket.on('screen-share-stopped', ({ meetingId, userId }) => {
    console.log(`🖥️ Screen share stopped by ${userId}`);
    
    const user = users.get(socket.id);
    if (user) {
      user.isScreenSharing = false;
    }
    
    io.to(meetingId).emit('screen-share-stopped', { userId, meetingId });
  });

  // ============ MEDIA STATE EVENTS ============
  socket.on('media-state-changed', ({ meetingId, userId, audioEnabled, videoEnabled }) => {
    console.log(`📹 Media state changed for ${userId}: audio=${audioEnabled}, video=${videoEnabled}`);
    
    const user = users.get(socket.id);
    if (user) {
      user.audioEnabled = audioEnabled;
      user.videoEnabled = videoEnabled;
    }
    
    socket.to(meetingId).emit('media-state-changed', { userId, audioEnabled, videoEnabled });
  });

  // ============ CHAT EVENTS ============
  socket.on('chat-message', ({ meetingId, message }) => {
    console.log(`💬 Chat message in ${meetingId} from ${message.userName}`);
    io.to(meetingId).emit('chat-message', message);
  });

  // ============ MUTE EVENTS ============
  socket.on('mute-participant', ({ meetingId, userId }) => {
    console.log(`🔇 Mute request for ${userId} from ${socket.id}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === userId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('force-mute');
    }
  });

  // ============ BREAKOUT ROOM EVENTS ============
  socket.on('breakout-rooms-created', ({ meetingId, rooms, assignmentMethod }) => {
    console.log(`🚪 Breakout rooms created for meeting ${meetingId}`);
    io.to(meetingId).emit('breakout-rooms-created', { rooms, assignmentMethod });
  });

  socket.on('assign-to-breakout-room', ({ meetingId, roomId, roomName, participantId, assignedBy, assignedByName }) => {
    console.log(`🚪 Assigned ${participantId} to ${roomName} by ${assignedByName}`);
    io.to(meetingId).emit('assigned-to-breakout-room', { roomId, roomName, participantId, assignedBy, assignedByName });
  });

  socket.on('manual-assignment', ({ meetingId, roomId, roomName, participantId, assignedBy, assignedByName }) => {
    console.log(`🚪 Manual assignment: ${participantId} to ${roomName}`);
    io.to(meetingId).emit('manual-assignment', { roomId, roomName, participantId, assignedBy, assignedByName });
  });

  socket.on('get-breakout-rooms', ({ meetingId }) => {
    // This would typically retrieve from a store; for now, just acknowledge
    console.log(`🔍 Get breakout rooms requested for meeting ${meetingId}`);
  });

  socket.on('breakout-rooms-updated', (rooms) => {
    // Broadcast to all in meeting
    console.log(`🔄 Breakout rooms updated`);
    if (rooms && rooms.length > 0) {
      io.to(rooms[0]?.meetingId).emit('breakout-rooms-updated', rooms);
    }
  });

  socket.on('close-breakout-rooms', ({ meetingId }) => {
    console.log(`🚪 Closing all breakout rooms for meeting ${meetingId}`);
    io.to(meetingId).emit('breakout-rooms-closed');
  });

  socket.on('join-breakout-room', ({ meetingId, roomId, userId, userName, role, autoJoined }) => {
    console.log(`🚪 ${userName} joining breakout room ${roomId}`);
    // Notify others in main meeting that user left for breakout
    socket.to(meetingId).emit('user-left-main-meeting', { userId, userName, reason: 'joined_breakout' });
    // Could also notify breakout room participants, but that's handled client-side
  });

  socket.on('leave-breakout-room', ({ meetingId, roomId, userId, userName }) => {
    console.log(`🚪 ${userName} leaving breakout room ${roomId}`);
    socket.to(meetingId).emit('user-returned-to-main-meeting', { userId, userName });
  });

  socket.on('user-left-main-meeting', ({ meetingId, userId, userName, reason }) => {
    // Just broadcast
    socket.to(meetingId).emit('user-left-main-meeting', { userId, userName, reason });
  });

  socket.on('user-returned-to-main-meeting', ({ meetingId, userId, userName }) => {
    socket.to(meetingId).emit('user-returned-to-main-meeting', { userId, userName });
  });

  // ============ MEETING END ============
  socket.on('end-meeting', async ({ meetingId }) => {
    console.log(`⛔ Meeting ended: ${meetingId}`);
    
    // Update meeting in database
    try {
      await Meeting.findOneAndUpdate(
        { meetingId },
        { 
          isActive: false,
          endedAt: new Date()
        }
      );
      console.log(`✅ Meeting ${meetingId} marked as ended in database`);
    } catch (error) {
      console.error('Error ending meeting in database:', error);
    }
    
    io.to(meetingId).emit('meeting-ended');
    meetings.delete(meetingId);
  });

});

// ================== DATABASE ==================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual-classroom')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ================== SERVER START ==================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ CORS enabled for origins:', allowedOrigins);
});