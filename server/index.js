const WebSocket = require("ws");
const Game = require("./game");

const wss = new WebSocket.Server({ port: 8080 });
const game = new Game();

wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);

  game.addPlayer(id);
  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "input") {
      game.movePlayer(id, data);
    }

    if (data.type === "shoot") {
      game.shoot(id);
    }
  });

  ws.on("close", () => {
    game.removePlayer(id);
  });
});

setInterval(() => {
  game.update();

  const state = JSON.stringify({
    type: "state",
    players: game.players,
    bullets: game.bullets
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(state);
    }
  });
}, 1000 / 30);

console.log("Server running on ws://localhost:8080");
