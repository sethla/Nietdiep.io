import { drawGrid, drawMinimap, drawMapBorder } from "./render.js";
import { loadSkins, getSkinImage, getSkinCanvas, setSkin, getSelectedSkin, getCustomSkinUrl, setSkinChangedHandler, createShopPage, updateCoins, openShop, closeShop, initializeCustomSkinCache } from "./skins.js";

function darkenColor(color, amount = 0.3) {
  if (!color || typeof color !== 'string') return '#222';
  if (color.startsWith('#') && color.length >= 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgb(${Math.floor(r*(1-amount))},${Math.floor(g*(1-amount))},${Math.floor(b*(1-amount))})`;
  }
  return color;
}

function hexToRgb(color) {
  if (!color || !color.startsWith('#') || color.length < 7) return '255,255,255';
  const r = parseInt(color.slice(1,3), 16);
  const g = parseInt(color.slice(3,5), 16);
  const b = parseInt(color.slice(5,7), 16);
  return `${r},${g},${b}`;
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2*r) r = w/2;
  if (h < 2*r) r = h/2;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

const WORLD_SIZE = 5000;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const mapOverlay = document.getElementById("mapOverlay");
const mapCanvas = document.getElementById("mapCanvas");
const mapCtx = mapCanvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (showMap) updateMapView();
});

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(wsProtocol + "//" + location.host);

// Debug: log connection status
socket.onopen = () => {
  console.log("✅ WebSocket connected");
};

socket.onerror = (err) => {
  console.error("❌ WebSocket error:", err);
};

socket.onclose = () => {
  console.log("❌ WebSocket closed");
};

// Fade-in animation
let fadeInAlpha = 0;
let isFadingIn = false;
let fadeInStartTime = 0;

let myId = null;
let players = {};
let bullets = {};
let orbs = {};
let mouse = { x: 0, y: 0 };
let keys = {};
let camera = { x: 0, y: 0 };
let targetCamera = { x: 0, y: 0 };
let cameraLerpSpeed = 0.1;
let showMap = false;
let lastServerState = null;
let pendingInputs = [];
let lastInputSent = 0;
let myServerPos = null; // last server-authoritative position for local player
let joystick = { active: false, touchId: null, vx: 0, vy: 0 };
let leaderboard = [];
let queuePosition = 0;
let lastUpdateTime = 0;
let playerPrevPos = {}; // Track previous positions for interpolation
let playerLastLevel = 0; // Track level for coin rewards

// --- Fun extras state ---
let screenShake = { intensity: 0 };       // screen shake on taking damage
let killFeed = [];                         // [{name, color, time}] recent deaths
let levelUpNotif = null;                   // {level, time} level-up notification
let myKills = 0;                           // kill counter
let myPrevHealth = null;                   // previous health for shake detection
let prevAlivePlayers = {};                 // id -> bool, for kill feed
let bulletTrailMap = {};                   // key -> {points, lastSeen} bullet trails
let aimJoystick = { active: false, touchId: null, vx: 0, vy: 0, angle: 0 };
let lastAutoFire = 0;

function startFadeIn() {
  isFadingIn = true;
  fadeInStartTime = Date.now();
  fadeInAlpha = 0.3; // Start slightly transparent so game is visible
}

const startMenu = document.getElementById("startMenu");
const startBtn = document.getElementById("startBtn");
const shopBtn = document.getElementById("shopBtn");
const nameInput = document.getElementById("nameInput");
const colorInput = document.getElementById("colorInput");
const respawnMenu = document.getElementById("respawnMenu");
const respawnBtn = document.getElementById("respawnBtn");
const respawnShopBtn = document.getElementById("respawnShopBtn");
const upgradePanel = document.getElementById("upgradePanel");
const upgradePointsText = document.getElementById("upgradePoints");
const lbToggleBtn = document.getElementById("lbToggleBtn");
const lbOverlay   = document.getElementById("lbOverlay");
const lbList      = document.getElementById("lbList");
const lbCloseBtn  = document.getElementById("lbCloseBtn");

console.log("🔍 Buttons found:", { startBtn, shopBtn, respawnBtn, respawnShopBtn });

// Initialize skins
(async () => {
  await loadSkins();
  await initializeCustomSkinCache();
})();

setSkinChangedHandler(({ skin, customSkinUrl }) => {
  if (socket.readyState !== WebSocket.OPEN || !myId) return;
  socket.send(JSON.stringify({ type: "skinUpdate", skin, customSkinUrl }));
});

function updateMapView() {
  if (!showMap) return;
  
  mapOverlay.style.display = "block";
  const mapSize = Math.min(innerWidth * 0.95, innerHeight * 0.95);
  mapCanvas.width = mapSize;
  mapCanvas.height = mapSize;
  mapCanvas.style.width = mapSize + "px";
  mapCanvas.style.height = mapSize + "px";
  
  mapCtx.clearRect(0, 0, mapSize, mapSize);
  
  // Draw map background
  mapCtx.fillStyle = "#111";
  mapCtx.fillRect(0, 0, mapSize, mapSize);
  
  // Draw grid
  mapCtx.strokeStyle = "#333";
  mapCtx.lineWidth = 1;
  const gridSize = 50;
  const scale = mapSize / WORLD_SIZE;
  
  for (let x = 0; x < WORLD_SIZE; x += gridSize) {
    mapCtx.beginPath();
    mapCtx.moveTo(x * scale, 0);
    mapCtx.lineTo(x * scale, mapSize);
    mapCtx.stroke();
  }
  
  for (let y = 0; y < WORLD_SIZE; y += gridSize) {
    mapCtx.beginPath();
    mapCtx.moveTo(0, y * scale);
    mapCtx.lineTo(mapSize, y * scale);
    mapCtx.stroke();
  }
  
  // Draw orbs
  for (let id in orbs) {
    const orb = orbs[id];
    mapCtx.beginPath();
    mapCtx.arc(orb.x * scale, orb.y * scale, 3 * orb.size, 0, Math.PI * 2);
    mapCtx.fillStyle = orb.color;
    mapCtx.fill();
  }
  
  // Draw players
  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;
    
    const px = p.x * scale;
    const py = p.y * scale;
    
    mapCtx.beginPath();
    mapCtx.arc(px, py, 4, 0, Math.PI * 2);
    mapCtx.fillStyle = id === myId ? p.color : "#f44336";
    mapCtx.fill();
    
    if (id === myId) {
      mapCtx.strokeStyle = "#fff";
      mapCtx.lineWidth = 2;
      mapCtx.stroke();
    }
  }
}

upgradePanel.querySelectorAll("button[data-stat]").forEach(btn => {
  const multi = btn.dataset.multi ? parseInt(btn.dataset.multi) : 1;
  btn.addEventListener("click", () => {
    sendUpgrade(btn.dataset.stat, multi);
  });
});

startBtn.onclick = () => {
  const name = nameInput.value || "Player";
  const color = colorInput.value || "#4caf50";
  const skin = getSelectedSkin();
  const customSkinUrl = getCustomSkinUrl();
  startMenu.style.display = "none";
  startMenu.classList.remove("show");
  showMap = false;
  mapOverlay.style.display = "none";
  socket.send(JSON.stringify({ type: "setup", name, color, skin, customSkinUrl }));
};

if (shopBtn) {
  console.log("✅ attaching shop button listener");
  shopBtn.onclick = () => {
    console.log("🛍️ shop button clicked");
    openShop();
  };
} else {
  console.log("❌ shopBtn not found!");
}

if (respawnShopBtn) {
  console.log("✅ attaching respawn shop button listener");
  respawnShopBtn.onclick = () => {
    console.log("🛍️ respawn shop button clicked");
    openShop();
  };
} else {
  console.log("❌ respawnShopBtn not found!");
}

respawnBtn.onclick = () => socket.send(JSON.stringify({ type: "respawn" }));

socket.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "requestSetup") {
    console.log("📋 Server requesting setup");
    startMenu.style.display = "block";
    startMenu.classList.add("show");
    showMap = true;
    updateMapView();
  }

  if (data.type === "queued") {
    console.log("⏳ Queued at position:", data.position);
    queuePosition = data.position;
    startMenu.style.display = "block";
    startMenu.classList.add("show");

    // Hide inputs and show queue info
    document.querySelectorAll("#startMenu input").forEach(el => el.style.display = "none");
    document.querySelectorAll("#startMenu button").forEach(el => el.style.display = "none");

    let queueInfo = document.getElementById("queueInfo");
    if (!queueInfo) {
      queueInfo = document.createElement("div");
      queueInfo.id = "queueInfo";
      startMenu.appendChild(queueInfo);
    }
    queueInfo.innerHTML = `
      <p style="color:#ccc; margin: 20px 0; font-size: 18px;">You are #${data.position} in the queue</p>
      <p style="color:#999; font-size: 14px;">Waiting for a slot to open...</p>
    `;

    showMap = true;
    updateMapView();
  }

  if (data.type === "init") {
    console.log("✅ Player ID received:", data.id);
    myId = data.id;
    if (!players[myId]) {
      players[myId] = { x: 0, y: 0 };
    }
    // If player was queued, restore inputs for next attempt
    const queueInfo = document.getElementById("queueInfo");
    if (queueInfo) {
      queueInfo.remove();
      document.querySelectorAll("#startMenu input").forEach(el => el.style.display = "block");
      document.querySelectorAll("#startMenu button").forEach(el => el.style.display = "block");
    }
  }

  if (data.type === "error") {
    console.error("Server error:", data.message);
    alert("Error: " + data.message);
  }

  if (data.type === "state") {
    const serverPlayers = data.players;
    const serverBullets = data.bullets;
    const serverOrbs = data.orbs || {};

    if (!window.lastStateLog) window.lastStateLog = 0;
    if (Date.now() - window.lastStateLog > 1000) {
      console.log("🎮 State received - players:", Object.keys(serverPlayers).length);
      window.lastStateLog = Date.now();
    }

    // Update leaderboard
    if (data.leaderboard) {
      leaderboard = data.leaderboard;
      // Update HTML overlay
      if (lbList) {
        lbList.innerHTML = leaderboard.map((player, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`;
          const cls = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : '';
          return `<div class="lb-row ${cls}">
            <span class="lb-rank">${medal}</span>
            <span class="lb-name">${player.name}</span>
            <span class="lb-xp">⭐ ${Math.round(player.totalXp||0)} XP · Lvl ${player.level}</span>
          </div>`;
        }).join('');
      }
    }

    // Store server time for interpolation
    const serverTime = Date.now();

    // Reconcile player position with gentle correction
    if (myId && serverPlayers[myId]) {
      if (!players[myId]) {
        players[myId] = {};
      }

      const serverPlayer = serverPlayers[myId];
      const clientPlayer = players[myId];

      // Check for level up and award coins
      if (clientPlayer.level && serverPlayer.level > clientPlayer.level) {
        const oldLevel = clientPlayer.level;
        const newLevel = serverPlayer.level;

        // Calculate coins: each level gives coins equal to the level number
        // Level 2 = 2 coins, Level 3 = 3 coins, etc.
        let coinsEarned = 0;
        for (let i = oldLevel + 1; i <= newLevel; i++) {
          coinsEarned += i;
        }

        updateCoins((players[myId]?.coinage || 0) + coinsEarned);
        if (!players[myId]) players[myId] = {};
        players[myId].coinage = (players[myId].coinage || 0) + coinsEarned;

        // Level-up notification
        levelUpNotif = { level: newLevel, time: Date.now() };

        // Refresh shop if it's open
        const shopPage = document.getElementById('shopPage');
        if (shopPage) {
          const newShop = createShopPage();
          shopPage.replaceWith(newShop);
        }
      }

      // Copy all server data first, but keep client-predicted x/y to avoid snapping
      const predictedX = clientPlayer.x;
      const predictedY = clientPlayer.y;
      Object.assign(clientPlayer, serverPlayer);

      // Store authoritative server position for gentle correction
      myServerPos = { x: serverPlayer.x, y: serverPlayer.y };

      const errX = serverPlayer.x - predictedX;
      const errY = serverPlayer.y - predictedY;
      const err = Math.sqrt(errX * errX + errY * errY);

      if (err > 120) {
        // Large discrepancy (respawn, wall collision, etc.) — hard snap
        clientPlayer.x = serverPlayer.x;
        clientPlayer.y = serverPlayer.y;
      } else {
        // Restore predicted position; per-frame nudge in sendInput() will correct it
        clientPlayer.x = predictedX;
        clientPlayer.y = predictedY;
      }
    }

    // Update other players with interpolation data
    for (let id in serverPlayers) {
      if (id !== myId) {
        const serverPlayer = serverPlayers[id];

        // Store previous position if this player exists
        if (players[id]) {
          if (!playerPrevPos[id]) {
            playerPrevPos[id] = {};
          }
          playerPrevPos[id].x = players[id].x;
          playerPrevPos[id].y = players[id].y;
          playerPrevPos[id].time = serverTime;
        }

        // Update with new server data
        players[id] = serverPlayer;
      }
    }

    // Remove players that are no longer in the server state (disconnected)
    for (const id in players) {
      if (id !== myId && !serverPlayers[id]) {
        delete players[id];
        delete playerPrevPos[id];
        delete prevAlivePlayers[id];
      }
    }

    bullets = serverBullets;
    orbs = serverOrbs;

    // Detect player deaths for kill feed
    for (const id in serverPlayers) {
      const sp = serverPlayers[id];
      const wasAlive = prevAlivePlayers[id];
      const isAlive = sp.alive;
      if (wasAlive && !isAlive && id !== myId) {
        killFeed.push({ name: sp.name || '?', color: sp.color || '#f44336', time: Date.now() });
        if (killFeed.length > 5) killFeed.shift();
        myKills++;
      }
      prevAlivePlayers[id] = isAlive;
    }

    // Screen shake on health drop
    if (myId && serverPlayers[myId]) {
      const newHealth = serverPlayers[myId].health;
      if (myPrevHealth !== null && newHealth < myPrevHealth && serverPlayers[myId].alive) {
        const drop = myPrevHealth - newHealth;
        screenShake.intensity = Math.min(drop * 0.6, 14);
      }
      myPrevHealth = newHealth;
    }

    if (myId && players[myId]) {
      const me = players[myId];
      if (!me.alive) {
        if (lbToggleBtn) { lbToggleBtn.style.display = 'none'; lbOverlay.classList.remove('open'); }
        // Only show respawn menu if the shop is not open
        if (!document.getElementById('shopPage')) {
          respawnMenu.style.display = "block";
          respawnMenu.classList.add("show");
          showMap = true;
          updateMapView();
        }
      } else {
        if (lbToggleBtn && window.innerWidth <= 768) lbToggleBtn.style.display = 'block';
        respawnMenu.style.display = "none";
        respawnMenu.classList.remove("show");
        startMenu.style.display = "none";
        startMenu.classList.remove("show");
        showMap = false;
        mapOverlay.style.display = "none";

        // Set target camera to follow player
        targetCamera.x = me.x - canvas.width / 2;
        targetCamera.y = me.y - canvas.height / 2;
      }
    }

    if (myId && players[myId] && players[myId].CanUpgrade > 0 && players[myId].alive) {
      upgradePanel.style.display = "block";
      upgradePointsText.textContent = players[myId].CanUpgrade;
      // Update counts
      const counts = players[myId].upgradeCounts || {};
      document.getElementById("count-damage").textContent = counts.damage || 0;
      document.getElementById("count-power").textContent = counts.power || 0;
      document.getElementById("count-bulletSpeed").textContent = counts.bulletSpeed || 0;
      document.getElementById("count-fireRate").textContent = counts.fireRate || 0;
      document.getElementById("count-bodyDamage").textContent = counts.bodyDamage || 0;
      document.getElementById("count-regenerationRate").textContent = counts.regenerationRate || 0;
      document.getElementById("count-speed").textContent = counts.speed || 0;
      document.getElementById("count-maxHealth").textContent = counts.maxHealth || 0;
    } else {
      upgradePanel.style.display = "none";
    }
  }
};

