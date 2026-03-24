// src/components/Teacher/LMSPage.js
import React, { useState, useEffect, useRef } from "react";
import api from "../../api/config";
import { useNavigate } from "react-router-dom";
import "./LMSPage.css";

const LMSPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadMessage, setUploadMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState("");

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/teachers/my-files");
      console.log("Files from server:", res.data.files);
      setUploadedFiles(res.data.files || []);
    } catch (err) {
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setUploadMessage("");
  };

  const removeSelectedFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (files.length === 0) {
      setUploadMessage("Please select at least one file");
      return;
    }

    const formData = new FormData();
    files.forEach((f) => formData.append("file", f));
    formData.append("description", description);

    try {
      const res = await api.post("/api/teachers/upload-file", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadMessage(res.data.message || "Upload successful");
      setFiles([]);
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchUploadedFiles();
    } catch (error) {
      console.error("Upload error:", error);
      setUploadMessage(error.response?.data?.message || "Upload failed");
    }
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

  const openFile = (file) => {
    const url = getFileUrl(file);
    console.log("Opening file:", url);
    window.open(url, '_blank');
  };

  const downloadFile = (file) => {
    const url = getFileUrl(file);
    console.log("Downloading from:", url);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await api.delete(`/api/teachers/file/${fileId}`);
      setUploadMessage('File deleted successfully');
      fetchUploadedFiles();
    } catch (error) {
      console.error('Delete error:', error);
      setUploadMessage('Failed to delete file');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getFileIcon = (file) => {
    const filename = file.filename?.toLowerCase() || '';
    const category = file.category || '';
    
    if (category === 'image' || filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/)) {
      return '🖼️';
    }
    if (category === 'video' || filename.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/)) {
      return '🎬';
    }
    if (category === 'audio' || filename.match(/\.(mp3|wav|m4a|aac|flac)$/)) {
      return '🎵';
    }
    if (category === 'pdf' || filename.endsWith('.pdf')) {
      return '📄';
    }
    if (category === 'document' || filename.match(/\.(doc|docx|txt|rtf|md)$/)) {
      return '📝';
    }
    if (category === 'spreadsheet' || filename.match(/\.(xls|xlsx|csv)$/)) {
      return '📊';
    }
    if (category === 'presentation' || filename.match(/\.(ppt|pptx)$/)) {
      return '📽️';
    }
    if (category === 'archive' || filename.match(/\.(zip|rar|7z|tar|gz)$/)) {
      return '🗜️';
    }
    return '📁';
  };

  const isCloudinaryFile = (file) => {
    return file.path && (file.path.includes('cloudinary') || file.path.includes('res.cloudinary'));
  };

  const isLocalFile = (file) => {
    return file.path && file.path.startsWith('/uploads/');
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
    <div className="lms-container">
      <div className="lms-header">
        <h1>LMS – Learning Materials</h1>
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate("/teacher/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div className="upload-section">
        <h2>Upload New File (All Types Supported)</h2>

        <form onSubmit={handleUpload} className="upload-form">
          <textarea
            className="description-input"
            placeholder="Enter description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <div className="file-picker">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              hidden
              accept="*/*" // Accept all file types
            />
            <button
              type="button"
              className="choose-btn"
              onClick={() => fileInputRef.current.click()}
            >
              Choose Files
            </button>
            <span className="file-count">
              {files.length > 0 ? `${files.length} file(s) selected` : 'No files selected'}
            </span>
          </div>

          {files.length > 0 && (
            <div className="selected-files">
              {files.map((file, index) => (
                <div key={index} className="selected-file">
                  <span className="file-icon-small">{getFileIcon({ filename: file.name })}</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => removeSelectedFile(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="upload-button"
            disabled={files.length === 0}
          >
            Upload to Cloudinary {files.length > 0 ? `(${files.length} files)` : ''}
          </button>
        </form>

        {uploadMessage && (
          <p
            className={`upload-status ${
              uploadMessage.includes("success") ? "success" : "error"
            }`}
          >
            {uploadMessage}
          </p>
        )}
      </div>

      <div className="files-section">
        <h2>Your Files ({uploadedFiles.length})</h2>

        {loading ? (
          <p className="loading">Loading...</p>
        ) : uploadedFiles.length === 0 ? (
          <p className="no-files">No files uploaded yet.</p>
        ) : (
          <div className="file-list">
            {uploadedFiles.map((file, index) => {
              const displayName = cleanFilename(file.filename || '');
              const fileIcon = getFileIcon(file);
              
              return (
                <div key={file._id || index} className="file-card">
                  <div className="file-header">
                    <div className="file-icon-large">{fileIcon}</div>
                    <h3 className="file-name" title={file.filename}>
                      {displayName.length > 30 
                        ? displayName.substring(0, 30) + '...' 
                        : displayName}
                    </h3>
                  </div>
                  
                  <div className="file-badges">
                    {file.category && (
                      <span className={`badge category-badge ${file.category}`}>
                        {file.category}
                      </span>
                    )}
                    {isCloudinaryFile(file) && (
                      <span className="badge cloudinary-badge" title="Stored in Cloudinary">☁️ Cloud</span>
                    )}
                    {isLocalFile(file) && (
                      <span className="badge local-badge" title="Stored on server">📁 Server</span>
                    )}
                  </div>
                  
                  <p className="file-description">
                    {file.description || "No description"}
                  </p>
                  
                  <div className="file-meta">
                    <span className="file-date">
                      📅 {new Date(file.uploadedAt).toLocaleDateString()}
                    </span>
                    <span className="file-size-badge">
                      💾 {formatFileSize(file.fileSize)}
                    </span>
                  </div>

                  <div className="file-actions">
                    <button
                      onClick={() => openFile(file)}
                      className="file-action-btn view-btn"
                      title="Open file"
                    >
                      👁️ View
                    </button>
                    <button
                      onClick={() => downloadFile(file)}
                      className="file-action-btn download-btn"
                      title="Download file"
                    >
                      ⬇️ Download
                    </button>
                    <button
                      onClick={() => deleteFile(file._id)}
                      className="file-action-btn delete-btn"
                      title="Delete file"
                    >
                      🗑️ Delete
                    </button>
                  </div>

                  {isLocalFile(file) && (
                    <div className="file-warning">
                      ⚠️ File stored on server (may not persist after restart)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LMSPage;