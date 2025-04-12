// peer-server.cjs
const { PeerServer } = require('peer');
const { WebSocketServer } = require('ws');

const server = PeerServer({
  port: 9000,
  path: '/myapp',
  ws: {
    options: {
      WebSocketServer // Gunakan WebSocketServer dari ws package
    }
  }
});

console.log('Server running on port 9000');