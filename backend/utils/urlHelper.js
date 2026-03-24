// utils/urlHelper.js

const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || 'https://live-learn-gray.vercel.app';
  }
  return process.env.FRONTEND_URL || 'http://localhost:3000';
};

const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || 'https://live-learn.onrender.com';
  }
  return process.env.BACKEND_URL || 'http://localhost:5000';
};

const getSocketUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.SOCKET_URL || 'https://live-learn.onrender.com';
  }
  return process.env.SOCKET_URL || 'http://localhost:5000';
};

module.exports = { getFrontendUrl, getBackendUrl, getSocketUrl };