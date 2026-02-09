import { drawGrid, drawMinimap, drawMapBorder } from "./render.js";

const WORLD_SIZE = 5000;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

const socket = new WebSocket("ws://localhost:8080");
let myId = null;
let players = {};
let bullets = {};
let mouse = { x: 0, y: 0 };
let keys = {};

const respawnMenu = document.getElementById("respawnMenu");
const respawnBtn = document.getElementById("respawnBtn");
respawnBtn.addEventListener("click", () => {
  socket.send(JSON.stringify({ type: "respawn" }));
});

socket.onmessage = e => {
  const data = JSON.parse(e.data);
  if (data.type === "init") myId = data.id;
  if (data.type === "state") {
    players = data.players;
    bullets = data.bullets;
    respawnMenu.style.display = (!players[myId] ? true : false);
  }
};

window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);
window.addEventListener("mousedown", () => {
  if (!players[myId]) return;
  socket.send(JSON.stringify({ type: "shoot" }));
});

function sendInput() {
  if (!players[myId]) return;
  const dx = mouse.x - canvas.width / 2;
  const dy = mouse.y - canvas.height / 2;
  const angle = Math.atan2(dy, dx);

  socket.send(JSON.stringify({
    type: "input",
    angle,
    up: keys["w"]
  }));
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!players[myId]) return;

  const me = players[myId];
  const camera = { x: me.x - canvas.width / 2, y: me.y - canvas.height / 2 };

  drawGrid(ctx, camera, canvas);
  drawMapBorder(ctx, WORLD_SIZE, camera, canvas);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Draw players
  for (let id in players) {
    const p = players[id];
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = id === myId ? "#fff" : "#fff";
    ctx.fill();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
    ctx.stroke();

    // Health bar
    ctx.fillStyle = "#555";
    ctx.fillRect(p.x - 20, p.y - 30, 40, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.x - 20, p.y - 30, 40 * (p.health / 100), 5);
  }

  // Draw bullets
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  });

  ctx.restore();
  drawMinimap(ctx, players, myId, WORLD_SIZE);
  ctx.globalAlpha = 1;
}

function loop() {
  sendInput();
  draw();
  requestAnimationFrame(loop);
}

loop();
