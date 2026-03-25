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

// ================== FRONTEND URL HELPER ==================
const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || 'https://live-learn-gray.vercel.app';
  }
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

// ================== CORS CONFIG ==================
const allowedOrigins = [
  getFrontendUrl(),
  "https://live-learn-gray.vercel.app",
  "https://live-learn1.onrender.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000"
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('CORS not allowed'), false);
    }
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
const attendanceRoutes = require('./routes/attendanceRoutes');

app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attendance', attendanceRoutes);

app.get('/', (req, res) => {
  res.send('🚀 Virtual Classroom Server Running');
});

app.get('/api/config', (req, res) => {
  res.json({
    frontendUrl: getFrontendUrl(),
    backendUrl: process.env.NODE_ENV === 'production' ? 'https://live-learn.onrender.com' : 'http://localhost:5000',
    environment: process.env.NODE_ENV || 'development'
  });
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
      await meeting.userJoined({
        userId: userInfo.userId,
        userName: userInfo.userName,
        email: userInfo.email,
        role: userInfo.role,
        joinedAt: userInfo.joinedAt
      });
      console.log(`✅ Attendance joined: ${userInfo.userName} in meeting ${meetingId}`);
    } else if (type === 'leave') {
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
    
    if (!meetings.has(meetingId)) {
      meetings.set(meetingId, new Map());
    }
    meetings.get(meetingId).set(socket.id, userInfo);
    
    await saveAttendanceLog(meetingId, userInfo, 'join');
    
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
    
    socket.emit('all-users', meetingUsers);
    
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
      
      await saveAttendanceLog(meetingId, user, 'leave');
      
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
      
      const meeting = meetings.get(meetingId);
      if (meeting) {
        meeting.delete(socket.id);
        if (meeting.size === 0) {
          meetings.delete(meetingId);
        }
      }
      
      users.delete(socket.id);
      
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
      
      await saveAttendanceLog(meetingId, user, 'leave');
      
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
      
      const meeting = meetings.get(meetingId);
      if (meeting) {
        meeting.delete(socket.id);
        if (meeting.size === 0) {
          meetings.delete(meetingId);
        }
      }
      
      users.delete(socket.id);
      
      socket.to(meetingId).emit('user-left', userId);
      
      if (isScreenSharing) {
        io.to(meetingId).emit('screen-share-stopped', { userId });
      }
    }
  });

  // ============ WEBRTC SIGNALING ============
  socket.on('send-offer', ({ meetingId, targetUserId, offer }) => {
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
    const user = users.get(socket.id);
    if (user) {
      user.isScreenSharing = true;
    }
    io.to(meetingId).emit('screen-share-started', { userId, userName, meetingId });
  });

  socket.on('screen-share-stopped', ({ meetingId, userId }) => {
    const user = users.get(socket.id);
    if (user) {
      user.isScreenSharing = false;
    }
    io.to(meetingId).emit('screen-share-stopped', { userId, meetingId });
  });

  // ============ MEDIA STATE EVENTS ============
  socket.on('media-state-changed', ({ meetingId, userId, audioEnabled, videoEnabled }) => {
    const user = users.get(socket.id);
    if (user) {
      user.audioEnabled = audioEnabled;
      user.videoEnabled = videoEnabled;
    }
    socket.to(meetingId).emit('media-state-changed', { userId, audioEnabled, videoEnabled });
  });

  // ============ CHAT EVENTS ============
  socket.on('chat-message', ({ meetingId, message }) => {
    io.to(meetingId).emit('chat-message', message);
  });

  // ============ MUTE EVENTS ============
  socket.on('mute-participant', ({ meetingId, userId }) => {
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

  // ============ MEETING END (FIXED - Marks all participants as left) ============
  socket.on('end-meeting', async ({ meetingId }) => {
    console.log(`⛔ Meeting ending: ${meetingId}`);
    
    const meeting = meetings.get(meetingId);
    
    if (meeting) {
      console.log(`📊 Processing ${meeting.size} participants for meeting end...`);
      
      // Mark all users as left when meeting ends
      for (const [socketId, user] of meeting.entries()) {
        const leftAt = new Date();
        
        // Calculate duration
        const joinedAt = user.joinedAt || new Date();
        const duration = Math.round((leftAt - new Date(joinedAt)) / 1000);
        
        // Save leave record for each user in database
        try {
          await saveAttendanceLog(meetingId, user, 'leave');
          console.log(`✅ Marked ${user.userName} as left (duration: ${duration}s)`);
        } catch (error) {
          console.error(`Error saving leave for ${user.userName}:`, error);
        }
        
        // Emit attendance recorded event to each user
        io.to(socketId).emit('attendance-recorded', {
          type: 'leave',
          meetingId,
          record: {
            userId: user.userId,
            userName: user.userName,
            email: user.email,
            role: user.role,
            leftAt: leftAt.toISOString(),
            duration: duration,
            isActive: false,
            meetingEnded: true
          }
        });
      }
      
      // Clear the meeting from memory
      meetings.delete(meetingId);
      console.log(`✅ Meeting ${meetingId} cleared from active meetings`);
    } else {
      console.log(`⚠️ Meeting ${meetingId} not found in active meetings, but will update database`);
    }
    
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
    
    // Notify all users in the meeting room that meeting has ended
    io.to(meetingId).emit('meeting-ended', { 
      meetingId,
      endedAt: new Date().toISOString()
    });
    
    console.log(`✅ Meeting ${meetingId} ended successfully - all participants marked as left`);
  });

});

// ================== DATABASE ==================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual-classroom';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ================== SERVER START ==================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${getFrontendUrl()}`);
  console.log('✅ CORS enabled for origins:', allowedOrigins);
});