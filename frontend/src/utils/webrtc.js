// src/utils/webrtc.js
export const getIceServers = () => {
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };
};

export const createPeerConnection = (onTrack, onIceCandidate, onConnectionStateChange) => {
  const configuration = getIceServers();
  const pc = new RTCPeerConnection(configuration);
  
  pc.ontrack = (event) => {
    console.log('Track received:', event.track.kind);
    onTrack(event);
  };
  
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };
  
  pc.onconnectionstatechange = () => {
    console.log('Connection state:', pc.connectionState);
    if (onConnectionStateChange) {
      onConnectionStateChange(pc.connectionState);
    }
  };
  
  pc.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', pc.iceConnectionState);
  };
  
  return pc;
};

export const addLocalStream = async (pc, stream) => {
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });
};

export const createOffer = async (pc) => {
  try {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await pc.setLocalDescription(offer);
    return offer;
  } catch (error) {
    console.error('Error creating offer:', error);
    throw error;
  }
};

export const createAnswer = async (pc) => {
  try {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  } catch (error) {
    console.error('Error creating answer:', error);
    throw error;
  }
};

export const handleOffer = async (pc, offer) => {
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await createAnswer(pc);
    return answer;
  } catch (error) {
    console.error('Error handling offer:', error);
    throw error;
  }
};

export const handleAnswer = async (pc, answer) => {
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.error('Error handling answer:', error);
    throw error;
  }
};

export const addIceCandidate = async (pc, candidate) => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
};