const WebSocket = require("ws");
const Game = require("./game");

const wss = new WebSocket.Server({ port: 8080 });
const game = new Game();
const clients = {};
let lastTime = Date.now();

wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);
  clients[id] = ws;

  // Ask client to setup name/color
  ws.send(JSON.stringify({ type: "requestSetup" }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "setup") {
      // Add player immediately
      game.addPlayer(id, data.name || "Player", data.color || "#4caf50");
      ws.send(JSON.stringify({ type: "init", id }));
    }

    if (data.type === "input") ws.input = data;
    if (data.type === "shoot") game.shoot(id);
    if (data.type === "respawn") game.respawnPlayer(id);
  });

  ws.on("close", () => {
    game.removePlayer(id); // remove only on disconnect
    delete clients[id];
  });
});

// 120 FPS server loop
setInterval(() => {
  const now = Date.now();
  const delta = now - lastTime;
  lastTime = now;

  // Move players
  for (const id in clients) {
    const ws = clients[id];
    if (ws.input) game.movePlayer(id, ws.input, delta);
  }

  game.update(delta);

  const state = JSON.stringify({
    type: "state",
    players: game.players,
    bullets: game.bullets
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(state);
  });

}, 1000 / 120);
