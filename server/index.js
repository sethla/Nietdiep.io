const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const Game = require("./game");

const game = new Game();
const clients = {};

// HTTP server to serve client files
const server = http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  const fullPath = path.join(__dirname, "..", filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("404 Not Found");
    } else {
      let contentType = "text/html";
      if (filePath.endsWith(".js")) contentType = "application/javascript";
      if (filePath.endsWith(".css")) contentType = "text/css";

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
  const data = JSON.parse(msg);

  if (data.type === "setup") {
    game.addPlayer(id, data.name, data.color);

    // stuur meteen init terug
    ws.send(JSON.stringify({ type: "init", id }));
  }

  if (data.type === "input") ws.input = data;
  if (data.type === "shoot") game.shoot(id);
  if (data.type === "respawn") game.respawnPlayer(id);
  if (data.type === "upgrade" && data.stat) game.applyUpgrade(id, data.stat, data.multiplier || 1);
});

  ws.on("close", () => {
    game.removePlayer(id);
    delete clients[id];
  });
});

// 15 FPS game loop for reduced latency
let lastTime = Date.now();
setInterval(() => {
  const now = Date.now();
  const delta = now - lastTime;
  lastTime = now;

  for (const id in clients) {
    const ws = clients[id];
    if (ws.input) game.movePlayer(id, ws.input, delta);
  }

  game.update(delta);

  const state = JSON.stringify({
    type: "state",
    players: game.players,
    bullets: game.bullets,
    orbs: game.Orbs
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(state);
  });
}, 1000 / 15);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
