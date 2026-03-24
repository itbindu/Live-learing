// Updated file: backend/models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
  notifications: [{
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    type: { type: String, enum: ['quiz', 'approval', 'general'], default: 'general' },
    link: { type: String } // Optional link to navigate to
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);