// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, Monitor, Users, MessageSquare,
  ScreenShare, LogOut, Copy, Check, Clock, X, VolumeX, Share2,
  Maximize, Minimize, StopCircle, Grid, Layout, 
  Wifi, WifiOff, Settings, ThumbsUp, Smile
} from 'lucide-react';
import BreakoutRoom from './BreakoutRoom';
import { API_URL } from '../api/config';
import './MeetingRoom.css';

const MeetingRoom = ({ role = 'student' }) => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  
  console.log("🎯 MeetingRoom Component - Meeting ID from URL:", meetingId);
  console.log("🎯 MeetingRoom Component - Role:", role);
  console.log("🎯 MeetingRoom Component - BACKEND_URL:", API_URL);
  
  // ============ ENVIRONMENT VARIABLE ============
  const BACKEND_URL = API_URL;
  
  // ============ STATES ============
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [meetingTopic, setMeetingTopic] = useState('Virtual Classroom');
  const [meetingTime, setMeetingTime] = useState('00:00');
  const [meetingStartTime] = useState(new Date());
  const [participantCount, setParticipantCount] = useState(1);
  
  // Media states
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareAvailable, setScreenShareAvailable] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  
  // Participants
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // UI states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [screenShareParticipant, setScreenShareParticipant] = useState(null);
  const [hasScreenShare, setHasScreenShare] = useState(false);
  const [layout, setLayout] = useState('grid');
  const [showBreakout, setShowBreakout] = useState(false);
  
  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const chatEndRef = useRef(null);
  const peerConnections = useRef({});
  const screenPeerConnections = useRef({});
  const videoGridRef = useRef(null);
  const hasRecordedJoin = useRef(false);
  const hasRecordedLeave = useRef(false);

  // STUN Servers
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  };

  // ============ ATTENDANCE FUNCTION ============
  const saveAttendanceToLocalStorage = (type, record) => {
    try {
      if (!record || !record.userId || !record.userName) {
        console.error('❌ Invalid record for attendance:', record);
        return;
      }
      
      const storageKey = `attendance_${meetingId}`;
      let records = JSON.parse(localStorage.getItem(storageKey) || "[]");

      if (type === "join") {
        const existingIndex = records.findIndex(
          r => r.userId === record.userId && !r.leftAt
        );

        if (existingIndex !== -1) {
          console.log("⚠️ Already active, skip duplicate join for:", record.userName);
          return;
        }

        records.push({
          userId: record.userId,
          userName: record.userName,
          email: record.email || '',
          role: record.role || role,
          meetingId: meetingId,
          joinedAt: new Date().toISOString(),
          isActive: true,
          leftAt: null,
          duration: null
        });
        console.log('✅ Attendance join recorded in localStorage for:', record.userName);
      }

      if (type === "leave") {
        const existingIndex = records.findIndex(
          r => r.userId === record.userId && !r.leftAt
        );

        if (existingIndex !== -1) {
          const leftAt = new Date().toISOString();
          const joinTime = new Date(records[existingIndex].joinedAt).getTime();
          const leaveTime = new Date(leftAt).getTime();
          const duration = Math.round((leaveTime - joinTime) / 1000);

          records[existingIndex] = {
            ...records[existingIndex],
            leftAt,
            duration: duration,
            isActive: false
          };
          console.log('✅ Attendance leave recorded in localStorage for:', record.userName, 'Duration:', duration, 'seconds');
          hasRecordedLeave.current = true;
        }
      }

      localStorage.setItem(storageKey, JSON.stringify(records));
      
      // Also try to save to server
      saveAttendanceToServer(meetingId, type, record);
      
    } catch (error) {
      console.error('Error saving attendance to localStorage:', error);
    }
  };

  const saveAttendanceToServer = async (meetingId, type, record) => {
    try {
      if (!record || !record.userId || !record.userName) {
        console.error('❌ Cannot save to server: Invalid record data', record);
        return;
      }
      
      const token = localStorage.getItem('token');
      
      console.log(`📤 Sending attendance to server: ${type} for ${record.userName}`);
      
      const response = await fetch(`${BACKEND_URL}/api/attendance/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          meetingId,
          type,
          record: {
            userId: record.userId,
            userName: record.userName,
            email: record.email || userEmail,
            role: record.role || role,
            joinedAt: record.joinedAt || new Date().toISOString(),
            leftAt: record.leftAt || null
          }
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ Attendance saved to server: ${type} for ${record.userName}`);
      } else {
        console.error(`❌ Server error (${response.status}):`, data.error);
      }
    } catch (error) {
      console.error('❌ Error saving attendance to server:', error);
    }
  };

  // ============ FETCH ATTENDANCE FROM SERVER ============
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/attendance/${meetingId}`);
        const data = await response.json();
        
        if (data.success && data.records && data.records.length > 0) {
          console.log(`✅ Found ${data.records.length} attendance records from server`);
          const storageKey = `attendance_${meetingId}`;
          localStorage.setItem(storageKey, JSON.stringify(data.records));
        }
      } catch (error) {
        console.error('❌ Error fetching attendance:', error);
      }
    };
    
    if (meetingId) {
      fetchAttendance();
    }
  }, [meetingId, BACKEND_URL]);

  // ============ JOIN TRACKING ============
  useEffect(() => {
    if (!userId || !userName || hasRecordedJoin.current) return;
    
    const joinRecord = {
      userId: userId,
      userName: userName,
      email: userEmail,
      role: role,
      joinedAt: new Date().toISOString()
    };
    
    console.log('📝 Recording join for:', userName);
    saveAttendanceToLocalStorage("join", joinRecord);
    hasRecordedJoin.current = true;
  }, [userId, userName, userEmail, role]);

  // ============ MEDIA FUNCTIONS ============
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing media:', error);
      setCameraOn(false);
      setMicOn(false);
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
        
        socketRef.current?.emit('media-state-changed', {
          meetingId,
          userId,
          audioEnabled: audioTrack.enabled,
          videoEnabled: cameraOn
        });
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
        
        socketRef.current?.emit('media-state-changed', {
          meetingId,
          userId,
          audioEnabled: micOn,
          videoEnabled: videoTrack.enabled
        });
      }
    }
  };

  // ============ WEBRTC FUNCTIONS ============
  const createPeerConnection = (targetUserId) => {
    const pc = new RTCPeerConnection(configuration);
    peerConnections.current[targetUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('send-ice-candidate', {
          meetingId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      
      let videoElement = document.getElementById(`remote-video-${targetUserId}`);
      
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.id = `remote-video-${targetUserId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = 'remote-video';
        
        const tile = document.getElementById(`tile-${targetUserId}`);
        if (tile) {
          tile.appendChild(videoElement);
        }
      }
      
      videoElement.srcObject = remoteStream;
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socketRef.current?.emit('send-offer', {
          meetingId,
          targetUserId,
          offer: pc.localDescription
        });
      })
      .catch(error => console.error('Error creating offer:', error));

    return pc;
  };

  const handleReceiveOffer = async ({ fromUserId, offer }) => {
    if (!peerConnections.current[fromUserId]) {
      createPeerConnection(fromUserId);
    }

    const pc = peerConnections.current[fromUserId];

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('send-answer', {
        meetingId,
        targetUserId: fromUserId,
        answer: pc.localDescription
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleReceiveAnswer = async ({ fromUserId, answer }) => {
    const pc = peerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  const handleReceiveICECandidate = async ({ fromUserId, candidate }) => {
    const pc = peerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  // ============ SCREEN SHARING FUNCTIONS ============
  const ensureScreenShareContainer = (sharerName) => {
    // First remove existing container if any
    const existingContainer = document.getElementById('screen-share-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    
    let screenContainer = document.getElementById('screen-share-container');
    
    if (!screenContainer) {
      screenContainer = document.createElement('div');
      screenContainer.id = 'screen-share-container';
      screenContainer.className = 'screen-share-container';
      
      const header = document.createElement('div');
      header.className = 'screen-share-header';
      
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '20');
      icon.setAttribute('height', '20');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.innerHTML = '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
      
      const span = document.createElement('span');
      span.id = 'screen-share-header-text';
      span.textContent = `${sharerName || 'Someone'} is sharing their screen`;
      
      header.appendChild(icon);
      header.appendChild(span);
      
      // Add stop button only for the sharer
      if (role === 'teacher' || userId === screenShareParticipant?.userId) {
        const stopBtn = document.createElement('button');
        stopBtn.className = 'stop-screen-share-btn';
        stopBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Stop Sharing';
        stopBtn.onclick = () => stopScreenSharing();
        header.appendChild(stopBtn);
      }
      
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'screen-share-video-wrapper';
      
      const screenVideo = document.createElement('video');
      screenVideo.id = 'screen-share-video';
      screenVideo.className = 'screen-share-video';
      screenVideo.autoplay = true;
      screenVideo.playsInline = true;
      
      videoWrapper.appendChild(screenVideo);
      screenContainer.appendChild(header);
      screenContainer.appendChild(videoWrapper);
      
      // Find video container and insert at the top
      const videoContainer = document.querySelector('.meeting-room .video-container');
      if (videoContainer) {
        videoContainer.insertBefore(screenContainer, videoContainer.firstChild);
        console.log('✅ Screen share container added at top');
      }
    }
    
    return screenContainer;
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenSharing();
    } else {
      try {
        await startScreenSharing();
      } catch (error) {
        console.error('Error starting screen share:', error);
        alert('Could not start screen sharing. Please check permissions.');
      }
    }
  };

  const startScreenSharing = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });
      
      screenStreamRef.current = screenStream;
      
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

      setIsScreenSharing(true);
      setScreenShareParticipant({ userId, userName });
      setHasScreenShare(true);
      
      ensureScreenShareContainer(userName);
      const previewVideo = document.getElementById('screen-share-video');
      if (previewVideo) {
        previewVideo.srcObject = screenStream;
      }

      socketRef.current?.emit('screen-share-started', {
        meetingId,
        userId,
        userName
      });

      for (const participant of participants) {
        if (participant.userId !== userId) {
          createScreenPeerConnection(participant.userId, screenStream);
        }
      }

    } catch (error) {
      console.error('Screen sharing error:', error);
    }
  };

  const stopScreenSharing = () => {
    console.log('🛑 Stopping screen share');
    
    // Stop all tracks in the stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      screenStreamRef.current = null;
    }

    // Reset state
    setIsScreenSharing(false);
    setScreenShareParticipant(null);
    setHasScreenShare(false);

    // Remove the screen share container from DOM
    const screenContainer = document.getElementById('screen-share-container');
    if (screenContainer) {
      screenContainer.remove();
      console.log('✅ Screen share container removed');
    }

    // Notify other participants
    socketRef.current?.emit('screen-share-stopped', {
      meetingId,
      userId
    });

    // Close all screen share peer connections
    Object.values(screenPeerConnections.current).forEach(pc => {
      try {
        pc.close();
      } catch (err) {
        console.error('Error closing peer connection:', err);
      }
    });
    screenPeerConnections.current = {};
    
    console.log('✅ Screen sharing fully stopped and cleaned up');
  };

  const createScreenPeerConnection = (targetUserId, stream) => {
    const pc = new RTCPeerConnection(configuration);
    screenPeerConnections.current[targetUserId] = pc;

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('send-screen-ice-candidate', {
          meetingId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socketRef.current?.emit('send-screen-offer', {
          meetingId,
          targetUserId,
          offer: pc.localDescription
        });
      })
      .catch(error => console.error('Error creating screen offer:', error));

    return pc;
  };

  const handleReceiveScreenOffer = async ({ fromUserId, offer }) => {
    if (!screenPeerConnections.current[fromUserId]) {
      const pc = new RTCPeerConnection(configuration);
      screenPeerConnections.current[fromUserId] = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit('send-screen-ice-candidate', {
            meetingId,
            targetUserId: fromUserId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        
        let screenVideo = document.getElementById('screen-share-video');
        
        if (!screenVideo) {
          const sharer = participants.find(p => p.userId === fromUserId);
          ensureScreenShareContainer(sharer?.userName || 'Someone');
          screenVideo = document.getElementById('screen-share-video');
        }
        
        if (screenVideo) {
          screenVideo.srcObject = remoteStream;
          setHasScreenShare(true);
          setScreenShareParticipant({ 
            userId: fromUserId, 
            userName: participants.find(p => p.userId === fromUserId)?.userName || 'Someone' 
          });
        }
      };
    }

    const pc = screenPeerConnections.current[fromUserId];

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit('send-screen-answer', {
        meetingId,
        targetUserId: fromUserId,
        answer: pc.localDescription
      });
    } catch (error) {
      console.error('Error handling screen offer:', error);
    }
  };

  const handleReceiveScreenAnswer = async ({ fromUserId, answer }) => {
    const pc = screenPeerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling screen answer:', error);
      }
    }
  };

  const handleReceiveScreenICECandidate = async ({ fromUserId, candidate }) => {
    const pc = screenPeerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding screen ICE candidate:', error);
      }
    }
  };

  // ============ TIMER ============
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - meetingStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setMeetingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [meetingStartTime]);

  // ============ CHAT ============
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || connectionStatus !== 'connected') return;

    const message = {
      id: Date.now().toString(),
      userId,
      userName,
      text: chatMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socketRef.current?.emit('chat-message', { meetingId, message });
    setMessages(prev => [...prev, message]);
    setChatMessage('');
  };

  useEffect(() => {
    if (chatEndRef.current && showChat) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // ============ UI FUNCTIONS ============
  const toggleParticipants = () => {
    setShowParticipants(!showParticipants);
    setShowChat(false);
    setShowBreakout(false);
  };

  const toggleChat = () => {
    setShowChat(!showChat);
    setShowParticipants(false);
    setShowBreakout(false);
    if (!showChat) setUnreadMessages(0);
  };

  const toggleBreakout = () => {
    setShowBreakout(!showBreakout);
    setShowParticipants(false);
    setShowChat(false);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  const muteParticipant = (participantId) => {
    if (role !== 'teacher') return;
    socketRef.current?.emit('mute-participant', { meetingId, userId: participantId });
  };

  // ================= LEAVE FUNCTION =================
  const leaveMeetingOnly = () => {
    if (hasRecordedLeave.current) return;
    
    const leaveRecord = {
      userId: userId,
      userName: userName,
      role: role,
      leftAt: new Date().toISOString()
    };
    
    console.log('📝 Recording leave for:', userName);
    saveAttendanceToLocalStorage("leave", leaveRecord);

    if (isScreenSharing) stopScreenSharing();

    socketRef.current?.emit("leave-meeting", {
      meetingId,
      userId
    });

    navigate(role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
    
    participants.forEach(participant => {
      const leaveRecord = {
        userId: participant.userId,
        userName: participant.userName,
        role: participant.role,
        leftAt: new Date().toISOString()
      };
      saveAttendanceToLocalStorage('leave', leaveRecord);
    });
    
    // Also record the teacher's own leave
    const teacherLeaveRecord = {
      userId: userId,
      userName: userName,
      role: role,
      leftAt: new Date().toISOString()
    };
    saveAttendanceToLocalStorage('leave', teacherLeaveRecord);
    
    if (isScreenSharing) stopScreenSharing();
    socketRef.current?.emit('end-meeting', { meetingId });
    navigate('/teacher/dashboard');
  };

  // ============ INITIALIZE ============
  useEffect(() => {
    let storedId = localStorage.getItem("meetingUserId");
    
    if (!storedId) {
      storedId = `${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("meetingUserId", storedId);
    }
    
    setUserId(storedId);
    
    if (role === 'teacher') {
      const teacherData = JSON.parse(localStorage.getItem('teacherUser') || '{}');
      const fullName = `${teacherData.firstName || ''} ${teacherData.lastName || ''}`.trim();
      setUserName(fullName || 'Teacher');
      setUserEmail(teacherData.email || '');
      localStorage.setItem('teacherName', fullName || 'Teacher');
    } else {
      const studentName = localStorage.getItem('currentStudentName') || 
                         localStorage.getItem('studentName') || 
                         `Student_${Math.floor(Math.random() * 1000)}`;
      const studentEmail = localStorage.getItem('studentEmail') || '';
      
      setUserName(studentName);
      setUserEmail(studentEmail);
      console.log('Student name set to:', studentName);
      console.log('Student email set to:', studentEmail);
    }

    const storedTopic = localStorage.getItem(`meetingTopic_${meetingId}`) || 'Virtual Classroom';
    setMeetingTopic(storedTopic);

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true,
      path: '/socket.io/'
    });
    
    socketRef.current = socket;

    initLocalStream();

    // ============ PAGE REFRESH / TAB CLOSE HANDLER ============
    const handleBeforeUnload = () => {
      if (!hasRecordedLeave.current && userId && userName && meetingId) {
        console.log('📝 Recording leave due to page refresh/close for:', userName);
        const leaveRecord = {
          userId: userId,
          userName: userName,
          role: role,
          leftAt: new Date().toISOString()
        };
        saveAttendanceToLocalStorage("leave", leaveRecord);
        
        if (socketRef.current) {
          socketRef.current.emit('leave-meeting', { meetingId, userId });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    socket.on('connect', () => {
      console.log('✅ Connected to server at:', BACKEND_URL);
      setConnectionStatus('connected');
      
      socket.emit('join-meeting', {
        meetingId,
        userId: storedId,
        userName: userName,
        role,
        email: userEmail
      });
      
      console.log('Joining meeting as:', userName, 'with role:', role, 'email:', userEmail, 'userId:', storedId);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('error');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected');
      setConnectionStatus('connecting');
    });

    socket.on('all-users', (users) => {
      console.log('👥 All users received:', users);
      const usersWithNames = users.map(user => ({
        ...user,
        userName: user.userName || user.name || 'Unknown User'
      }));
      setParticipants(usersWithNames);
      setParticipantCount(usersWithNames.length + 1);
      
      setTimeout(() => {
        usersWithNames.forEach(user => {
          if (user.userId !== storedId) {
            createPeerConnection(user.userId);
          }
        });
      }, 1000);
    });

    socket.on('user-joined', (user) => {
      console.log('👤 User joined with data:', user);
      if (user.userId === storedId) return;
      
      const newUser = {
        ...user,
        userName: user.userName || user.name || 'New User'
      };
      
      setParticipants(prev => {
        const exists = prev.some(p => p.userId === newUser.userId);
        if (exists) return prev;
        return [...prev, newUser];
      });
      setParticipantCount(prev => prev + 1);
      
      if (!peerConnections.current[newUser.userId]) {
        createPeerConnection(newUser.userId);
      }

      if (isScreenSharing && screenStreamRef.current) {
        setTimeout(() => {
          createScreenPeerConnection(newUser.userId, screenStreamRef.current);
        }, 1000);
      }
    });

    socket.on('attendance-recorded', (data) => {
      console.log('📊 Attendance recorded from server:', data);
    });

    socket.on('receive-offer', handleReceiveOffer);
    socket.on('receive-answer', handleReceiveAnswer);
    socket.on('receive-ice-candidate', handleReceiveICECandidate);
    
    socket.on('screen-share-started', ({ userId: sharerId, userName: sharerName }) => {
      console.log('📺 Screen sharing started by:', sharerName);
      
      // If someone else is already sharing, update to new sharer
      if (screenShareParticipant && screenShareParticipant.userId !== sharerId) {
        console.log('⚠️ Another user is already sharing, updating to new sharer');
        const existingContainer = document.getElementById('screen-share-container');
        if (existingContainer) {
          existingContainer.remove();
        }
      }
      
      setScreenShareParticipant({ userId: sharerId, userName: sharerName });
      setHasScreenShare(true);
      
      // Only create container for viewers, not for the sharer themselves
      if (sharerId !== storedId) {
        ensureScreenShareContainer(sharerName);
      }
    });

    socket.on('screen-share-stopped', ({ userId: sharerId }) => {
      console.log('📺 Screen sharing stopped by:', sharerId);
      
      if (screenShareParticipant?.userId === sharerId) {
        setScreenShareParticipant(null);
        setHasScreenShare(false);
        
        const screenContainer = document.getElementById('screen-share-container');
        if (screenContainer) {
          screenContainer.remove();
          console.log('✅ Screen share container removed');
        }
      }
      
      if (screenPeerConnections.current[sharerId]) {
        try {
          screenPeerConnections.current[sharerId].close();
        } catch (err) {
          console.error('Error closing peer connection:', err);
        }
        delete screenPeerConnections.current[sharerId];
      }
    });

    socket.on('receive-screen-offer', handleReceiveScreenOffer);
    socket.on('receive-screen-answer', handleReceiveScreenAnswer);
    socket.on('receive-screen-ice-candidate', handleReceiveScreenICECandidate);
    
    socket.on('user-left', (leftUserId) => {
      console.log('👋 User left:', leftUserId);
      
      if (peerConnections.current[leftUserId]) {
        peerConnections.current[leftUserId].close();
        delete peerConnections.current[leftUserId];
      }
      
      if (screenPeerConnections.current[leftUserId]) {
        screenPeerConnections.current[leftUserId].close();
        delete screenPeerConnections.current[leftUserId];
      }

      if (screenShareParticipant?.userId === leftUserId) {
        setScreenShareParticipant(null);
        setHasScreenShare(false);
        const screenContainer = document.getElementById('screen-share-container');
        if (screenContainer) screenContainer.remove();
      }
      
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      setParticipantCount(prev => prev - 1);
    });

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (!showChat) setUnreadMessages(prev => prev + 1);
    });

    socket.on('media-state-changed', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId 
          ? { ...p, audioEnabled: data.audioEnabled, videoEnabled: data.videoEnabled }
          : p
      ));
    });

    socket.on('meeting-ended', (data) => {
      console.log('🏁 Meeting ended by host:', data);
      alert('Meeting has ended by the host. You will be redirected to dashboard.');
      
      const finalRecord = {
        userId: storedId,
        userName: userName,
        email: userEmail,
        role: role,
        leftAt: new Date().toISOString(),
        meetingEnded: true
      };
      
      saveAttendanceToLocalStorage('leave', finalRecord);
      
      if (isScreenSharing) {
        stopScreenSharing();
      }
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      Object.values(peerConnections.current).forEach(pc => pc.close());
      Object.values(screenPeerConnections.current).forEach(pc => pc.close());
      
      setTimeout(() => {
        navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
      }, 1000);
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      Object.values(peerConnections.current).forEach(pc => pc.close());
      Object.values(screenPeerConnections.current).forEach(pc => pc.close());
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', { meetingId, userId: storedId });
        socketRef.current.disconnect();
      }
    };
  }, [meetingId, role, userName, userEmail]);

  // ============ RENDER ============
  const totalParticipants = participants.length + 1;

  return (
    <div className="meeting-room">
      {connectionStatus !== 'connected' && (
        <div className={`connection-banner ${connectionStatus}`}>
          {connectionStatus === 'connecting' && (
            <>
              <WifiOff size={16} />
              Connecting to server...
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <WifiOff size={16} />
              Connection failed. Retrying...
            </>
          )}
        </div>
      )}

      <header className="meeting-header">
        <div className="header-left">
          <span className="meeting-time">
            <Clock size={16} />
            {meetingTime}
          </span>
          <span className="meeting-title">{meetingTopic}</span>
        </div>

        <div className="header-center">
          <button 
            className={`layout-btn ${layout === 'grid' ? 'active' : ''}`}
            onClick={() => setLayout('grid')}
            title="Grid view"
          >
            <Grid size={18} />
          </button>
          <button 
            className={`layout-btn ${layout === 'speaker' ? 'active' : ''}`}
            onClick={() => setLayout('speaker')}
            title="Speaker view"
          >
            <Layout size={18} />
          </button>
          <button 
            className="participant-count" 
            onClick={toggleParticipants}
          >
            <Users size={16} />
            <span>{totalParticipants}</span>
          </button>
        </div>

        <div className="header-right">
          <button className="icon-btn" onClick={copyMeetingLink} title="Copy meeting link">
            {linkCopied ? <Check size={18} /> : <Share2 size={18} />}
          </button>
          <button className="icon-btn" onClick={toggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button className="icon-btn" title="Settings">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="meeting-main">
        <div className={`video-container ${showParticipants || showChat || showBreakout ? 'with-sidebar' : ''}`}>
          <div 
            className={`video-grid ${layout} ${hasScreenShare ? 'has-screen-share' : ''}`}
            ref={videoGridRef}
          >
            <div className="video-tile local" id="local-tile">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="video-element"
              />
              {!cameraOn && (
                <div className="video-placeholder visible">
                  <div className="avatar">
                    {userName?.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="video-label">
                <span className="name">{userName} (You)</span>
                {role === 'teacher' && <span className="host-badge">HOST</span>}
                {!micOn && <MicOff size={14} />}
                {isScreenSharing && (
                  <span className="screen-share-badge">
                    <Monitor size={12} />
                    Sharing
                  </span>
                )}
              </div>
            </div>

            {participants.map((participant) => (
              <div 
                key={participant.userId}
                id={`tile-${participant.userId}`}
                className="video-tile remote"
              >
                <video
                  id={`remote-video-${participant.userId}`}
                  autoPlay
                  playsInline
                  className="video-element"
                />
                {!participant.videoEnabled && (
                  <div className="video-placeholder visible">
                    <div className="avatar">
                      {participant.userName?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="video-label">
                  <span className="name">{participant.userName}</span>
                  {participant.role === 'teacher' && <span className="host-badge">HOST</span>}
                  {!participant.audioEnabled && <MicOff size={14} />}
                  {participant.userId === screenShareParticipant?.userId && (
                    <span className="screen-share-badge">
                      <Monitor size={12} />
                      Sharing
                    </span>
                  )}
                </div>
                {role === 'teacher' && participant.role !== 'teacher' && (
                  <button 
                    className="mute-overlay"
                    onClick={() => muteParticipant(participant.userId)}
                    title="Mute participant"
                  >
                    <VolumeX size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {showParticipants && (
          <div className="sidebar participants-sidebar">
            <div className="sidebar-header">
              <h3>
                <Users size={16} />
                Participants ({totalParticipants})
              </h3>
              <button className="close-btn" onClick={toggleParticipants}>
                <X size={18} />
              </button>
            </div>
            <div className="participants-list">
              <div className="participant-item current">
                <div className="avatar-small">
                  {userName?.charAt(0).toUpperCase()}
                </div>
                <div className="participant-info">
                  <span className="name">{userName} (You)</span>
                  <span className="status">
                    {micOn ? 'Mic on' : 'Muted'} • {cameraOn ? 'Camera on' : 'Camera off'}
                  </span>
                </div>
              </div>
              
              {participants.map(p => (
                <div key={p.userId} className="participant-item">
                  <div className="avatar-small">
                    {p.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="participant-info">
                    <span className="name">
                      {p.userName}
                      {p.role === 'teacher' && <span className="host-tag">HOST</span>}
                    </span>
                    <span className="status">
                      {p.audioEnabled ? 'Mic on' : 'Muted'}
                    </span>
                  </div>
                  {role === 'teacher' && p.role !== 'teacher' && (
                    <button 
                      className="mute-small"
                      onClick={() => muteParticipant(p.userId)}
                      title="Mute"
                    >
                      <VolumeX size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showChat && (
          <div className="sidebar chat-sidebar">
            <div className="sidebar-header">
              <h3>
                <MessageSquare size={16} />
                Chat
              </h3>
              <button className="close-btn" onClick={toggleChat}>
                <X size={18} />
              </button>
            </div>
            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.userId === userId ? 'own' : ''}`}>
                  {msg.userId !== userId && (
                    <div className="message-sender">{msg.userName}</div>
                  )}
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">{msg.timestamp}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-input" onSubmit={sendChatMessage}>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={connectionStatus !== 'connected'}
              />
              <button type="submit" disabled={!chatMessage.trim()}>
                Send
              </button>
            </form>
          </div>
        )}

        {showBreakout && (
          <div className="sidebar breakout-sidebar">
            <div className="sidebar-header">
              <h3>
                <Users size={16} />
                Breakout Rooms
              </h3>
              <button className="close-btn" onClick={toggleBreakout}>
                <X size={18} />
              </button>
            </div>
            <BreakoutRoom
              meetingId={meetingId}
              userId={userId}
              userName={userName}
              role={role}
              participants={participants}
              socket={socketRef.current}
            />
          </div>
        )}

        {showLeaveOptions && (
          <div className="modal-overlay">
            <div className="leave-modal">
              <h2>Leave Meeting</h2>
              
              <button className="leave-option" onClick={leaveMeetingOnly}>
                <LogOut size={20} />
                <div>
                  <strong>Leave meeting</strong>
                  <span>You can rejoin later</span>
                </div>
              </button>
              
              {role === 'teacher' && (
                <button className="leave-option end" onClick={endMeetingForAll}>
                  <X size={20} />
                  <div>
                    <strong>End meeting for all</strong>
                    <span>Everyone will be removed</span>
                  </div>
                </button>
              )}
              
              <button className="cancel-btn" onClick={() => setShowLeaveOptions(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="meeting-footer">
        <div className="footer-left">
          <button 
            className={`control-btn ${!micOn ? 'off' : ''}`} 
            onClick={toggleMic}
            title={micOn ? 'Mute' : 'Unmute'}
          >
            {micOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
          
          <button 
            className={`control-btn ${!cameraOn ? 'off' : ''}`} 
            onClick={toggleCamera}
            title={cameraOn ? 'Stop video' : 'Start video'}
          >
            {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
          
          <button 
            className={`control-btn screen-share ${isScreenSharing ? 'active' : ''}`} 
            onClick={toggleScreenShare}
            disabled={!screenShareAvailable || (hasScreenShare && !isScreenSharing)}
            title="Share screen"
          >
            {isScreenSharing ? <StopCircle size={22} /> : <Monitor size={22} />}
          </button>
          
          <button 
            className={`control-btn ${showParticipants ? 'active' : ''}`} 
            onClick={toggleParticipants}
            title="Participants"
          >
            <Users size={22} />
            {totalParticipants > 0 && <span className="badge">{totalParticipants}</span>}
          </button>
        </div>

        <div className="footer-center">
          <button className="control-btn" title="Reactions">
            <ThumbsUp size={22} />
          </button>
          
          <button className="control-btn" title="Raise hand">
            <Smile size={22} />
          </button>
          
          <button 
            className={`control-btn ${showChat ? 'active' : ''}`} 
            onClick={toggleChat}
            title="Chat"
          >
            <MessageSquare size={22} />
            {unreadMessages > 0 && <span className="badge">{unreadMessages}</span>}
          </button>

          {role === 'teacher' && (
            <button 
              className={`control-btn ${showBreakout ? 'active' : ''}`} 
              onClick={toggleBreakout}
              title="Breakout Rooms"
            >
              <Users size={22} />
            </button>
          )}
        </div>

        <div className="footer-right">
          <button className="leave-btn" onClick={() => setShowLeaveOptions(true)}>
            <LogOut size={20} />
            <span>Leave</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default MeetingRoom;