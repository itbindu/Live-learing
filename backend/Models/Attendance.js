// models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  meetingId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  email: { type: String, default: '' },
  role: { type: String, enum: ['teacher', 'student'], default: 'student' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  duration: { type: Number, default: 0 }
});

// Index for faster queries
attendanceSchema.index({ meetingId: 1, userId: 1, leftAt: 1 });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);