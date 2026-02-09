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

socket.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "init") myId = data.id;
  if (data.type === "state") {
    players = data.players;
    bullets = data.bullets;
  }
};

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

window.addEventListener("mousedown", () => {
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

  ctx.save();
  ctx.translate(
    canvas.width / 2 - me.x,
    canvas.height / 2 - me.y
  );

  // players
  for (let id in players) {
    const p = players[id];

    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = id === myId ? "#4caf50" : "#f44336";
    ctx.fill();

    // barrel
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(
      p.x + Math.cos(p.angle) * 30,
      p.y + Math.sin(p.angle) * 30
    );
    ctx.stroke();
  }

  // bullets
  bullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffeb3b";
    ctx.fill();
  });

  ctx.restore();
}

function loop() {
  sendInput();
  draw();
  requestAnimationFrame(loop);
}

loop();
