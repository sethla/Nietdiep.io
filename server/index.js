const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const { Game, WORLD_SIZE } = require("./game");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;
const game = new Game();

/* ------------------ */
/* SERVE CLIENT FILES */
/* ------------------ */
app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

/* ------------------ */
/* WEBSOCKET LOGIC    */
/* ------------------ */
wss.on("connection", ws => {
  const id = Math.random().toString(36).slice(2);
  game.spawnPlayer(id);

  ws.send(JSON.stringify({ type: "init", id }));

  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    if (data.type === "input") game.movePlayer(id, data);
    if (data.type === "shoot") game.shoot(id);
  });

  ws.on("close", () => game.removePlayer(id));
});

/* ------------------ */
/* GAME LOOP          */
/* ------------------ */
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

/* ------------------ */
/* START SERVER       */
/* ------------------ */
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
