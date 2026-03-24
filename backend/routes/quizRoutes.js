const express = require('express');
const Quiz = require('../Models/Quiz');
const Teacher = require('../Models/Teacher');
const Student = require('../Models/Student');
const Submission = require('../Models/Submission');
const authenticateToken = require('../middleware/auth');
const nodemailer = require('nodemailer');
const router = express.Router();

const getFrontendUrl = () => {
  return process.env.NODE_ENV === 'production' 
    ? 'https://live-learing.onrender.com' 
    : 'http://localhost:3000';
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─────────────────────────────────────────────
// CREATE QUIZ (Teacher only)
// ─────────────────────────────────────────────
router.post('/create', authenticateToken, async (req, res) => {
  const { title, questions, timeLimit } = req.body;
  
  if (!title || !questions || !timeLimit) {
    return res.status(400).json({ message: 'All fields required' });
  }
  
  if (timeLimit <= 0) {
    return res.status(400).json({ message: 'Time limit must be at least 1 minute' });
  }

  try {
    const quiz = new Quiz({ 
      title, 
      questions, 
      timeLimit, 
      teacherId: req.user.id 
    });
    await quiz.save();

    const teacher = await Teacher.findById(req.user.id).populate('students');
    const assignedStudents = teacher.students || [];
    const frontendUrl = getFrontendUrl();

    // Send notifications to all assigned students
    const emailPromises = assignedStudents.map(async (student) => {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: student.email,
          subject: `📝 New Proctored Quiz Available: ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">New Proctored Quiz Created!</h2>
              <p>Hello ${student.firstName},</p>
              <p>Your teacher has created a new proctored quiz:</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3 style="color: #1e293b; margin: 0;">${title}</h3>
                <p style="color: #64748b;">⏱️ Time Limit: ${timeLimit} minutes</p>
                <p style="color: #64748b;">📋 Questions: ${questions.length}</p>
                <p style="color: #dc2626; font-weight: bold;">⚠️ This is a proctored quiz with camera monitoring</p>
              </div>
              <p>Log in to your student dashboard to take the quiz.</p>
              <a href="${frontendUrl}/student/quizzes" 
                 style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 8px; margin-top: 20px;">
                Take Quiz Now
              </a>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Email sending failed:', emailErr);
      }

      student.notifications = student.notifications || [];
      student.notifications.push({
        message: `📝 New Proctored Quiz: "${title}" (${timeLimit} min, ${questions.length} questions)`,
        read: false,
        createdAt: new Date(),
        type: 'quiz',
        link: `/proctored-quiz/${quiz._id}`
      });
      await student.save();
    });

    await Promise.all(emailPromises);

    res.status(201).json({ 
      success: true, 
      message: 'Quiz created successfully', 
      quiz 
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ message: 'Failed to create quiz' });
  }
});

// ─────────────────────────────────────────────
// LIST QUIZZES FOR STUDENT (with submitted flag)
// ─────────────────────────────────────────────
router.get('/list', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching quiz list for student:', req.user.id);
    
    const student = await Student.findById(req.user.id).populate('teachers');
    
    if (!student) {
      console.log('Student not found:', req.user.id);
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    console.log('Student found:', {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      teacherCount: student.teachers?.length || 0,
      isApproved: student.isApproved
    });

    if (!student.teachers || student.teachers.length === 0) {
      console.log('Student has no teachers assigned');
      return res.status(200).json({ 
        success: true, 
        quizzes: [],
        message: 'No teachers assigned yet'
      });
    }

    const teacherIds = student.teachers.map(t => t._id);
    console.log('Teacher IDs:', teacherIds.map(id => id.toString()));

    const quizzes = await Quiz.find({ teacherId: { $in: teacherIds } })
      .sort({ createdAt: -1 })
      .select('title timeLimit createdAt questions');

    console.log(`Found ${quizzes.length} quizzes for student`);

    const submissions = await Submission.find({ 
      studentId: req.user.id 
    }).select('quizId');
    
    const submittedQuizIds = new Set(
      submissions.map(s => s.quizId.toString())
    );

    const quizzesWithStatus = quizzes.map(quiz => ({
      ...quiz.toObject(),
      submitted: submittedQuizIds.has(quiz._id.toString()),
    }));

    res.status(200).json({ 
      success: true, 
      quizzes: quizzesWithStatus
    });
    
  } catch (error) {
    console.error('Error fetching quiz list:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load quizzes.',
      error: error.message 
    });
  }
});

// ─────────────────────────────────────────────
// TEACHER'S QUIZZES
// ─────────────────────────────────────────────
router.get('/my-quizzes', authenticateToken, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ teacherId: req.user.id })
      .sort({ createdAt: -1 })
      .select('title timeLimit createdAt questions');
      
    res.status(200).json({ success: true, quizzes });
  } catch (error) {
    console.error('Error fetching teacher quizzes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quizzes' });
  }
});

// ─────────────────────────────────────────────
// STUDENT LEADERBOARD (My Performance)
// ─────────────────────────────────────────────
router.get('/student/leaderboard', authenticateToken, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const submissions = await Submission.find({ studentId: req.user.id })
      .populate('quizId', 'title questions')
      .sort({ submittedAt: -1 });

    const results = submissions.map((sub, index) => ({
      rank: index + 1,
      quizTitle: sub.quizId?.title || 'Unknown Quiz',
      score: sub.score,
      total: sub.quizId?.questions?.length || 0,
      percentage: sub.quizId?.questions?.length 
        ? Math.round((sub.score / sub.quizId.questions.length) * 100) 
        : 0,
      submittedAt: sub.submittedAt,
    }));

    res.status(200).json({
      success: true,
      leaderboard: results
    });
    
  } catch (error) {
    console.error('Student leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

// ─────────────────────────────────────────────
// CHECK IF STUDENT HAS ALREADY SUBMITTED
// ─────────────────────────────────────────────
router.get('/check-submission/:quizId', authenticateToken, async (req, res) => {
  try {
    const submission = await Submission.findOne({
      studentId: req.user.id,
      quizId: req.params.quizId,
    });
    res.status(200).json({ submitted: !!submission });
  } catch (error) {
    console.error('Check submission error:', error);
    res.status(500).json({ submitted: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// GET QUIZ STATISTICS (Teacher only)
// ─────────────────────────────────────────────
router.get('/:quizId/stats', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (quiz.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const submissions = await Submission.find({ quizId: req.params.quizId });
    
    const totalSubmissions = submissions.length;
    let avgScore = 0;
    
    if (totalSubmissions > 0) {
      const totalScore = submissions.reduce((sum, sub) => sum + sub.score, 0);
      avgScore = Math.round((totalScore / (totalSubmissions * quiz.questions.length)) * 100);
    }
    
    res.status(200).json({
      success: true,
      submissions: totalSubmissions,
      avgScore,
      totalQuestions: quiz.questions.length
    });
    
  } catch (error) {
    console.error('Quiz stats error:', error);
    res.status(500).json({ message: 'Failed to fetch quiz statistics' });
  }
});

// ─────────────────────────────────────────────
// GET LEADERBOARD FOR SPECIFIC QUIZ (Teacher view)
// ─────────────────────────────────────────────
router.get('/:quizId/leaderboard', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    
    const submissions = await Submission.find({ quizId: req.params.quizId })
      .populate('studentId', 'firstName lastName email')
      .sort({ score: -1, submittedAt: 1 });

    const leaderboard = submissions.map((sub, index) => ({
      rank: index + 1,
      studentName: sub.studentId ? `${sub.studentId.firstName} ${sub.studentId.lastName}` : 'Unknown Student',
      email: sub.studentId?.email,
      score: sub.score,
      total: quiz.questions.length,
      percentage: Math.round((sub.score / quiz.questions.length) * 100),
      submittedAt: sub.submittedAt,
    }));

    res.status(200).json({ 
      success: true, 
      quizTitle: quiz.title, 
      leaderboard 
    });
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

// ─────────────────────────────────────────────
// SUBMIT QUIZ (with proctoring data)
// ─────────────────────────────────────────────
router.post('/submit/:quizId', authenticateToken, async (req, res) => {
  const { answers, proctoringData } = req.body;
  
  if (!Array.isArray(answers)) {
    return res.status(400).json({ success: false, message: 'Answers must be an array' });
  }

  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const existing = await Submission.findOne({
      studentId: req.user.id,
      quizId: req.params.quizId,
    });
    
    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already submitted this quiz.' 
      });
    }

    let score = 0;
    const correctAnswers = quiz.questions.map(q => q.correctAnswer);

    answers.forEach((answer, index) => {
      if (answer && answer.trim() !== '') {
        if (quiz.questions[index].type === 'mcq') {
          if (answer.toUpperCase() === correctAnswers[index].toUpperCase()) {
            score++;
          }
        } else {
          if (answer.trim().toLowerCase() === correctAnswers[index].trim().toLowerCase()) {
            score++;
          }
        }
      }
    });

    const submission = new Submission({
      studentId: req.user.id,
      quizId: req.params.quizId,
      answers,
      score,
      proctoringData: proctoringData || {}
    });
    
    await submission.save();

    const student = await Student.findById(req.user.id);
    if (student) {
      student.notifications = student.notifications || [];
      student.notifications.push({
        message: `✅ Quiz "${quiz.title}" submitted successfully! Score: ${score}/${quiz.questions.length}`,
        read: false,
        createdAt: new Date(),
        type: 'quiz',
        link: `/quiz-result/${quiz._id}`
      });
      await student.save();
    }

    res.status(200).json({
      success: true,
      message: 'Quiz submitted successfully',
      score: score,
      percentage: Math.round((score / quiz.questions.length) * 100),
      correctAnswers,
      totalQuestions: quiz.questions.length,
    });
    
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit quiz' });
  }
});

// ─────────────────────────────────────────────
// UPDATE QUIZ (Teacher only)
// ─────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  const { title, questions, timeLimit } = req.body;
  
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (quiz.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    quiz.title = title || quiz.title;
    quiz.questions = questions || quiz.questions;
    quiz.timeLimit = timeLimit || quiz.timeLimit;
    
    await quiz.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Quiz updated successfully',
      quiz 
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ message: 'Failed to update quiz' });
  }
});

// ─────────────────────────────────────────────
// DELETE QUIZ (Teacher only)
// ─────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    if (quiz.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await Submission.deleteMany({ quizId: req.params.id });
    await Quiz.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ 
      success: true, 
      message: 'Quiz and associated submissions deleted successfully' 
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ message: 'Failed to delete quiz' });
  }
});

// ─────────────────────────────────────────────
// GET SINGLE QUIZ (Must be last)
// ─────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching single quiz with ID:', req.params.id);
    
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    
    res.status(200).json({ success: true, quiz });
  } catch (error) {
    console.error('Fetch quiz error:', error);
    res.status(500).json({ message: 'Failed to fetch quiz' });
  }
});

module.exports = router;