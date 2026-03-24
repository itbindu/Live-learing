// src/utils/socket.js
import io from 'socket.io-client';
import { API_URL } from '../api/config';

// Get the appropriate socket URL
const getSocketUrl = () => {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }
  return API_URL;
};

const SOCKET_URL = getSocketUrl();
console.log('🔌 Socket URL configured:', SOCKET_URL);

let socketInstance = null;

export const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true,
      path: '/socket.io/'
    });
  }
  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};