function sendUpgrade(stat, multiplier = 1) {
  socket.send(JSON.stringify({ type: "upgrade", stat, multiplier }));
}

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function returnToMainMenu() {
  if (!myId) return;
  socket.send(JSON.stringify({ type: "leave" }));
  myId = null;
  players = {};
  bullets = {};
  orbs = {};
  respawnMenu.style.display = "none";
  respawnMenu.classList.remove("show");
  upgradePanel.style.display = "none";
  closeShop();
  if (lbToggleBtn) lbToggleBtn.style.display = "none";
  if (lbOverlay) lbOverlay.classList.remove("open");
  startMenu.style.display = "block";
  startMenu.classList.add("show");
  showMap = true;
  updateMapView();
}

window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if ((e.key === "m" || e.key === "M") && myId) {
    returnToMainMenu();
    return;
  }
  if (upgradePanel.style.display !== "none") {
    const stats = ["damage", "power", "bulletSpeed", "fireRate", "bodyDamage", "regenerationRate", "speed", "maxHealth"];
    const num = parseInt(e.key);
    if (num >= 1 && num <= 8) {
      sendUpgrade(stats[num - 1]);
    }
  }
});

window.addEventListener("keyup", e => keys[e.key] = false);

window.addEventListener("mousedown", () => {
  if (!myId || !players[myId] || !players[myId].alive) return;
  socket.send(JSON.stringify({ type: "shoot" }));
});

