// backend/routes/teacherRoutes.js - Updated with URL helper
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Teacher = require('../Models/Teacher');
const Student = require('../Models/Student');
const Meeting = require('../Models/Meeting');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { generateAndSendOtp } = require('../services/otpService');
const authenticateToken = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
const { getFrontendUrl, getBackendUrl } = require('../utils/urlHelper');

const router = express.Router();

// ============ CLOUDINARY CONFIGURATION ============
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('✅ Cloudinary configured');

// ============ CLOUDINARY STORAGE CONFIGURATION ============
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'virtual-classroom',
    resource_type: 'auto',
    public_id: (req, file) => {
      const timestamp = Date.now();
      const originalName = file.originalname;
      const lastDotIndex = originalName.lastIndexOf('.');
      let baseName = originalName;
      
      if (lastDotIndex !== -1) {
        baseName = originalName.substring(0, lastDotIndex);
      }
      
      const sanitizedName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
      return `${timestamp}-${sanitizedName}`;
    }
  }
});

// File filter - accept ALL common file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/rtf',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'video/mpeg', 'video/3gpp', 'video/mp2t',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/m4a', 'audio/aac', 'audio/flac',
    'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
    'application/x-7z-compressed', 'application/x-tar', 'application/gzip',
    'application/json', 'application/xml', 'application/rtf', 'application/octet-stream'
  ];

  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.md', '.html', '.rtf',
    '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.mpeg', '.3gp',
    '.mp3', '.wav', '.m4a', '.aac', '.flac',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.json', '.xml'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    console.log(`⚠️ File type may not be supported: ${file.mimetype}, ${ext}`);
    cb(null, true);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: fileFilter
});

// ============ OTP ROUTES ============
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });
  const otpResult = await generateAndSendOtp(email);
  res.status(otpResult.success ? 200 : 500).json(otpResult);
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
  const { verifyOtp } = require('../services/otpService');
  const otpResult = verifyOtp(email, otp);
  res.status(otpResult.success ? 200 : 400).json(otpResult);
});

// ============ AUTH ROUTES ============
router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;
  if (!firstName || !lastName || !email || !phoneNumber || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingTeacher = await Teacher.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingTeacher) {
      return res.status(400).json({ message: 'Email or phone number already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newTeacher = new Teacher({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      isEmailVerified: true,
      students: [],
      files: []
    });

    await newTeacher.save();
    res.status(200).json({ message: 'Teacher account created successfully!' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: `Signup failed: ${error.message}` });
  }
});

