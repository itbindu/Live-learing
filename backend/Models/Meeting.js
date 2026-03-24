// models/Meeting.js
const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  meetingId: { type: String, required: true, unique: true },
  participants: [{ 
    name: String, 
    email: String, 
    joinedAt: { type: Date, default: Date.now } 
  }],
  // ATTENDANCE: Track join/leave logs with proper timestamps
  attendance: [{
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    email: { type: String },
    role: { type: String, enum: ['teacher', 'student'], default: 'student' },
    joinedAt: { type: Date, required: true },
    leftAt: { type: Date },
    duration: { type: Number }, // in seconds
    isActive: { type: Boolean, default: true }
  }],
  // Legacy logs field (keeping for compatibility)
  logs: [{
    userId: String,
    userName: String,
    email: String,
    isTeacher: { type: Boolean, default: false },
    joinedAt: Date,
    leftAt: Date,
    duration: Number
  }],
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  endedAt: { type: Date }
});

// Method to calculate duration when a user leaves
meetingSchema.methods.userLeft = function(userId, leftAt = new Date()) {
  const attendanceRecord = this.attendance.find(
    a => a.userId === userId && a.isActive === true
  );
  
  if (attendanceRecord) {
    attendanceRecord.leftAt = leftAt;
    attendanceRecord.isActive = false;
    const joinTime = new Date(attendanceRecord.joinedAt).getTime();
    const leaveTime = leftAt.getTime();
    attendanceRecord.duration = Math.round((leaveTime - joinTime) / 1000);
  }
  
  return this.save();
};

// Method to add a user to attendance
meetingSchema.methods.userJoined = function(userData) {
  this.attendance.push({
    userId: userData.userId,
    userName: userData.userName,
    email: userData.email || '',
    role: userData.role || 'student',
    joinedAt: userData.joinedAt || new Date(),
    isActive: true
  });
  
  return this.save();
};

module.exports = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);