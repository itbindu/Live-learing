const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [{ type: String }], // Array of student answers (index matches questions)
  score: { type: Number, required: true }, // Calculated score (e.g., out of total questions)
  submittedAt: { type: Date, default: Date.now },
  proctoringData: {
    warnings: [{ type: String }],
    tabSwitches: { type: Number, default: 0 },
    mouseLeaves: { type: Number, default: 0 },
    keyViolations: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 },
    faceDetected: { type: Boolean, default: true },
    audioLevels: { type: Number, default: 0 },
    internetIssues: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model('Submission', submissionSchema);