function sendInput(delta = 16) {
  if (!myId || !players[myId] || !players[myId].alive) return;

  // Aim angle: aim joystick > move joystick fallback > mouse
  let angle;
  if (aimJoystick.active && (aimJoystick.vx !== 0 || aimJoystick.vy !== 0)) {
    angle = aimJoystick.angle;
  } else if (joystick.active && (joystick.vx !== 0 || joystick.vy !== 0)) {
    angle = Math.atan2(joystick.vy, joystick.vx);
  } else {
    const mdx = mouse.x - (canvas.width * 0.5);
    const mdy = mouse.y - (canvas.height * 0.5);
    angle = Math.atan2(mdy, mdx);
  }

  // WASD movement vector
  let vx = 0;
  let vy = 0;
  if (joystick.active) {
    vx = joystick.vx;
    vy = joystick.vy;
  } else {
    if (keys["w"] || keys["W"] || keys["ArrowUp"])    vy -= 1;
    if (keys["s"] || keys["S"] || keys["ArrowDown"])  vy += 1;
    if (keys["a"] || keys["A"] || keys["ArrowLeft"])  vx -= 1;
    if (keys["d"] || keys["D"] || keys["ArrowRight"]) vx += 1;
  }

  // Normalize diagonal movement
  const len = Math.sqrt(vx * vx + vy * vy);
  const nvx = len > 0 ? vx / len : 0;
  const nvy = len > 0 ? vy / len : 0;

  // Client-side prediction with smoother movement
  if (players[myId]) {
    players[myId].angle = angle;
    if (nvx !== 0 || nvy !== 0) {
      players[myId].x += nvx * players[myId].speed * (delta / 16);
      players[myId].y += nvy * players[myId].speed * (delta / 16);
      players[myId].x = Math.max(0, Math.min(WORLD_SIZE, players[myId].x));
      players[myId].y = Math.max(0, Math.min(WORLD_SIZE, players[myId].y));
    }

    // Gently nudge predicted position toward last server position (5% per frame)
    // This corrects accumulated drift without causing visible snaps
    if (myServerPos) {
      players[myId].x += (myServerPos.x - players[myId].x) * 0.05;
      players[myId].y += (myServerPos.y - players[myId].y) * 0.05;
    }
  }

  // Throttle network sends to ~20/sec to reduce bandwidth
  const now = Date.now();
  if (now - lastInputSent >= 50) {
    socket.send(JSON.stringify({ type: "input", angle, vx: nvx, vy: nvy, timestamp: now }));
    lastInputSent = now;
  }

  // Auto-fire when aim joystick is being dragged
  if (aimJoystick.active && (aimJoystick.vx !== 0 || aimJoystick.vy !== 0)) {
    const fireRate = players[myId]?.fireRate || 500;
    if (now - lastAutoFire >= fireRate) {
      socket.send(JSON.stringify({ type: "shoot" }));
      lastAutoFire = now;
    }
  }
}

