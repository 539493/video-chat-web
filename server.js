const path = require('path');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});
const {version, validate} = require('uuid');

const ACTIONS = require('./src/socket/actions');
const PORT = process.env.PORT || 3001;
const userNames = {};

function getClientRooms() {
  const {rooms} = io.sockets.adapter;

  return Array.from(rooms.keys()).filter(roomID => validate(roomID) && version(roomID) === 4);
}

function shareRoomsInfo() {
  io.emit(ACTIONS.SHARE_ROOMS, {
    rooms: getClientRooms()
  })
}

io.on('connection', socket => {
  console.log('Client connected:', socket.id);
  shareRoomsInfo();

  socket.on(ACTIONS.JOIN, config => {
    const {room: roomID, name} = config;
    const {rooms: joinedRooms} = socket;

    userNames[socket.id] = name || 'Гость';
    console.log(`User ${name} (${socket.id}) joining room: ${roomID}`);

    if (Array.from(joinedRooms).includes(roomID)) {
      return console.warn(`Already joined to ${roomID}`);
    }

    const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);
    console.log(`Room ${roomID} has ${clients.length} clients`);

    clients.forEach(clientID => {
      console.log(`Notifying ${clientID} about new peer ${socket.id}`);
      io.to(clientID).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: false
      });

      console.log(`Notifying ${socket.id} about existing peer ${clientID}`);
      socket.emit(ACTIONS.ADD_PEER, {
        peerID: clientID,
        createOffer: true,
      });
    });

    socket.join(roomID);
    shareRoomsInfo();
    // Рассылаем обновлённые имена всем в комнате
    io.to(roomID).emit(ACTIONS.UPDATE_USER_NAMES, userNames);
  });

  socket.on(ACTIONS.SET_USER_NAME, ({name}) => {
    userNames[socket.id] = name;
    console.log(`User ${socket.id} changed name to: ${name}`);
    // Обновляем всем
    Object.values(socket.rooms).forEach(roomID => {
      io.to(roomID).emit(ACTIONS.UPDATE_USER_NAMES, userNames);
    });
  });

  function leaveRoom() {
    const {rooms} = socket;

    Array.from(rooms)
      // LEAVE ONLY CLIENT CREATED ROOM
      .filter(roomID => validate(roomID) && version(roomID) === 4)
      .forEach(roomID => {

        const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);
        console.log(`User ${socket.id} leaving room ${roomID}, notifying ${clients.length} clients`);

        clients
          .forEach(clientID => {
          console.log(`Notifying ${clientID} about peer ${socket.id} leaving`);
          io.to(clientID).emit(ACTIONS.REMOVE_PEER, {
            peerID: socket.id,
          });

          console.log(`Notifying ${socket.id} about peer ${clientID} leaving`);
          socket.emit(ACTIONS.REMOVE_PEER, {
            peerID: clientID,
          });
        });

        socket.leave(roomID);
      });

    shareRoomsInfo();
  }

  socket.on(ACTIONS.LEAVE, leaveRoom);
  socket.on('disconnecting', leaveRoom);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    delete userNames[socket.id];
  });

  socket.on(ACTIONS.RELAY_SDP, ({peerID, sessionDescription}) => {
    console.log(`Relaying SDP from ${socket.id} to ${peerID}, type: ${sessionDescription.type}`);
    io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerID: socket.id,
      sessionDescription,
    });
  });

  socket.on(ACTIONS.RELAY_ICE, ({peerID, iceCandidate}) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${peerID}, type: ${iceCandidate.type}`);
    io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
      peerID: socket.id,
      iceCandidate,
    });
  });

  // ЧАТ: пересылка сообщений всем в комнате
  socket.on(ACTIONS.SEND_CHAT_MESSAGE, ({roomID, message, author}) => {
    console.log(`Chat message from ${author} in room ${roomID}: ${message}`);
    // Отправить всем в комнате, кроме отправителя
    socket.to(roomID).emit(ACTIONS.RECEIVE_CHAT_MESSAGE, {
      message,
      author,
      timestamp: Date.now(),
    });
  });

});

const publicPath = path.join(__dirname, 'build');

app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Started on port ${PORT}!`)
})