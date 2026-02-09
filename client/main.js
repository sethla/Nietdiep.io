import { drawGrid, drawMinimap, drawMapBorder } from "./render.js";

const WORLD_SIZE = 5000;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

// const socket = new WebSocket("ws://localhost:8080");
const socket = new WebSocket("wss://nietdiep-io.onrender.com");
let myId = null;
let players = {};
let bullets = {};
let mouse = { x: 0, y: 0 };
let keys = {};

const startMenu = document.getElementById("startMenu");
const startBtn = document.getElementById("startBtn");
const nameInput = document.getElementById("nameInput");
const colorInput = document.getElementById("colorInput");
const respawnMenu = document.getElementById("respawnMenu");
const respawnBtn = document.getElementById("respawnBtn");

startBtn.onclick = () => {
  const name = nameInput.value || "Player";
  const color = colorInput.value || "#4caf50";
  startMenu.style.display = "none";
  socket.send(JSON.stringify({ type: "setup", name, color }));
};

respawnBtn.onclick = () => socket.send(JSON.stringify({ type: "respawn" }));

socket.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "requestSetup") startMenu.style.display = "block";

  if (data.type === "init") {
    myId = data.id;
    startMenu.style.display = "none"; // hide start menu when init received
  }

  if (data.type === "state") {
    players = data.players;
    bullets = data.bullets;

    // Only show respawn menu if player exists and dead
    if (myId && players[myId] && !players[myId].alive) {
      respawnMenu.style.display = "block";
    } else {
      respawnMenu.style.display = "none";
    }
  }
};


window.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);
window.addEventListener("mousedown", () => {
  if (!myId || !players[myId] || !players[myId].alive) return;
  socket.send(JSON.stringify({ type: "shoot" }));
});

function sendInput() {
  if (!myId || !players[myId] || !players[myId].alive) return;

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
  if (!myId || !players[myId]) return; // don't draw if no player yet

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = players[myId];
  const camera = { x: me.x - canvas.width / 2, y: me.y - canvas.height / 2 };

  drawGrid(ctx, camera, canvas);
  drawMapBorder(ctx, WORLD_SIZE, camera, canvas);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  for (let id in players) {
    const p = players[id];

    // Only draw alive players
    if (!p.alive) continue;

    // Player circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    // Outline
    ctx.strokeStyle = (id === myId) ? p.color : "#ff0000";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Name
    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = (id === myId) ? p.color : "#ff0000";
    ctx.lineWidth = 2;
    ctx.strokeText(p.name, p.x, p.y - 30);
    ctx.fillText(p.name, p.x, p.y - 30);

    // Health bar
    ctx.fillStyle = "#781c1c";
    ctx.fillRect(p.x - 20, p.y - 25, 40, 5);
    ctx.fillStyle = "#42a71d";
    ctx.fillRect(p.x - 20, p.y - 25, 40 * (p.health / 100), 5);
  }

  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  });

  ctx.restore();

  drawMinimap(ctx, players, myId, WORLD_SIZE);

  // XP bar
  const p = players[myId];
  if (p) {
    const barWidth = 300;
    const barHeight = 20;
    const x = canvas.width / 2 - barWidth / 2;
    const y = canvas.height - barHeight - 20;

    const xpPercent = (p.xp % 100) / 100;
    ctx.fillStyle = "#555";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, barWidth * xpPercent, barHeight);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "16px sans-serif";
    ctx.fillText(`Level ${p.level} | XP: ${p.xp}`, canvas.width / 2, y + barHeight - 5);
  }
}

function loop() {
  sendInput();
  draw();
  requestAnimationFrame(loop);
}

loop();
