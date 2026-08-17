const PROTOCOL_VERSION = 1;
const CHAT_TYPES = Object.freeze({ LOBBY: 'lobby', DIRECT: 'dm', GROUP: 'group' });
const MESSAGE_TYPES = Object.freeze({ TEXT: 'message', FILE: 'file' });

function createMessageId(deviceId) {
  return `${deviceId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

module.exports = { PROTOCOL_VERSION, CHAT_TYPES, MESSAGE_TYPES, createMessageId };