// Helper function to get smooth render position for other players
function getPlayerRenderPos(id) {
  const p = players[id];
  if (!id || !p) return { x: p?.x || 0, y: p?.y || 0 };

  // My own player - no interpolation needed (client prediction handles it)
  if (id === myId) {
    return { x: p.x, y: p.y };
  }

  // Other players - interpolate between previous and current position
  const prevPos = playerPrevPos[id];
  if (!prevPos) {
    return { x: p.x, y: p.y };
  }

  // Interpolate over approximately 60ms (one frame at 60fps)
  const now = Date.now();
  const elapsed = now - prevPos.time;
  const interpDuration = 66; // ~15fps update rate, spread over frame time
  const progress = Math.min(1, elapsed / interpDuration);

  const x = prevPos.x + (p.x - prevPos.x) * progress;
  const y = prevPos.y + (p.y - prevPos.y) * progress;

  return { x, y };
}

// --- Mobile joystick ---
const joystickBase = document.getElementById("joystickBase");
const joystickKnob = document.getElementById("joystickKnob");
const shootBtn    = document.getElementById("shootBtn");
const aimJoystickArea = document.getElementById("aimJoystickArea");
const aimJoystickBase = document.getElementById("aimJoystickBase");
const aimJoystickKnob = document.getElementById("aimJoystickKnob");

