import {useEffect, useRef, useCallback, useState} from 'react';
import freeice from 'freeice';
import useStateWithCallback from './useStateWithCallback';
import socket from '../socket';
import ACTIONS from '../socket/actions';

export const LOCAL_VIDEO = 'LOCAL_VIDEO';

// Функция для получения TURN серверов от внешнего API
const getTurnServers = async () => {
  try {
    // Используем бесплатный API для получения TURN серверов
    const response = await fetch('https://api.xirsys.com/getIceServers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ident: 'your_username',
        secret: 'your_secret',
        domain: 'your_domain',
        application: 'default',
        room: 'default',
        secure: 1
      })
    });
    
    const data = await response.json();
    return data.d.iceServers;
  } catch (error) {
    console.warn('Failed to get TURN servers from API, using fallback:', error);
    return null;
  }
};

// Базовые STUN серверы
const BASE_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
];

// Fallback TURN серверы
const FALLBACK_TURN_SERVERS = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:turn.voiparound.com:3478',
    username: 'webrtc',
    credential: 'webrtc'
  },
  {
    urls: 'turn:turn.voipstunt.com:3478',
    username: 'webrtc',
    credential: 'webrtc'
  }
];

export default function useWebRTC(roomID, userName) {
  const [clients, updateClients] = useStateWithCallback([]);
  const [iceServers, setIceServers] = useState([...BASE_STUN_SERVERS, ...FALLBACK_TURN_SERVERS]);

  // Получаем TURN серверы при инициализации
  useEffect(() => {
    getTurnServers().then(servers => {
      if (servers && servers.length > 0) {
        console.log('Using TURN servers from API');
        setIceServers([...BASE_STUN_SERVERS, ...servers]);
      } else {
        console.log('Using fallback TURN servers');
      }
    });
  }, []);

  const addNewClient = useCallback((newClient, cb) => {
    updateClients(list => {
      if (!list.includes(newClient)) {
        return [...list, newClient]
      }
      return list;
    }, cb);
  }, [updateClients]);

  const peerConnections = useRef({});
  const localMediaStream = useRef(null);
  const peerMediaElements = useRef({
    [LOCAL_VIDEO]: null,
  });
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  useEffect(() => {
    async function handleNewPeer({peerID, createOffer}) {
      if (peerID in peerConnections.current) {
        return console.warn(`Already connected to peer ${peerID}`);
      }

      console.log('Creating new peer connection for:', peerID, 'with', iceServers.length, 'ICE servers');
      peerConnections.current[peerID] = new RTCPeerConnection({
        iceServers: iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        sdpSemantics: 'unified-plan'
      });

      peerConnections.current[peerID].onicecandidate = event => {
        if (event.candidate) {
          console.log('Sending ICE candidate to:', peerID, 'type:', event.candidate.type, 'protocol:', event.candidate.protocol);
          socket.emit(ACTIONS.RELAY_ICE, {
            peerID,
            iceCandidate: event.candidate,
          });
        }
      }

      peerConnections.current[peerID].onconnectionstatechange = () => {
        const state = peerConnections.current[peerID].connectionState;
        console.log('Connection state for peer', peerID, ':', state);
        
        if (state === 'connected') {
          console.log('✅ WebRTC connection established with peer:', peerID);
        } else if (state === 'failed') {
          console.error('❌ WebRTC connection failed with peer:', peerID);
        }
      };

      peerConnections.current[peerID].oniceconnectionstatechange = () => {
        const state = peerConnections.current[peerID].iceConnectionState;
        console.log('ICE connection state for peer', peerID, ':', state);
        
        if (state === 'connected' || state === 'completed') {
          console.log('✅ ICE connection established with peer:', peerID);
        } else if (state === 'failed') {
          console.error('❌ ICE connection failed with peer:', peerID);
        }
      };

      peerConnections.current[peerID].onicegatheringstatechange = () => {
        console.log('ICE gathering state for peer', peerID, ':', peerConnections.current[peerID].iceGatheringState);
      };

      peerConnections.current[peerID].ontrack = ({streams: [remoteStream]}) => {
        console.log('Received remote stream for peer:', peerID, 'tracks:', remoteStream.getTracks().length);
        
        addNewClient(peerID, () => {
          if (peerMediaElements.current[peerID]) {
            peerMediaElements.current[peerID].srcObject = remoteStream;
            console.log('Set srcObject for peer:', peerID);
            
            peerMediaElements.current[peerID].play().catch(e => 
              console.error('Error playing video for peer:', peerID, e)
            );
          } else {
            let settled = false;
            const interval = setInterval(() => {
              if (peerMediaElements.current[peerID]) {
                peerMediaElements.current[peerID].srcObject = remoteStream;
                console.log('Set srcObject for peer (delayed):', peerID);
                
                peerMediaElements.current[peerID].play().catch(e => 
                  console.error('Error playing video for peer (delayed):', peerID, e)
                );
                
                settled = true;
              }

              if (settled) {
                clearInterval(interval);
              }
            }, 1000);
          }
        });
      }

      if (localMediaStream.current) {
        localMediaStream.current.getTracks().forEach(track => {
          console.log('Adding track to peer:', peerID, 'track kind:', track.kind);
          peerConnections.current[peerID].addTrack(track, localMediaStream.current);
        });
      }

      if (createOffer) {
        console.log('Creating offer for peer:', peerID);
        const offer = await peerConnections.current[peerID].createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          voiceActivityDetection: true
        });
        await peerConnections.current[peerID].setLocalDescription(offer);
        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: offer,
        });
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);

    return () => {
      socket.off(ACTIONS.ADD_PEER);
    }
  }, [addNewClient, iceServers]);

  useEffect(() => {
    async function setRemoteMedia({peerID, sessionDescription: remoteDescription}) {
      if (!peerConnections.current[peerID]) {
        console.warn('Peer connection not found for:', peerID);
        return;
      }

      console.log('Setting remote description for peer:', peerID, 'type:', remoteDescription.type);
      await peerConnections.current[peerID].setRemoteDescription(
        new RTCSessionDescription(remoteDescription)
      );

      if (remoteDescription.type === 'offer') {
        console.log('Creating answer for peer:', peerID);
        const answer = await peerConnections.current[peerID].createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          voiceActivityDetection: true
        });
        await peerConnections.current[peerID].setLocalDescription(answer);
        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: answer,
        });
      }
    }

    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia)

    return () => {
      socket.off(ACTIONS.SESSION_DESCRIPTION);
    }
  }, []);

  useEffect(() => {
    socket.on(ACTIONS.ICE_CANDIDATE, ({peerID, iceCandidate}) => {
      if (peerConnections.current[peerID]) {
        console.log('Adding ICE candidate for peer:', peerID, 'type:', iceCandidate.type);
        peerConnections.current[peerID].addIceCandidate(
          new RTCIceCandidate(iceCandidate)
        ).catch(e => {
          console.error('Error adding ICE candidate:', e);
        });
      }
    });

    return () => {
      socket.off(ACTIONS.ICE_CANDIDATE);
    }
  }, []);

  useEffect(() => {
    const handleRemovePeer = ({peerID}) => {
      console.log('Removing peer:', peerID);
      if (peerConnections.current[peerID]) {
        peerConnections.current[peerID].close();
      }

      delete peerConnections.current[peerID];
      delete peerMediaElements.current[peerID];

      updateClients(list => list.filter(c => c !== peerID));
    };

    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);

    return () => {
      socket.off(ACTIONS.REMOVE_PEER);
    }
  }, [updateClients]);

  useEffect(() => {
    async function startCapture() {
      try {
        console.log('Starting media capture...');
        localMediaStream.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2,
          },
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 },
            facingMode: 'user',
            // Улучшаем качество видео
            aspectRatio: { ideal: 16/9 },
          }
        });

        console.log('Media capture started, tracks:', localMediaStream.current.getTracks().length);

        addNewClient(LOCAL_VIDEO, () => {
          const localVideoElement = peerMediaElements.current[LOCAL_VIDEO];
          if (localVideoElement) {
            localVideoElement.volume = 0;
            localVideoElement.srcObject = localMediaStream.current;
            console.log('Set local video srcObject');
          }
        });

        socket.emit(ACTIONS.JOIN, {room: roomID, name: userName});
      } catch (e) {
        console.error('Error getting userMedia:', e);
      }
    }

    startCapture();

    return () => {
      if (localMediaStream.current) {
        localMediaStream.current.getTracks().forEach(track => track.stop());
      }
      socket.emit(ACTIONS.LEAVE);
    };
  }, [roomID, userName, addNewClient]);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
    console.log('Media ref provided for:', id);
  }, []);

  // Функция для принудительного переподключения
  const reconnectPeer = useCallback(async (peerID) => {
    if (peerConnections.current[peerID]) {
      console.log('Attempting to reconnect to peer:', peerID);
      peerConnections.current[peerID].close();
      delete peerConnections.current[peerID];
      
      // Создаем новое соединение
      peerConnections.current[peerID] = new RTCPeerConnection({
        iceServers: iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        sdpSemantics: 'unified-plan'
      });

      // Повторяем настройку соединения
      if (localMediaStream.current) {
        localMediaStream.current.getTracks().forEach(track => {
          peerConnections.current[peerID].addTrack(track, localMediaStream.current);
        });
      }

      const offer = await peerConnections.current[peerID].createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        voiceActivityDetection: true
      });
      await peerConnections.current[peerID].setLocalDescription(offer);
      socket.emit(ACTIONS.RELAY_SDP, {
        peerID,
        sessionDescription: offer,
      });
    }
  }, [iceServers]);

  // Функция для тестирования соединения
  const testConnection = useCallback(async () => {
    console.log('Testing WebRTC connection...');
    
    try {
      const testConnection = new RTCPeerConnection({
        iceServers: iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        sdpSemantics: 'unified-plan'
      });

      const testOffer = await testConnection.createOffer();
      await testConnection.setLocalDescription(testOffer);
      
      console.log('✅ WebRTC connection test successful');
      testConnection.close();
      return true;
    } catch (error) {
      console.error('❌ WebRTC connection test failed:', error);
      return false;
    }
  }, [iceServers]);

  // Запуск демонстрации экрана
  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          cursor: "always",
          displaySurface: "monitor"
        } 
      });
      
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;
      setIsScreenSharing(true);
      
      // Заменяем видеотрек во всех peerConnections
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
      
      // Локально тоже меняем
      if (peerMediaElements.current[LOCAL_VIDEO]) {
        peerMediaElements.current[LOCAL_VIDEO].srcObject = screenStream;
      }
      
      // Когда пользователь завершает шаринг экрана
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (e) {
      console.error('Error starting screen share:', e);
      setIsScreenSharing(false);
    }
  };

  // Остановка демонстрации экрана
  const stopScreenShare = () => {
    if (!screenTrackRef.current || !localMediaStream.current) return;
    
    // Возвращаем камеру
    const videoTrack = localMediaStream.current.getVideoTracks()[0];
    if (videoTrack) {
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });
      
      if (peerMediaElements.current[LOCAL_VIDEO]) {
        peerMediaElements.current[LOCAL_VIDEO].srcObject = localMediaStream.current;
      }
    }
    
    screenTrackRef.current.stop();
    screenTrackRef.current = null;
    setIsScreenSharing(false);
  };

  const toggleAudio = () => {
    if (!localMediaStream.current) return;
    const audioTrack = localMediaStream.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localMediaStream.current) return;
    const videoTrack = localMediaStream.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  };

  return {
    clients,
    provideMediaRef,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    userName
  };
}