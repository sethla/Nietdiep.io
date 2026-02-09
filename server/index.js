const WebSocket = require("ws");
const Game = require("./game");

const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
const game = new Game();

console.log("Server running on port", PORT);

// Voeg 10 bots bij start
for (let i = 0; i < 10; i++) game.addBot();

wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (data.type === "setup") {
      game.addPlayer(id, data.name, data.color);
      ws.send(JSON.stringify({ type: "init", id }));
    }

    if (data.type === "input") ws.input = data;
    if (data.type === "shoot") game.shoot(id);
    if (data.type === "respawn") game.respawnPlayer(id);
    if (data.type === "chat") {
      // broadcast chat
      wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN)
          c.send(JSON.stringify({ type: "chat", name: data.name, message: data.message }));
      });
    }
  });

  ws.on("close", () => {
    game.removePlayer(id);
  });
});

let last = Date.now();
function gameLoop() {
  const now = Date.now();
  const delta = now - last;
  last = now;

  // update server state
  for (let id in wss.clients) {
    const ws = wss.clients[id];
    if (!ws.input) continue;
    game.movePlayer(id, ws.input, delta);
  }
  game.update(delta);

  // broadcast state
  const state = JSON.stringify({
    type: "state",
    players: game.players,
    bots: game.bots,
    bullets: game.bullets
  });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(state);
  });

  setTimeout(gameLoop, 1000 / 120); // 120fps server
}

gameLoop();