window.addEventListener("touchstart", () => {
  document.getElementById("joystickArea").style.display = "block";
  aimJoystickArea.style.display = "block";
  shootBtn.style.display = "none"; // replaced by aim joystick
}, { once: true });

joystickBase.addEventListener("touchstart", e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joystick.active = true;
  joystick.touchId = touch.identifier;
  const rect = joystickBase.getBoundingClientRect();
  joystick.baseX = rect.left + rect.width / 2;
  joystick.baseY = rect.top  + rect.height / 2;
}, { passive: false });

joystickBase.addEventListener("touchmove", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== joystick.touchId) continue;
    const dx = t.clientX - joystick.baseX;
    const dy = t.clientY - joystick.baseY;
    const maxR = 45;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxR);
    const a = Math.atan2(dy, dx);
    joystick.vx = Math.cos(a) * (clampedDist / maxR);
    joystick.vy = Math.sin(a) * (clampedDist / maxR);
    const kx = Math.cos(a) * clampedDist;
    const ky = Math.sin(a) * clampedDist;
    joystickKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }
}, { passive: false });

joystickBase.addEventListener("touchend", e => {
  for (const t of e.changedTouches) {
    if (t.identifier !== joystick.touchId) continue;
    joystick.active = false;
    joystick.vx = 0;
    joystick.vy = 0;
    joystickKnob.style.transform = "translate(-50%, -50%)";
  }
});

shootBtn.addEventListener("touchstart", e => {
  e.preventDefault();
  if (!myId || !players[myId] || !players[myId].alive) return;
  socket.send(JSON.stringify({ type: "shoot" }));
}, { passive: false });

// --- Aim joystick (right side) ---
aimJoystickBase.addEventListener("touchstart", e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  aimJoystick.active = true;
  aimJoystick.touchId = touch.identifier;
  const rect = aimJoystickBase.getBoundingClientRect();
  aimJoystick.baseX = rect.left + rect.width / 2;
  aimJoystick.baseY = rect.top + rect.height / 2;
}, { passive: false });

