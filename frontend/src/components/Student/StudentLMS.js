// src/components/Student/StudentLMS.js
import React, { useState, useEffect } from 'react';
import api from '../../api/config';
import { useNavigate } from 'react-router-dom';
import './StudentLMS.css';

const StudentLMS = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchLMSFiles();
  }, []);

  const fetchLMSFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/student/login');
        return;
      }

      const response = await api.get('/api/students/lms-files');
      setFiles(response.data.files || []);
    } catch (err) {
      console.error('LMS files error:', err);
      setError('Failed to load learning materials. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (file) => {
    const filename = file.filename?.toLowerCase() || '';
    
    if (filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/)) return '🖼️';
    if (filename.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/)) return '🎬';
    if (filename.match(/\.(mp3|wav|m4a|aac|flac)$/)) return '🎵';
    if (filename.endsWith('.pdf')) return '📄';
    if (filename.match(/\.(doc|docx|txt|rtf|md)$/)) return '📝';
    if (filename.match(/\.(xls|xlsx|csv)$/)) return '📊';
    if (filename.match(/\.(ppt|pptx)$/)) return '📽️';
    if (filename.match(/\.(zip|rar|7z|tar|gz)$/)) return '🗜️';
    return '📁';
  };

  const getFileUrl = (file) => {
    if (file.path && (file.path.includes('cloudinary') || file.path.includes('res.cloudinary'))) {
      return file.path;
    }
    
    if (file.path && file.path.startsWith('/uploads/')) {
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://live-learing.onrender.com/' 
        : 'http://localhost:5000';
      
      return `${baseUrl}${file.path}`;
    }
    
    return file.path || '#';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const cleanFilename = (filename) => {
    if (!filename) return '';
    let cleaned = filename;
    while (cleaned.includes('.pdf.pdf')) {
      cleaned = cleaned.replace('.pdf.pdf', '.pdf');
    }
    return cleaned;
  };

  return (
    <div className="student-lms-container">
      <div className="lms-header">
        <h1>Learning Materials (LMS)</h1>
        <button className="back-btn" onClick={() => navigate('/student/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <div className="loading">Loading your course materials...</div>
      ) : files.length === 0 ? (
        <div className="no-files">
          <p>No materials available yet from your assigned teachers.</p>
          <small>Contact your teacher to upload notes, PDFs, or other resources.</small>
        </div>
      ) : (
        <div className="files-grid">
          {files.map((file, index) => (
            <div key={index} className="file-card">
              <div className="file-icon-large">{getFileIcon(file)}</div>
              <div className="file-info">
                <h3 className="file-name" title={file.filename}>
                  {cleanFilename(file.filename).length > 40 
                    ? cleanFilename(file.filename).substring(0, 40) + '...' 
                    : cleanFilename(file.filename)}
                </h3>
                
                {file.description && (
                  <p className="file-description">{file.description}</p>
                )}
                
                <div className="file-meta">
                  <p className="file-teacher">
                    <span className="label">Teacher:</span> {file.teacherName}
                  </p>
                  
                  <p className="file-date">
                    <span className="label">Uploaded:</span>{' '}
                    {new Date(file.uploadedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                  
                  {file.fileSize && (
                    <p className="file-size">
                      <span className="label">Size:</span> {formatFileSize(file.fileSize)}
                    </p>
                  )}
                </div>
              </div>

              <div className="file-actions">
                <a
                  href={getFileUrl(file)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-btn view-btn"
                >
                  👁️ View
                </a>
                <a
                  href={getFileUrl(file)}
                  download={file.filename}
                  className="download-btn"
                >
                  ⬇️ Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentLMS;