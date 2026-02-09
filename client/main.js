import { drawGrid } from "./render.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(`${protocol}//${location.host}`);

let socketReady = false;
let myId = null;
let players = {};
let bots = {};
let bullets = [];
let mouse = { x:0, y:0 };
let keys = { w:false };

socket.onopen = () => socketReady = true;

socket.onmessage = e => {
  const d = JSON.parse(e.data);
  if (d.type === "init") myId = d.id;
  if (d.type === "state") {
    players = d.players;
    bots = d.bots;
    bullets = d.bullets;
  }
};

addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "w") keys.w = true;
});

addEventListener("keyup", e => {
  if (e.key.toLowerCase() === "w") keys.w = false;
});

addEventListener("mousedown", () => {
  if (socketReady) socket.send(JSON.stringify({ type:"shoot" }));
});

function sendInput() {
  if (!socketReady || !players[myId] || !players[myId].alive) return;

  const dx = mouse.x - canvas.width / 2;
  const dy = mouse.y - canvas.height / 2;
  const angle = Math.atan2(dy, dx);

  socket.send(JSON.stringify({
    type: "input",
    angle,
    up: keys.w
  }));
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!players[myId]) return;

  const me = players[myId];
  ctx.save();
  ctx.translate(canvas.width/2 - me.x, canvas.height/2 - me.y);

  drawGrid(ctx, me, canvas);

  for (const p of Object.values(players)) {
    if (!p.alive) continue;
    ctx.beginPath();
    ctx.arc(p.x,p.y,20,0,Math.PI*2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  for (const b of Object.values(bots)) {
    if (!b.alive) continue;
    ctx.beginPath();
    ctx.arc(b.x,b.y,20,0,Math.PI*2);
    ctx.fillStyle = b.color;
    ctx.fill();
  }

  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x,b.y,5,0,Math.PI*2);
    ctx.fillStyle = "#ff0";
    ctx.fill();
  }

  ctx.restore();
}

function loop() {
  sendInput();
  draw();
  requestAnimationFrame(loop);
}

loop();

