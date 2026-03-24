/*const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);

*/
// Updated file: backend/models/Teacher.js (optional: add students array for teacher-side tracking)
/*const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }] // Optional: track assigned students
});

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);
*/

// Updated file: backend/models/Teacher.js (optional: track students array)
/*const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }] // Track assigned students
});
files: [{
  filename: String,
  path: String,
  uploadedAt: { type: Date, default: Date.now },
  description: { type: String, default: '' } // ← NEW
}];
module.exports = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);
*/
// Updated file: backend/models/Teacher.js
const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  files: [{
    filename: { type: String, required: true },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    description: { type: String, default: '' },
    fileType: { type: String }, // Optional: store mime type
    fileSize: { type: Number } // Optional: store file size
  }]
});

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);