aimJoystickBase.addEventListener("touchmove", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== aimJoystick.touchId) continue;
    const dx = t.clientX - aimJoystick.baseX;
    const dy = t.clientY - aimJoystick.baseY;
    const maxR = 38;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxR);
    const a = Math.atan2(dy, dx);
    aimJoystick.vx = Math.cos(a) * (clampedDist / maxR);
    aimJoystick.vy = Math.sin(a) * (clampedDist / maxR);
    aimJoystick.angle = a;
    const kx = Math.cos(a) * clampedDist;
    const ky = Math.sin(a) * clampedDist;
    aimJoystickKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }
}, { passive: false });

aimJoystickBase.addEventListener("touchend", e => {
  for (const t of e.changedTouches) {
    if (t.identifier !== aimJoystick.touchId) continue;
    aimJoystick.active = false;
    aimJoystick.vx = 0;
    aimJoystick.vy = 0;
    aimJoystickKnob.style.transform = "translate(-50%, -50%)";
  }
});

// --- Leaderboard overlay ---
lbToggleBtn.addEventListener("click", () => lbOverlay.classList.add("open"));
lbCloseBtn.addEventListener("click", () => lbOverlay.classList.remove("open"));

function draw() {
  if (!myId) {
    // Show loading screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Connecting to server...", canvas.width / 2, canvas.height / 2);
    return;
  }

  if (!players[myId]) {
    // Game waiting for state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Loading game...", canvas.width / 2, canvas.height / 2);
    return;
  }

  const me = players[myId];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Paint background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Update camera with lerping
  if (!showMap) {
    camera.x += (targetCamera.x - camera.x) * cameraLerpSpeed;
    camera.y += (targetCamera.y - camera.y) * cameraLerpSpeed;
  }

  drawGrid(ctx, camera, canvas);
  drawMapBorder(ctx, WORLD_SIZE, camera, canvas);

  // Screen shake
  const shakeX = screenShake.intensity > 0 ? (Math.random()-0.5)*screenShake.intensity*2 : 0;
  const shakeY = screenShake.intensity > 0 ? (Math.random()-0.5)*screenShake.intensity*2 : 0;
  if (screenShake.intensity > 0) {
    screenShake.intensity *= 0.80;
    if (screenShake.intensity < 0.1) screenShake.intensity = 0;
  }

  ctx.save();
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;

    // Get interpolated position for smooth rendering
    const pos = getPlayerRenderPos(id);

    const radius = 20 + Math.sqrt(p.xp || 0) * 0.3;

    // Drop shadow (grounded oval)
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(pos.x + 3, pos.y + radius * 0.65, radius * 0.85, radius * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // Draw barrel/pipe behind the body — tinted with player color
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(p.angle || 0);
    const barrelLength = radius * 1.5;
    const barrelWidth = radius * 0.45;
    ctx.fillStyle = darkenColor(p.color || '#4caf50', 0.45);
    ctx.strokeStyle = darkenColor(p.color || '#4caf50', 0.65);
    ctx.lineWidth = 2;
    ctx.fillRect(radius * 0.2, -barrelWidth / 2, barrelLength, barrelWidth);
    ctx.strokeRect(radius * 0.2, -barrelWidth / 2, barrelLength, barrelWidth);
    ctx.restore();

    // Try to render skin if available (clipped to circle via offscreen canvas)
    const skinCanvas = p.skin ? getSkinCanvas(p.skin, p.customSkinUrl) : null;
    if (skinCanvas) {
      ctx.drawImage(skinCanvas, pos.x - radius, pos.y - radius, radius * 2, radius * 2);
    } else {
      // Fallback to colored circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    ctx.strokeStyle = darkenColor(p.color || '#4caf50', 0.3);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Low-health pulsing danger ring (< 30%)
    const hpRatio = p.health / (p.maxHealth || 100);
    if (hpRatio < 0.3) {
      const pulse = Math.sin(Date.now() * 0.009) * 0.5 + 0.5;
      ctx.save();
      ctx.strokeStyle = `rgba(255,50,50,${0.4 + pulse * 0.6})`;
      ctx.lineWidth = 2.5 + pulse * 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 5 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Crown above rank-1 player
    if (leaderboard.length > 0 && p.name === leaderboard[0].name) {
      ctx.font = `${Math.max(16, Math.round(radius * 0.65))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('👑', pos.x, pos.y - radius - 26);
    }

    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = darkenColor(p.color || '#4caf50', 0.3);
    ctx.lineWidth = 2;
    ctx.strokeText(p.name, pos.x, pos.y - radius - 10);
    ctx.fillText(p.name, pos.x, pos.y - radius - 10);

    // Colored health bar (green → yellow → red) — rendered well above the name
    const barHp = p.health / (p.maxHealth || 100);
    const barColor = barHp > 0.6 ? '#44dd55' : barHp > 0.3 ? '#ffcc00' : '#ff4444';
    const hbY = pos.y - radius - 44;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(pos.x - radius, hbY, radius * 2, 6);
    ctx.fillStyle = barColor;
    ctx.fillRect(pos.x - radius, hbY, radius * 2 * barHp, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pos.x - radius, hbY, radius * 2, 6);
  }

  // Clean up stale bullet trails
  const nowTrails = Date.now();
  for (const key in bulletTrailMap) {
    if (nowTrails - bulletTrailMap[key].lastSeen > 300) delete bulletTrailMap[key];
  }

  bullets.forEach(b => {
    const now = Date.now();
    const age = now - b.startTime;
    const distance = (age / 1000) * b.speed;
    const x = b.startX + Math.cos(b.angle) * distance;
    const y = b.startY + Math.sin(b.angle) * distance;
    
    // Only render if within world bounds
    if (x >= 0 && x <= WORLD_SIZE && y >= 0 && y <= WORLD_SIZE) {
      const ownerColor = players[b.owner]?.color || '#ffffff';
      const bKey = `${b.owner}|${b.startTime}`;

      // Update trail points
      if (!bulletTrailMap[bKey]) bulletTrailMap[bKey] = { points: [], lastSeen: now };
      bulletTrailMap[bKey].lastSeen = now;
      bulletTrailMap[bKey].points.push({ x, y });
      if (bulletTrailMap[bKey].points.length > 20) bulletTrailMap[bKey].points.shift();

      // Draw trail
      const trail = bulletTrailMap[bKey].points;
      for (let t = 1; t < trail.length; t++) {
        const alpha = (t / trail.length) * 0.45;
        ctx.strokeStyle = `rgba(${hexToRgb(ownerColor)},${alpha})`;
        ctx.lineWidth = (t / trail.length) * 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(trail[t-1].x, trail[t-1].y);
        ctx.lineTo(trail[t].x, trail[t].y);
        ctx.stroke();
      }

      // Glow halo
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 11);
      glow.addColorStop(0, `rgba(${hexToRgb(ownerColor)},0.55)`);
      glow.addColorStop(1, `rgba(${hexToRgb(ownerColor)},0)`);
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Bullet body in owner color
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = ownerColor;
      ctx.fill();
      ctx.strokeStyle = darkenColor(ownerColor, 0.35);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // Render orbs
  const orbNow = Date.now();
  for (let id in orbs) {
    const orb = orbs[id];
    // Stable numeric phase from string id (charCode sum)
    let orbPhaseHash = 0;
    for (let ci = 0; ci < id.length; ci++) orbPhaseHash += id.charCodeAt(ci);
    const orbPhase = orbPhaseHash * 0.7;
    const orbPulse = 1 + Math.sin(orbNow * 0.0025 + orbPhase) * 0.07;
    const orbRadius = 30 * (orb.size || 0.3) * orbPulse;

    // Guard: skip if any coordinate is non-finite
    if (!isFinite(orb.x) || !isFinite(orb.y) || !isFinite(orbRadius) || orbRadius <= 0) continue;

    // Outer glow
    const glowR = orbRadius * 1.7;
    const orbGlow = ctx.createRadialGradient(orb.x, orb.y, orbRadius * 0.4, orb.x, orb.y, glowR);
    orbGlow.addColorStop(0, orb.color + 'aa');
    orbGlow.addColorStop(1, orb.color + '00');
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, glowR, 0, Math.PI * 2);
    ctx.fillStyle = orbGlow;
    ctx.fill();

    // Body gradient (bright center → edge)
    const orbGrad = ctx.createRadialGradient(orb.x - orbRadius * 0.3, orb.y - orbRadius * 0.3, 0, orb.x, orb.y, orbRadius);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.35, orb.color);
    orbGrad.addColorStop(1, darkenColor(orb.color, 0.35));
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orbRadius, 0, Math.PI * 2);
    ctx.fillStyle = orbGrad;
    ctx.fill();

    // Specular shine
    const shine = ctx.createRadialGradient(
      orb.x - orbRadius * 0.32, orb.y - orbRadius * 0.32, 0,
      orb.x - orbRadius * 0.32, orb.y - orbRadius * 0.32, orbRadius * 0.55
    );
    shine.addColorStop(0, 'rgba(255,255,255,0.55)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orbRadius, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();

    // Ring
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw health bar above orb
    if (orb.health && orb.maxHealth) {
      const barWidth = orbRadius * 2;
      const barHeight = 5;
      const hpPct = orb.health / orb.maxHealth;
      const bx = orb.x - barWidth / 2;
      const by = orb.y - orbRadius - 12;
      const bColor = hpPct > 0.5 ? '#44dd55' : hpPct > 0.25 ? '#ffcc00' : '#ff4444';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, barWidth, barHeight);
      ctx.fillStyle = bColor;
      ctx.fillRect(bx, by, barWidth * hpPct, barHeight);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barWidth, barHeight);
    }
  }

  ctx.restore();
  drawMinimap(ctx, players, myId, WORLD_SIZE);

  // Draw leaderboard on canvas (PC only — mobile uses HTML overlay)
  if (window.innerWidth > 768) {
    ctx.save();
    const lbW = 240;
    const lbX = 14;
    const lbY = 10;
    const lbH = Math.min(leaderboard.length * 20 + 44, 264);

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    roundRect(ctx, lbX, lbY, lbW, lbH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TOP PLAYERS", lbX + lbW / 2, lbY + 20);

    ctx.font = "12px sans-serif";
    leaderboard.forEach((player, idx) => {
      const y = lbY + 40 + idx * 18;
      ctx.fillStyle = idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "rgba(255,255,255,0.8)";
      ctx.textAlign = "center";
      ctx.fillText(`${idx + 1}. ${player.name} — ${Math.round(player.totalXp||0)} XP`, lbX + lbW / 2, y);
    });
    ctx.restore();
  }

  // Kill feed (left side)
  const nowKf = Date.now();
  killFeed = killFeed.filter(k => nowKf - k.time < 4000);
  ctx.save();
  killFeed.forEach((k, i) => {
    const age = nowKf - k.time;
    const alpha = Math.max(0, 1 - age / 4000);
    ctx.globalAlpha = alpha;
    const kfY = canvas.height * 0.38 + i * 24;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(`💀 ${k.name}`, 18, kfY);
    ctx.fillStyle = k.color || '#f44336';
    ctx.fillText(`💀 ${k.name}`, 18, kfY);
  });
  ctx.restore();

  // Level-up notification
  if (levelUpNotif) {
    const age = Date.now() - levelUpNotif.time;
    if (age < 2600) {
      const alpha = age < 400 ? age / 400 : Math.max(0, 1 - (age - 400) / 2200);
      const yOff = age < 400 ? 0 : -((age - 400) / 35);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 5;
      ctx.strokeText(`⭐ LEVEL ${levelUpNotif.level}!`, canvas.width / 2, canvas.height / 2 - 80 + yOff);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`⭐ LEVEL ${levelUpNotif.level}!`, canvas.width / 2, canvas.height / 2 - 80 + yOff);
      ctx.restore();
    } else {
      levelUpNotif = null;
    }
  }

  // Kill counter HUD
  if (myKills > 0) {
    const kcY = window.innerWidth > 768 ? 280 : 178;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    roundRect(ctx, 14, kcY, 106, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💀 ${myKills} kill${myKills !== 1 ? 's' : ''}`, 22, kcY + 20);
    ctx.restore();
  }

  const p = players[myId];
  if (p) {
    const isMobile = window.innerWidth <= 768;
    const barWidth = isMobile ? Math.min(window.innerWidth - 40, 280) : 300;
    const barHeight = 22;
    const x = canvas.width / 2 - barWidth / 2;
    const barBottom = isMobile ? canvas.height - barHeight - 190 : canvas.height - barHeight - 20;
    const xpPercent = (p.xp % 100) / 100;
    const br = barHeight / 2;

    ctx.save();
    // Outer glass shell
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(ctx, x - 3, barBottom - 3, barWidth + 6, barHeight + 6, br + 3);
    ctx.fill();
    // Glass track
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, barBottom, barWidth, barHeight, br);
    ctx.fill();
    ctx.stroke();
    // XP fill
    if (xpPercent > 0) {
      const fillW = Math.max(barHeight, barWidth * xpPercent);
      const grad = ctx.createLinearGradient(x, 0, x + fillW, 0);
      grad.addColorStop(0, "rgba(220,220,255,0.95)");
      grad.addColorStop(1, "rgba(255,255,255,0.85)");
      ctx.fillStyle = grad;
      roundRect(ctx, x, barBottom, fillW, barHeight, br);
      ctx.fill();
    }
    // Label
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${isMobile ? 11 : 13}px sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;
    ctx.fillText(`Level ${p.level} | XP: ${Math.round(p.xp)}`, canvas.width / 2, barBottom + barHeight - 5);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  
  // Render fade-in overlay
  if (isFadingIn) {
    const fadeInDuration = 500; // 0.5 second fade-in (faster)
    const elapsed = Date.now() - fadeInStartTime;
    fadeInAlpha = Math.max(0, 0.5 - (elapsed / fadeInDuration * 0.5)); // Fade from 0.5 to 0
    
    if (fadeInAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeInAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      isFadingIn = false;
      fadeInAlpha = 0;
    }
  }
}

let lastFrameTime = 0;
function loop(timestamp) {
  const delta = lastFrameTime ? Math.min(timestamp - lastFrameTime, 50) : 16;
  lastFrameTime = timestamp;
  sendInput(delta);
  draw();
  if (showMap) updateMapView();
  requestAnimationFrame(loop);
}

console.log("🎮 Game loop starting...");
requestAnimationFrame(loop);
