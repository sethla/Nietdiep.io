export function drawGrid(ctx, camera, canvas, gridSize = 50) {
  ctx.strokeStyle = "#00000057";
  ctx.lineWidth = 1;

  const startX = Math.floor(camera.x / gridSize) * gridSize;
  const startY = Math.floor(camera.y / gridSize) * gridSize;

  for (let x = startX; x < camera.x + canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x - camera.x, 0);
    ctx.lineTo(x - camera.x, canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y < camera.y + canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y - camera.y);
    ctx.lineTo(canvas.width, y - camera.y);
    ctx.stroke();
  }
}

export function drawMinimap(ctx, players, myId, worldSize) {
  const size = 150;
  const padding = 20;

  const x = ctx.canvas.width - size - padding;
  const y = padding;

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.fillRect(x, y, size, size);

  for (let id in players) {
    const p = players[id];
    const px = x + (p.x / worldSize) * size;
    const py = y + (p.y / worldSize) * size;

    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = id === myId ? "#4caf50" : "#fff";
    ctx.fill();
  }

  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);
}

export function drawMapBorder(ctx, worldSize, camera, canvas) {
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.strokeRect(-camera.x, -camera.y, worldSize, worldSize);
}
