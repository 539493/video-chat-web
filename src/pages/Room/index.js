import {useParams} from 'react-router';
import useWebRTC, {LOCAL_VIDEO} from '../../hooks/useWebRTC';
import React, { useState, useRef, useEffect } from 'react';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';
import { useHistory } from 'react-router';
import { useLocation } from 'react-router';

function layout(clientsNumber = 1) {
  const pairs = Array.from({length: clientsNumber})
    .reduce((acc, next, index, arr) => {
      if (index % 2 === 0) {
        acc.push(arr.slice(index, index + 2));
      }

      return acc;
    }, []);

  const rowsNumber = pairs.length;
  const height = `${100 / rowsNumber}%`;

  return pairs.map((row, index, arr) => {

    if (index === arr.length - 1 && row.length === 1) {
      return [{
        width: '100%',
        height,
      }];
    }

    return row.map(() => ({
      width: '50%',
      height,
    }));
  }).flat();
}

const ICONS = {
  users: <span role="img" aria-label="users">👥</span>,
  chat: <span role="img" aria-label="chat">💬</span>,
  call: <span role="img" aria-label="call">📞</span>,
  leave: <span role="img" aria-label="leave">🚪</span>,
};

export default function Room() {
  const {id: roomID} = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const userName = searchParams.get('name') || 'Гость';
  const {clients, provideMediaRef, isScreenSharing, startScreenShare, stopScreenShare, isAudioEnabled, isVideoEnabled, toggleAudio, toggleVideo} = useWebRTC(roomID, userName);

  // Определяем своё видео
  const selfVideo = clients.find(id => id === LOCAL_VIDEO);
  const otherVideos = clients.filter(id => id !== LOCAL_VIDEO);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);
  const history = useHistory();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [userNamesMap, setUserNamesMap] = useState({});
  useEffect(() => {
    const handler = (names) => setUserNamesMap(names || {});
    socket.on(ACTIONS.UPDATE_USER_NAMES, handler);
    return () => socket.off(ACTIONS.UPDATE_USER_NAMES, handler);
  }, []);

  useEffect(() => {
    const handler = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };
    socket.on(ACTIONS.RECEIVE_CHAT_MESSAGE, handler);
    return () => socket.off(ACTIONS.RECEIVE_CHAT_MESSAGE, handler);
  }, []);

  useEffect(() => {
    if (isChatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = {
      message: chatInput,
      author: userName,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, msg]);
    socket.emit(ACTIONS.SEND_CHAT_MESSAGE, {
      roomID,
      message: chatInput,
      author: userName,
    });
    setChatInput("");
  };

  return (
    <div style={{
      background: '#181f2a',
      minHeight: '100vh',
      width: '100vw',
      position: 'relative',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      {/* Верхний бар */}
      <div style={{
        width: '100%',
        height: 60,
        background: '#232b39',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        videoChatApp
      </div>

      {/* Видео других участников по центру */}
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
        minHeight: 'calc(100vh - 60px - 80px)',
        paddingTop: 20,
        paddingBottom: 20,
      }}>
        {otherVideos.map((clientID, index) => (
          <div key={clientID} style={{
            width: 'min(900px, 98vw)',
            height: 'min(600px, 80vh)',
            background: '#232b39',
            borderRadius: 20,
            margin: 32,
            overflow: 'hidden',
            boxShadow: '0 2px 18px rgba(0,0,0,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '98vw',
            maxHeight: '80vh',
            position: 'relative',
          }}>
            <video
              width='100%'
              height='100%'
              ref={instance => provideMediaRef(clientID, instance)}
              autoPlay
              playsInline
              muted={false}
              style={{objectFit: 'cover', width: '100%', height: '100%'}}
              onLoadedMetadata={() => console.log('Video loaded for peer:', clientID)}
              onError={(e) => console.error('Video error for peer:', clientID, e)}
            />
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(24,31,42,0.85)',
              color: '#fff',
              fontSize: 18,
              fontWeight: 500,
              textAlign: 'center',
              padding: '6px 0',
              letterSpacing: 0.5,
            }}>{userNamesMap[clientID] || clientID}</div>
          </div>
        ))}
      </div>

      {/* Свое видео в правом верхнем углу */}
      {selfVideo && (
        <div style={{
          position: 'fixed',
          top: 80,
          right: 32,
          width: 220,
          height: 160,
          background: '#232b39',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <video
            width='100%'
            height='100%'
            ref={instance => provideMediaRef(selfVideo, instance)}
            autoPlay
            playsInline
            muted={true}
            style={{objectFit: 'cover', width: '100%', height: '100%'}}
          />
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(24,31,42,0.85)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 500,
            textAlign: 'center',
            padding: '4px 0',
            letterSpacing: 0.5,
          }}>Вы ({userNamesMap[selfVideo] || 'Вы'})</div>
        </div>
      )}

      {/* Нижняя панель с иконками */}
      <div style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: '100vw',
        height: 70,
        background: '#232b39',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 16,
        padding: '0 32px',
        zIndex: 1000,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.18)',
      }}>
        <button style={{
          background: isUsersOpen ? '#3b4a5c' : '#2d3a4b', color: '#fff', border: 'none', borderRadius: '10px', width: 48, height: 48, fontSize: 24, cursor: 'pointer', marginRight: 8
        }} onClick={() => setIsUsersOpen(v => !v)}>{ICONS.users}</button>
        <button style={{
          background: isChatOpen ? '#3b4a5c' : '#2d3a4b', color: '#fff', border: 'none', borderRadius: '10px', width: 48, height: 48, fontSize: 24, cursor: 'pointer', marginRight: 8
        }} onClick={() => setIsChatOpen((v) => !v)}>{ICONS.chat}</button>
        <button
          style={{
            background: isScreenSharing ? '#22c55e' : '#2d3a4b', color: '#fff', border: 'none', borderRadius: '10px', width: 48, height: 48, fontSize: 24, cursor: 'pointer', marginRight: 8
          }}
          title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
        >
          {isScreenSharing ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M6 6h12v12H6V6zm2 2v8h8V8H8zm2 2h4v4h-4v-4z" fill="#fff"/></svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M4 18h16M8 6h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          )}
        </button>
        <button
          style={{
            background: isAudioEnabled ? '#2d3a4b' : '#e53935', color: '#fff', border: 'none', borderRadius: '10px', width: 48, height: 48, fontSize: 24, cursor: 'pointer', marginRight: 8
          }}
          title={isAudioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
          onClick={toggleAudio}
        >
          {isAudioEnabled ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-14 0 1 1 0 1 1 2 0 5 5 0 0 0 10 0z" fill="#fff"/></svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M19 11a1 1 0 1 1 2 0 7 7 0 0 1-11.29 5.29l8-8A2.99 2.99 0 0 1 15 12v-1.59l2-2V12zm-7-5a3 3 0 0 1 4.24 4.24l-4.24 4.24A3 3 0 0 1 7 12V7a3 3 0 0 1 5-1zM4.41 4.86a1 1 0 0 1 1.41 0l14 14a1 1 0 0 1-1.41 1.41l-2.1-2.1A7.01 7.01 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 0 0 8.29 3.29l-2.1-2.1A3 3 0 0 1 7 12V7a3 3 0 0 1 5-1z" fill="#fff"/></svg>
          )}
        </button>
        <button
          style={{
            background: isVideoEnabled ? '#2d3a4b' : '#e53935', color: '#fff', border: 'none', borderRadius: '10px', width: 48, height: 48, fontSize: 24, cursor: 'pointer', marginRight: 8
          }}
          title={isVideoEnabled ? 'Выключить видео' : 'Включить видео'}
          onClick={toggleVideo}
        >
          {isVideoEnabled ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M17 10.5V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3.5l3 3v-9l-3 3z" fill="#fff"/></svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M17 10.5V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3.5l3 3v-9l-3 3zM4.41 4.86a1 1 0 0 1 1.41 0l14 14a1 1 0 0 1-1.41 1.41l-2.1-2.1A7.01 7.01 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 0 0 8.29 3.29l-2.1-2.1A3 3 0 0 1 7 12V7a3 3 0 0 1 5-1z" fill="#fff"/></svg>
          )}
        </button>
        <button style={{
          background: '#e53935', color: '#fff', border: 'none', borderRadius: '50%', width: 56, height: 56, fontSize: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }} onClick={() => setShowLeaveModal(true)}>{/* SVG трубки */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z" fill="#fff"/>
          </svg>
        </button>
      </div>

      {/* Боковая панель участников */}
      {isUsersOpen && (
        <div style={{
          position: 'fixed',
          top: 60,
          right: 0,
          width: 340,
          height: 'calc(100vh - 60px)',
          background: '#232b39',
          color: '#fff',
          boxShadow: '-2px 0 12px rgba(0,0,0,0.18)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2d3a4b', fontWeight: 600, fontSize: 18 }}>
            <span>Участники</span>
            <button onClick={() => setIsUsersOpen(false)} style={{ background: 'none', border: 'none', color: '#8fa1b3', fontSize: 22, cursor: 'pointer', padding: 0, marginLeft: 8 }} title="Закрыть">✕</button>
          </div>
          <div style={{ padding: '12px 20px', fontSize: 15, color: '#8fa1b3', borderBottom: '1px solid #2d3a4b' }}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>ID комнаты:</div>
            <div style={{ wordBreak: 'break-all', fontSize: 15 }}>{roomID}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {clients.map((clientID, idx) => (
              <div key={clientID} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, color: '#3b82f6', fontWeight: 600 }}>{idx + 1}.</span>
                <span style={{ fontSize: 16, color: '#fff' }}>
                  {clientID === LOCAL_VIDEO
                    ? `Вы (${userNamesMap[clientID] || 'Гость'})`
                    : userNamesMap[clientID] || 'Гость'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Боковая панель чата */}
      {isChatOpen && (
        <div style={{
          position: 'fixed',
          top: 60,
          right: 0,
          width: 340,
          height: 'calc(100vh - 60px)',
          background: '#232b39',
          color: '#fff',
          boxShadow: '-2px 0 12px rgba(0,0,0,0.18)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2d3a4b', fontWeight: 600, fontSize: 18 }}>
            <span>Чат</span>
            <button onClick={() => setIsChatOpen(false)} style={{ background: 'none', border: 'none', color: '#8fa1b3', fontSize: 22, cursor: 'pointer', padding: 0, marginLeft: 8 }} title="Закрыть">✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 0 12px' }}>
            {chatMessages.map((msg, idx) => (
              <div key={idx} style={{ marginBottom: 12, textAlign: msg.author === userName ? 'right' : 'left' }}>
                <div style={{ fontSize: 13, color: '#8fa1b3', marginBottom: 2 }}>{msg.author}</div>
                <div style={{ background: msg.author === userName ? '#3b4a5c' : '#2d3a4b', display: 'inline-block', borderRadius: 8, padding: '8px 14px', fontSize: 15 }}>{msg.message}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} style={{ display: 'flex', padding: 12, borderTop: '1px solid #2d3a4b', background: '#232b39' }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Введите сообщение..."
              style={{ flex: 1, borderRadius: 8, border: 'none', padding: '10px 14px', fontSize: 15, background: '#1a2230', color: '#fff', outline: 'none' }}
            />
            <button type="submit" style={{ marginLeft: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '0 18px', fontSize: 16, cursor: 'pointer', fontWeight: 600 }}>Отпр.</button>
          </form>
        </div>
      )}

      {/* Модальное окно подтверждения выхода */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.45)',
          zIndex: 3000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#232b39',
            borderRadius: 16,
            padding: '36px 32px 28px 32px',
            minWidth: 320,
            boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 22, color: '#fff', marginBottom: 18, fontWeight: 600 }}>Покинуть конференцию?</div>
            <div style={{ color: '#8fa1b3', fontSize: 15, marginBottom: 28, textAlign: 'center' }}>Вы действительно хотите выйти из видеочата?</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={() => setShowLeaveModal(false)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#2d3a4b', color: '#fff', fontSize: 16, cursor: 'pointer' }}>Отмена</button>
              <button onClick={() => history.push('/')} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#e53935', color: '#fff', fontSize: 16, cursor: 'pointer', fontWeight: 600 }}>Выйти</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}