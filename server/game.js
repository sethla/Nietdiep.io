const WORLD_SIZE = 5000;

class Game {
  constructor() {
    this.players = {}; // echte spelers
    this.bots = {};    // AI bots
    this.bullets = [];
    this.nextBotId = 1;
    this.maxBots = 10;
  }

  addPlayer(id, name, color) {
    name = name.slice(0, 15); // max 15 chars
    this.players[id] = {
      id,
      name: name || "Player",
      color: color || "#4caf50",
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      angle: 0,
      speed: 5,
      health: 100,
      alive: true,
      xp: 0,
      level: 1
    };
  }

  removePlayer(id) {
    delete this.players[id];
  }

respawnPlayer(id) {
  const p = this.players[id];
  if (!p) return;
  p.x = 50 + Math.random() * (WORLD_SIZE - 100);
  p.y = 50 + Math.random() * (WORLD_SIZE - 100);
  p.health = 100;
  p.alive = true;
}

  addBot() {
    if (Object.keys(this.bots).length >= this.maxBots) return;
    const id = "bot_" + this.nextBotId++;
    this.bots[id] = {
      id,
      name: "Bot" + id,
      color: "#ff9800",
      x: 50 + Math.random() * (WORLD_SIZE - 100),
      y: 50 + Math.random() * (WORLD_SIZE - 100),

      angle: Math.random() * Math.PI * 2,
      speed: 4,
      health: 100,
      alive: true
    };
  }

  movePlayer(id, input, delta) {
    const p = this.players[id];
if (!p || !p.alive) return;  // dit zorgt dat je niet kan bewegen als je dead bent

// WASD movement
let dx=0, dy=0;
if(input.up) dy-=1;
if(input.down) dy+=1;
if(input.left) dx-=1;
if(input.right) dx+=1;

const len = Math.hypot(dx, dy);
if(len>0){ dx/=len; dy/=len; }

p.x += dx * p.speed * (delta/16);
p.y += dy * p.speed * (delta/16);

// Map borders
p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));

  }

  moveBots(delta) {
    const allEntities = {...this.players, ...this.bots};
    for (let id in this.bots) {
      const bot = this.bots[id];
      if (!bot.alive) continue;

      let nearest = null;
      let nearestDist = Infinity;
      for (let otherId in allEntities) {
        if (otherId === id) continue;
        const e = allEntities[otherId];
        if (!e.alive) continue;
        const dx = e.x - bot.x;
        const dy = e.y - bot.y;
        const dist = dx*dx + dy*dy;
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = e;
        }
      }

      if (nearest) {
        const dx = nearest.x - bot.x;
        const dy = nearest.y - bot.y;
        bot.angle = Math.atan2(dy, dx);

        bot.x += Math.cos(bot.angle) * bot.speed * (delta / 16);
        bot.y += Math.sin(bot.angle) * bot.speed * (delta / 16);

        if (Math.random() < 0.02) this.shootBot(bot);
      }

      bot.x = Math.max(0, Math.min(WORLD_SIZE, bot.x));
      bot.y = Math.max(0, Math.min(WORLD_SIZE, bot.y));
    }
  }

  shoot(id) {
    let p = this.players[id] || this.bots[id];
    if (!p || !p.alive) return;

    this.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.angle) * 10,
      vy: Math.sin(p.angle) * 10,
      owner: p.id,
      life: 100
    });
  }

  shootBot(bot) {
    this.bullets.push({
      x: bot.x,
      y: bot.y,
      vx: Math.cos(bot.angle) * 10,
      vy: Math.sin(bot.angle) * 10,
      owner: bot.id,
      life: 100
    });
  }

  update(delta) {
    this.moveBots(delta);

    this.bullets.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
    });
    this.bullets = this.bullets.filter(b => b.life > 0);

    const allEntities = {...this.players, ...this.bots};
    this.bullets.forEach(b => {
      for (let id in allEntities) {
        const p = allEntities[id];
        if (!p.alive || id === b.owner) continue;

        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 20) {
          p.health -= 20;
          b.life = 0;
          if (p.health <= 0) p.alive = false;
        }
      }
    });
  }
}

module.exports = Game;
