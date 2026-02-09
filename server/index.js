const WebSocket = require("ws");
const Game = require("./game");

const wss = new WebSocket.Server({ port: 8080 });
const game = new Game();

const clients = {};

let lastTime = Date.now();

wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);
  clients[id] = ws;
  game.addPlayer(id);

  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    if (data.type === "input") ws.input = data;
    if (data.type === "shoot") game.shoot(id);
    if (data.type === "respawn") game.respawnPlayer(id);
  });

  ws.on("close", () => {
    game.removePlayer(id);
    delete clients[id];
  });
});

// Game loop using setInterval
setInterval(() => {
  const now = Date.now();
  const delta = now - lastTime;
  lastTime = now;

  // Move players with delta time for consistent speed
  for (const id in clients) {
    const ws = clients[id];
    if (ws.input) game.movePlayer(id, ws.input, delta);
  }

  // Update game state
  game.update(delta);

  // Broadcast state
  const state = JSON.stringify({
    type: "state",
    players: game.players,
    bullets: game.bullets
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(state);
  });

}, 1000 / 60); // run ~60 times per second