router.post('/login', async (req, res) => {
  const { emailOrPhone, password } = req.body;
  if (!emailOrPhone || !password) return res.status(400).json({ message: 'Email/Phone and password are required' });

  try {
    const user = await Teacher.findOne({
      $or: [{ email: emailOrPhone }, { phoneNumber: emailOrPhone }],
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isEmailVerified) return res.status(400).json({ message: 'Please verify your email' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: 'teacher' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const userData = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      id: user._id
    };
    
    res.status(200).json({ 
      token, 
      userId: user._id, 
      user: userData, 
      role: 'teacher',
      frontendUrl: getFrontendUrl(),
      backendUrl: getBackendUrl()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('firstName lastName email phoneNumber students files')
      .populate('students', 'firstName lastName email');
      
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    res.status(200).json(teacher);
  } catch (error) {
    console.error('Fetch teacher profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// ============ STUDENT MANAGEMENT ROUTES ============
router.get('/registered-students', authenticateToken, async (req, res) => {
  try {
    const students = await Student.find()
      .populate('teachers', 'firstName lastName email')
      .select('firstName lastName email phoneNumber isApproved teachers');
    res.status(200).json({ success: true, students });
  } catch (error) {
    console.error('Fetch students error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch registered students' });
  }
});

router.get('/all-teachers', authenticateToken, async (req, res) => {
  try {
    const teachers = await Teacher.find().select('firstName lastName email');
    res.status(200).json({ success: true, teachers });
  } catch (error) {
    console.error('Fetch teachers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch teachers' });
  }
});

router.get('/all-students', authenticateToken, async (req, res) => {
  try {
    const students = await Student.find()
      .populate('teachers', 'firstName lastName email')
      .select('firstName lastName email teachers');
    res.status(200).json({ success: true, students });
  } catch (error) {
    console.error('Fetch all students error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
});

router.post('/approve-student', authenticateToken, async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'Student ID is required' });
  
  try {
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    
    if (!student.teachers) student.teachers = [];
    
    if (student.teachers.includes(req.user.id)) {
      return res.status(400).json({ message: 'You are already assigned to this student.' });
    }
    
    student.teachers.push(req.user.id);
    
    if (student.teachers.length === 1) student.isApproved = true;
    
    await Teacher.findByIdAndUpdate(req.user.id, { $addToSet: { students: studentId } });
    await student.save();
    
    const teacher = await Teacher.findById(req.user.id);
    const frontendUrl = getFrontendUrl();
    
    const htmlContent = `
      <h2>Dear ${student.firstName} ${student.lastName},</h2>
      <p>You have been assigned to teacher <strong>${teacher.firstName} ${teacher.lastName}</strong>.</p>
      <p>Login: <a href="${frontendUrl}/student/login">Student Dashboard</a></p>
    `;
    
    await sendEmail(
      student.email,
      `You've been assigned to teacher ${teacher.firstName} ${teacher.lastName}!`,
      htmlContent
    );

    res.status(200).json({ success: true, message: `Student assigned successfully.` });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ message: 'Failed to assign student' });
  }
});

router.post('/assign-student', authenticateToken, async (req, res) => {
  const { studentId, teacherId } = req.body;
  
  if (!studentId || !teacherId) {
    return res.status(400).json({ message: 'Student ID and Teacher ID are required' });
  }
  
  try {
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    
    if (!student.teachers) student.teachers = [];
    
    if (student.teachers.includes(teacherId)) {
      return res.status(400).json({ message: 'Teacher already assigned' });
    }
    
    student.teachers.push(teacherId);
    
    if (student.teachers.length === 1) student.isApproved = true;
    
    await Teacher.findByIdAndUpdate(teacherId, { $addToSet: { students: studentId } });
    await student.save();
    
    const frontendUrl = getFrontendUrl();
    
    const htmlContent = `
      <h2>Dear ${student.firstName} ${student.lastName},</h2>
      <p>You have been assigned to teacher <strong>${teacher.firstName} ${teacher.lastName}</strong>.</p>
      <p>Login: <a href="${frontendUrl}/student/login">Student Dashboard</a></p>
    `;
    
    await sendEmail(
      student.email,
      `New teacher assignment: ${teacher.firstName} ${teacher.lastName}`,
      htmlContent
    );

    res.status(200).json({ success: true, message: `Student assigned successfully` });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ message: 'Failed to assign student' });
  }
});

router.post('/remove-assignment', authenticateToken, async (req, res) => {
  const { studentId, teacherId } = req.body;
  
  if (!studentId || !teacherId) {
    return res.status(400).json({ message: 'Student ID and Teacher ID are required' });
  }
  
  try {
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    
    student.teachers = student.teachers.filter(id => id.toString() !== teacherId);
    student.isApproved = student.teachers.length > 0;
    
    await Teacher.findByIdAndUpdate(teacherId, { $pull: { students: studentId } });
    await student.save();

    res.status(200).json({ success: true, message: 'Assignment removed successfully' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ message: 'Failed to remove assignment' });
  }
});

// ============ MEETING ROUTES ============
router.post('/create-meeting', authenticateToken, async (req, res) => {
  const { title, description, scheduledTime } = req.body;
  if (!title) return res.status(400).json({ message: 'Meeting title is required' });

  try {
    const meetingId = 'meeting_' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const newMeeting = new Meeting({
      title,
      description: description || '',
      teacherId: req.user.id,
      meetingId,
      scheduledTime: scheduledTime || new Date(),
      isActive: true
    });

    await newMeeting.save();

    const assignedStudents = await Student.find({ teachers: req.user.id });
    const frontendUrl = getFrontendUrl();
    const meetingLink = `${frontendUrl}/meeting/${meetingId}`;
    const teacher = await Teacher.findById(req.user.id);

    let notifiedCount = 0;
    if (assignedStudents.length > 0) {
      for (const student of assignedStudents) {
        try {
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a73e8;">New Virtual Classroom Meeting</h2>
              <p><strong>Dear ${student.firstName} ${student.lastName},</strong></p>
              <p>Your teacher <strong>${teacher.firstName} ${teacher.lastName}</strong> has created a new meeting:</p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">${title}</h3>
                ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
                <p><strong>Meeting ID:</strong> ${meetingId}</p>
                <p><strong>Scheduled:</strong> ${new Date(scheduledTime).toLocaleString()}</p>
              </div>
              <a href="${meetingLink}" style="display: inline-block; background: #1a73e8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0;">➤ Join Meeting</a>
            </div>
          `;

          await sendEmail(
            student.email,
            `📅 New Meeting: ${title} from ${teacher.firstName} ${teacher.lastName}`,
            htmlContent
          );
          
          notifiedCount++;
        } catch (emailError) {
          console.error(`Failed to send email to ${student.email}:`, emailError);
        }
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `✅ Meeting created! ${notifiedCount} assigned students notified.`,
      meetingId,
      link: meetingLink 
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

router.get('/meetings', authenticateToken, async (req, res) => {
  try {
    const meetings = await Meeting.find({ teacherId: req.user.id })
      .sort({ createdAt: -1 })
      .select('title meetingId createdAt isActive description scheduledTime participants');
    res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error('Fetch meetings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch meetings' });
  }
});

router.get('/meeting/:meetingId', async (req, res) => {
  const { meetingId } = req.params;
  try {
    const meeting = await Meeting.findOne({ meetingId })
      .populate('teacherId', 'firstName lastName email');
      
    if (!meeting || !meeting.isActive) {
      return res.status(404).json({ message: 'Meeting not found or inactive' });
    }
    
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Failed to get meeting details' });
  }
});

router.post('/end-meeting/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ meetingId });
    
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    
    if (meeting.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can end this meeting' });
    }
    
    meeting.isActive = false;
    await meeting.save();
    
    res.status(200).json({ success: true, message: 'Meeting ended successfully' });
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({ message: 'Failed to end meeting' });
  }
});

// ============ FILE MANAGEMENT ROUTES ============
router.post('/upload-file', authenticateToken, upload.array('file', 20), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const description = req.body.description || '';
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (!teacher.files) teacher.files = [];

    const uploadedFiles = [];
    
    for (const file of req.files) {
      console.log(`✅ File uploaded to Cloudinary: ${file.path}`);
      
      let category = 'other';
      const mimetype = file.mimetype || '';
      const filename = file.originalname.toLowerCase();
      
      if (mimetype.startsWith('image/') || filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/)) {
        category = 'image';
      } else if (mimetype.startsWith('video/') || filename.match(/\.(mp4|webm|ogg|mov|avi|mkv|mpeg|3gp)$/)) {
        category = 'video';
      } else if (mimetype.startsWith('audio/') || filename.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/)) {
        category = 'audio';
      } else if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
        category = 'pdf';
      } else if (mimetype.includes('document') || filename.match(/\.(doc|docx|txt|rtf|md)$/)) {
        category = 'document';
      } else if (mimetype.includes('spreadsheet') || filename.match(/\.(xls|xlsx|csv)$/)) {
        category = 'spreadsheet';
      } else if (mimetype.includes('presentation') || filename.match(/\.(ppt|pptx)$/)) {
        category = 'presentation';
      } else if (filename.match(/\.(zip|rar|7z|tar|gz)$/)) {
        category = 'archive';
      }
      
      const fileData = {
        filename: file.originalname,
        savedAs: file.filename,
        path: file.path,
        uploadedAt: new Date(),
        description: description.trim(),
        fileType: file.mimetype,
        fileSize: file.size,
        category: category,
        cloudinaryId: file.filename
      };
      
      teacher.files.push(fileData);
      uploadedFiles.push({
        ...fileData,
        id: teacher.files[teacher.files.length - 1]._id
      });
    }

    await teacher.save();
    console.log(`✅ Teacher record updated with ${uploadedFiles.length} file(s)`);

    res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload files' });
  }
});

router.get('/my-files', authenticateToken, async (req, res) => {
  try {
    console.log('📂 Fetching files for teacher:', req.user.id);
    
    const teacher = await Teacher.findById(req.user.id).select('files');
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    
    const files = teacher.files ? teacher.files.sort((a, b) => b.uploadedAt - a.uploadedAt) : [];
    
    res.status(200).json({ success: true, files: files, count: files.length });
  } catch (error) {
    console.error('❌ Fetch files error:', error);
    res.status(500).json({ message: 'Failed to fetch uploaded files' });
  }
});

router.get('/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    
    const file = teacher.files.id(fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });
    
    res.status(200).json({ success: true, file: file });
  } catch (error) {
    console.error('❌ Fetch file error:', error);
    res.status(500).json({ message: 'Failed to fetch file' });
  }
});

router.delete('/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    
    const fileIndex = teacher.files.findIndex(f => f._id.toString() === fileId);
    if (fileIndex === -1) return res.status(404).json({ message: 'File not found' });
    
    const file = teacher.files[fileIndex];
    
    if (file.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(file.cloudinaryId, { resource_type: 'raw' });
        console.log(`✅ File deleted from Cloudinary: ${file.cloudinaryId}`);
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
      }
    }
    
    teacher.files.splice(fileIndex, 1);
    await teacher.save();
    
    res.status(200).json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
});

router.patch('/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { description } = req.body;
    
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    
    const file = teacher.files.id(fileId);
    if (!file) return res.status(404).json({ message: 'File not found' });
    
    file.description = description || '';
    await teacher.save();
    
    res.status(200).json({ success: true, message: 'File description updated', file });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ message: 'Failed to update file description' });
  }
});

// ============ DASHBOARD STATS ============
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);
    
    const totalStudents = teacher.students ? teacher.students.length : 0;
    const totalMeetings = await Meeting.countDocuments({ teacherId: req.user.id });
    const totalFiles = teacher.files ? teacher.files.length : 0;
    const activeMeetings = await Meeting.countDocuments({ teacherId: req.user.id, isActive: true });
    
    res.status(200).json({
      success: true,
      stats: { totalStudents, totalMeetings, totalFiles, activeMeetings }
    });
  } catch (error) {
    console.error('Fetch stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

// Get attendance logs for a specific meeting (teacher only)
router.get('/meeting-attendance/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ meetingId, teacherId: req.user.id })
      .select('logs title createdAt');
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    console.error('Fetch attendance error:', error);
    res.status(500).json({ message: 'Failed to fetch attendance' });
  }
});

module.exports = router;