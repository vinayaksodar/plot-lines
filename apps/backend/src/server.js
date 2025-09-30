const http = require('http');
const WebSocket = require('ws');
const app = require('./app');
const { setupCollaboration } = require('./websockets/collaboration');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = 3000;

setupCollaboration(wss);

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
