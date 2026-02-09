const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");
const Game = require("./game");

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files (client)
app.use(express.static(path.join(__dirname, "../")));

// HTTP route fallback
app.get("/", (req,res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log("HTTP & WS server running on port", PORT);
});

// WebSocket server
const wss = new WebSocketServer({ server });
const game = new Game();

// Voeg 10 bots bij start
for(let i=0;i<10;i++) game.addBot();

wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    if(data.type==="setup") {
      game.addPlayer(id, data.name, data.color);
      ws.send(JSON.stringify({ type:"init", id }));
    }
    if(data.type==="input") ws.input = data;
    if(data.type==="shoot") game.shoot(id);
    if(data.type==="respawn") game.respawnPlayer(id);
    if (data.type === "chat") {
  const p = game.players[id];
  if (!p) return;

  const msg = String(data.message).slice(0,80);

  broadcast({
    type: "chat",
    name: p.name.slice(0,15),
    color: p.color,
    message: msg
  });
}

  });

  ws.on("close", ()=> game.removePlayer(id));
});

// Server loop 120fps
let last = Date.now();
function gameLoop() {
  const now = Date.now();
  const delta = now - last;
  last = now;

  // update players
  wss.clients.forEach(ws => {
    if(ws.input && ws._socket) game.movePlayer(ws.input.id, ws.input, delta);
  });

  game.update(delta);

  // broadcast state
  const state = JSON.stringify({
    type:"state",
    players: game.players,
    bots: game.bots,
    bullets: game.bullets
  });

  wss.clients.forEach(c => {
    if(c.readyState===1) c.send(state);
  });

  setTimeout(gameLoop, 1000/120);
}

gameLoop();
