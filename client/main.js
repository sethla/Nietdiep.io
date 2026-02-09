import { drawGrid, drawMinimap } from "./render.js";

const WORLD_SIZE = 5000;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

const socket = new WebSocket("ws://"+location.host);
let myId = null;
let players = {};
let bots = {};
let bullets = [];

let keys = { w:false,a:false,s:false,d:false };
let mouse = { x:0, y:0 };

const startMenu = document.getElementById("startMenu");
const nameInput = document.getElementById("nameInput");
const colorInput = document.getElementById("colorInput");
const startBtn = document.getElementById("startBtn");

const chatDiv = document.getElementById("chat");
const chatInput = document.getElementById("chatInput");

startBtn.onclick = () => {
  const name = nameInput.value || "Player";
  const color = colorInput.value || "#4caf50";
  startMenu.style.display = "none";
  socket.send(JSON.stringify({ type:"setup", name, color }));
};

socket.onmessage = e => {
  const data = JSON.parse(e.data);
  if (data.type === "init") myId = data.id;
  if (data.type === "state") {
    players = data.players;
    bots = data.bots;
    bullets = data.bullets;
  }
  if (data.type === "chat") {
    const msg = document.createElement("div");
    msg.textContent = data.name + ": " + data.message;
    chatDiv.appendChild(msg);
    chatDiv.scrollTop = chatDiv.scrollHeight;
  }
};

window.addEventListener("keydown", e => {
  if ("wasd".includes(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.key === "Enter") chatInput.focus();
});
window.addEventListener("keyup", e => {
  if ("wasd".includes(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && chatInput.value.trim() !== "") {
    socket.send(JSON.stringify({ type:"chat", name:players[myId]?.name || "Player", message: chatInput.value }));
    chatInput.value = "";
  }
});

window.addEventListener("mousedown", () => {
  socket.send(JSON.stringify({ type:"shoot" }));
});

function sendInput() {
  if (!myId || !players[myId] || !players[myId].alive) return;
  const me = players[myId];
  const dx = mouse.x - canvas.width/2;
  const dy = mouse.y - canvas.height/2;
  const angle = Math.atan2(dy, dx);

  socket.send(JSON.stringify({
    type:"input",
    angle,
    up: keys.w,
    down: keys.s,
    left: keys.a,
    right: keys.d
  }));
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!myId || !players[myId]) return;
  const me = players[myId];
  ctx.save();
  ctx.translate(canvas.width/2 - me.x, canvas.height/2 - me.y);

  // draw grid
  drawGrid(ctx, {x:me.x, y:me.y}, canvas);

  // draw bots
  for (let id in bots) {
    const b = bots[id];
    if (!b.alive) continue;
    ctx.beginPath();
    ctx.arc(b.x,b.y,20,0,Math.PI*2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.strokeStyle="#fff";
    ctx.lineWidth=4;
    ctx.beginPath();
    ctx.moveTo(b.x,b.y);
    ctx.lineTo(b.x+Math.cos(b.angle)*30, b.y+Math.sin(b.angle)*30);
    ctx.stroke();
  }

  // draw players
  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;
    ctx.beginPath();
    ctx.arc(p.x,p.y,20,0,Math.PI*2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle=id===myId?"#fff":"#f44336";
    ctx.lineWidth=4;
    ctx.stroke();

    // barrel
    ctx.strokeStyle="#000";
    ctx.lineWidth=6;
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x+Math.cos(p.angle)*30, p.y+Math.sin(p.angle)*30);
    ctx.stroke();

    // health bar
    ctx.fillStyle="red";
    ctx.fillRect(p.x-20,p.y-30,40,5);
    ctx.fillStyle="green";
    ctx.fillRect(p.x-20,p.y-30,40*(p.health/100),5);
  }

  // bullets
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x,b.y,5,0,Math.PI*2);
    ctx.fillStyle="#ffeb3b";
    ctx.fill();
  });

  ctx.restore();

  drawMinimap(ctx, players, bots, myId, WORLD_SIZE);

  // XP bar
  if(players[myId]) {
    const p = players[myId];
    ctx.fillStyle="#222";
    ctx.fillRect(20,canvas.height-40,200,20);
    ctx.fillStyle="#4caf50";
    ctx.fillRect(20,canvas.height-40,200*(p.xp/100),20);
    ctx.strokeStyle="#fff";
    ctx.strokeRect(20,canvas.height-40,200,20);
    ctx.fillStyle="#fff";
    ctx.fillText("Level "+p.level,20,canvas.height-45);
  }
}

function loop() {
  sendInput();
  draw();
  requestAnimationFrame(loop);
}

loop();
