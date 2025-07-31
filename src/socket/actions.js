const ACTIONS = {
  JOIN: 'join',
  LEAVE: 'leave',
  SHARE_ROOMS: 'share-rooms',
  ADD_PEER: 'add-peer',
  REMOVE_PEER: 'remove-peer',
  RELAY_SDP: 'relay-sdp',
  RELAY_ICE: 'relay-ice',
  ICE_CANDIDATE: 'ice-candidate',
  SESSION_DESCRIPTION: 'session-description',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  RECEIVE_CHAT_MESSAGE: 'receive-chat-message',
  SET_USER_NAME: 'set-user-name',
  UPDATE_USER_NAMES: 'update-user-names'
};

module.exports = ACTIONS;