const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['blank', 'mcq'] }, // 'blank' or 'mcq'
  question: { type: String, required: true },
  options: [{ type: String }], // For MCQ only (e.g., ['A', 'B', 'C', 'D'])
  correctAnswer: { type: String, required: true }, // For blank: exact text; for MCQ: correct option (e.g., 'A')
});

const quizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  questions: [questionSchema],
  timeLimit: { type: Number, required: true }, // In minutes, e.g., 10
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Quiz', quizSchema);