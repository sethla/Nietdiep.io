const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const Game = require("./game");

const game = new Game();
const clients = {};

const SUPPORTED_CUSTOM_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'];

function isValidCustomSkinUrl(customSkinUrl) {
  if (customSkinUrl == null || customSkinUrl === '') return true;
  if (typeof customSkinUrl !== 'string' || customSkinUrl.length > 2048) return false;

  if (customSkinUrl.startsWith('data:image/')) {
    return customSkinUrl.length <= 1024 * 1024;
  }

  try {
    const parsed = new URL(customSkinUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const path = parsed.pathname.toLowerCase();
    const ext = path.includes('.') ? path.split('.').pop() : '';
    return SUPPORTED_CUSTOM_EXTENSIONS.includes(ext);
  } catch {
    return false;
  }
}

// HTTP server to serve client files
const server = http.createServer((req, res) => {
  let rawPath;
  try {
    rawPath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400); res.end("Bad Request"); return;
  }
  if (rawPath.includes('..')) { res.writeHead(403); res.end("Forbidden"); return; }
  let filePath = rawPath;
  const fullPath = path.join(__dirname, "..", filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("404 Not Found");
    } else {
      let contentType = "text/html";
      if (filePath.endsWith(".js")) contentType = "application/javascript";
      if (filePath.endsWith(".css")) contentType = "text/css";
      if (filePath.endsWith(".png")) contentType = "image/png";
      if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) contentType = "image/jpeg";
      if (filePath.endsWith(".gif")) contentType = "image/gif";
      if (filePath.endsWith(".svg")) contentType = "image/svg+xml";
      if (filePath.endsWith(".md")) contentType = "text/markdown";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    }
  });
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);
  clients[id] = ws;

  ws.send(JSON.stringify({ type: "requestSetup" }));

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "setup") {
        // Validate name and color
        if (!data.name || typeof data.name !== 'string' || data.name.length > 25) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid name" }));
          return;
        }
        if (!data.color || typeof data.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid color" }));
          return;
        }
        if (!data.skin || typeof data.skin !== 'string') {
          data.skin = 'default';
        }
        if (!isValidCustomSkinUrl(data.customSkinUrl)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid custom skin URL" }));
          return;
        }

        // Check player limit
        if (!game.canAddPlayer()) {
          game.addToQueue(id, data.name, data.color, data.skin, data.customSkinUrl || null);
          const position = game.getQueuePosition(id);
          ws.send(JSON.stringify({ type: "queued", position }));
          return;
        }

        game.addPlayer(id, data.name, data.color, data.skin, data.customSkinUrl || null);
        ws.send(JSON.stringify({ type: "init", id }));
      }

      if (data.type === "skinUpdate") {
        if (!data.skin || typeof data.skin !== 'string') return;
        if (!isValidCustomSkinUrl(data.customSkinUrl)) return;
        game.setPlayerSkin(id, data.skin, data.customSkinUrl || null);
      }

      if (data.type === "input") {
        // Validate input
        if (typeof data.angle !== 'number' || typeof data.vx !== 'number' || typeof data.vy !== 'number') {
          return;
        }
        ws.input = data;
      }
      if (data.type === "shoot") game.shoot(id);
      if (data.type === "leave") {
        game.removePlayer(id);
        delete ws.input;
        ws.send(JSON.stringify({ type: "requestSetup" }));
      }
      if (data.type === "respawn") game.respawnPlayer(id);
      if (data.type === "upgrade" && data.stat) {
        const multiplier = data.multiplier || 1;
        if (typeof multiplier === 'number' && multiplier > 0 && multiplier <= 2) {
          game.applyUpgrade(id, data.stat, multiplier);
        }
      }
    } catch (err) {
      console.error("Message error:", err);
    }
  });

  ws.on("close", () => {
    game.removePlayer(id);
    game.removeFromQueue(id);
    delete clients[id];
  });
});

// 15 FPS game loop for reduced latency
let lastTime = Date.now();
setInterval(() => {
  const now = Date.now();
  const delta = now - lastTime;
  lastTime = now;

  // Process queue
  const nextPlayerId = game.processQueue();
  if (nextPlayerId && clients[nextPlayerId]) {
    clients[nextPlayerId].send(JSON.stringify({ type: "init", id: nextPlayerId }));
  }

  for (const id in clients) {
    const ws = clients[id];
    if (ws.input) game.movePlayer(id, ws.input, delta);
  }

  game.update(delta);

  const leaderboard = game.getLeaderboard();

  const state = JSON.stringify({
    type: "state",
    players: game.players,
    bullets: game.bullets,
    orbs: game.Orbs,
    leaderboard: leaderboard
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(state);
  });
}, 1000 / 15);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
