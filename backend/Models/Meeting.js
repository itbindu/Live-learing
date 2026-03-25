// models/Meeting.js
const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true, default: "Virtual Classroom" },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  meetingId: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  scheduledTime: { type: Date, default: Date.now },
  
  participants: [{ 
    name: String, 
    email: String, 
    joinedAt: { type: Date, default: Date.now } 
  }],
  
  // ATTENDANCE: Track join/leave logs with proper timestamps
  attendance: [{
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    email: { type: String, default: "" },
    role: { type: String, enum: ['teacher', 'student'], default: 'student' },
    joinedAt: { type: Date, required: true, default: Date.now },
    leftAt: { type: Date, default: null },
    duration: { type: Number, default: null }, // in seconds
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
  endedAt: { type: Date, default: null }
});

// Method to add a user to attendance
meetingSchema.methods.userJoined = async function(userData) {
  console.log(`📝 Adding user to attendance: ${userData.userName}`);
  
  // Check if already active
  const existingActive = this.attendance.find(
    a => a.userId === userData.userId && a.isActive === true
  );
  
  if (existingActive) {
    console.log(`⚠️ User ${userData.userName} already has active attendance`);
    return this;
  }
  
  this.attendance.push({
    userId: userData.userId,
    userName: userData.userName,
    email: userData.email || '',
    role: userData.role || 'student',
    joinedAt: userData.joinedAt || new Date(),
    isActive: true,
    leftAt: null,
    duration: null
  });
  
  // Also add to participants
  this.participants.push({
    name: userData.userName,
    email: userData.email || '',
    joinedAt: new Date()
  });
  
  await this.save();
  console.log(`✅ User ${userData.userName} added to attendance`);
  return this;
};

// Method to mark user as left
meetingSchema.methods.userLeft = async function(userId, leftAt = new Date()) {
  console.log(`📝 Marking user ${userId} as left`);
  
  const attendanceRecord = this.attendance.find(
    a => a.userId === userId && a.isActive === true
  );
  
  if (attendanceRecord) {
    const joinTime = new Date(attendanceRecord.joinedAt).getTime();
    const leaveTime = leftAt.getTime();
    const duration = Math.round((leaveTime - joinTime) / 1000);
    
    attendanceRecord.leftAt = leftAt;
    attendanceRecord.duration = duration;
    attendanceRecord.isActive = false;
    
    await this.save();
    console.log(`✅ User ${userId} marked as left, Duration: ${duration}s`);
  } else {
    console.log(`⚠️ No active attendance record found for user ${userId}`);
  }
  
  return this;
};

// Method to end meeting for all participants
meetingSchema.methods.endMeetingForAll = async function() {
  console.log(`📝 Ending meeting for all participants`);
  
  const now = new Date();
  let updatedCount = 0;
  
  this.attendance.forEach(record => {
    if (record.isActive === true && !record.leftAt) {
      const joinTime = new Date(record.joinedAt).getTime();
      const leaveTime = now.getTime();
      const duration = Math.round((leaveTime - joinTime) / 1000);
      
      record.leftAt = now;
      record.duration = duration;
      record.isActive = false;
      updatedCount++;
    }
  });
  
  this.isActive = false;
  this.endedAt = now;
  
  await this.save();
  console.log(`✅ Meeting ended, ${updatedCount} participants marked as left`);
  return this;
};

// Method to get attendance summary
meetingSchema.methods.getAttendanceSummary = function() {
  const totalParticipants = this.attendance.length;
  const activeParticipants = this.attendance.filter(a => a.isActive === true).length;
  const completedParticipants = this.attendance.filter(a => a.duration !== null).length;
  
  const totalDuration = this.attendance.reduce((sum, a) => sum + (a.duration || 0), 0);
  const averageDuration = completedParticipants > 0 ? Math.round(totalDuration / completedParticipants) : 0;
  
  return {
    meetingId: this.meetingId,
    title: this.title,
    totalParticipants,
    activeParticipants,
    completedParticipants,
    averageDuration,
    isActive: this.isActive,
    endedAt: this.endedAt,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);