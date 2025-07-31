import { useState } from 'react';
import { useHistory } from 'react-router';
import { v4 } from 'uuid';

export default function Main() {
  const history = useHistory();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  const handleCreate = () => {
    if (!name.trim()) return;
    history.push(`/room/${v4()}?name=${encodeURIComponent(name)}`);
  };

  const handleJoin = () => {
    if (!name.trim() || !roomId.trim()) return;
    history.push(`/room/${roomId}?name=${encodeURIComponent(name)}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#232323',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      <div style={{ color: '#fff', fontSize: 36, fontWeight: 700, marginBottom: 32 }}>Ваше имя</div>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Введите имя"
        style={{
          width: 380,
          maxWidth: '90vw',
          padding: '18px 24px',
          fontSize: 28,
          borderRadius: 12,
          border: '2px solid #3b4252',
          background: '#181f2a',
          color: '#fff',
          marginBottom: 48,
          outline: 'none',
          textAlign: 'center',
        }}
      />
      <div style={{ display: 'flex', gap: 48 }}>
        <button
          onClick={handleCreate}
          style={{
            width: 280,
            height: 220,
            background: '#ff8c3b',
            border: 'none',
            borderRadius: 48,
            color: '#dbeafe',
            fontSize: 36,
            fontWeight: 500,
            boxShadow: '0 6px 32px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
            opacity: name.trim() ? 1 : 0.6,
            transition: 'opacity 0.2s',
          }}
          disabled={!name.trim()}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M7 7h6v10H7V7zm8 2.5l4 2.5-4 2.5V9.5z" fill="#fff"/></svg>
          <span style={{ marginTop: 24 }}>Новая<br/>конференция</span>
        </button>
        <button
          onClick={handleJoin}
          style={{
            width: 280,
            height: 220,
            background: '#2563eb',
            border: 'none',
            borderRadius: 48,
            color: '#dbeafe',
            fontSize: 36,
            fontWeight: 500,
            boxShadow: '0 6px 32px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: name.trim() && roomId.trim() ? 'pointer' : 'not-allowed',
            opacity: name.trim() && roomId.trim() ? 1 : 0.6,
            transition: 'opacity 0.2s',
          }}
          disabled={!name.trim() || !roomId.trim()}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#fff" fillOpacity="0.12"/><path d="M12 5v14m7-7H5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          <span style={{ marginTop: 24 }}>Войти</span>
        </button>
      </div>
      <input
        type="text"
        value={roomId}
        onChange={e => setRoomId(e.target.value)}
        placeholder="ID комнаты для входа"
        style={{
          width: 380,
          maxWidth: '90vw',
          padding: '14px 24px',
          fontSize: 22,
          borderRadius: 12,
          border: '2px solid #3b4252',
          background: '#181f2a',
          color: '#fff',
          marginTop: 40,
          outline: 'none',
          textAlign: 'center',
        }}
      />
    </div>
  );
}