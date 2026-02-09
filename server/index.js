const WebSocket = require("ws");
const { Game, WORLD_SIZE } = require("./game");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
const game = new Game();

wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);
  game.spawnPlayer(id);

  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    if (data.type === "input") game.movePlayer(id, data);
    if (data.type === "shoot") game.shoot(id);
  });

  ws.on("close", () => game.removePlayer(id));
});

setInterval(() => {
  game.update();

  const state = JSON.stringify({
    type: "state",
    players: game.players,
    bots: game.bots,
    bullets: game.bullets,
    worldSize: WORLD_SIZE
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(state);
  });
}, 1000 / 60);

console.log("Server running on port", PORT);
