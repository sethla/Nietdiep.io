const WORLD_SIZE = 5000;

class Game {
  constructor() {
    this.players = {};
    this.bullets = [];
    this.bots = {};
    this.botCount = 5;

    for (let i = 0; i < this.botCount; i++) {
      this.spawnBot();
    }
  }

  spawnPlayer(id) {
    this.players[id] = {
      id,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      angle: 0,
      speed: 5,
      health: 100,
      alive: true,
      color: "#4caf50"
    };
  }

  removePlayer(id) {
    delete this.players[id];
  }

  spawnBot() {
    const id = "bot_" + Math.random().toString(36).slice(2);
    this.bots[id] = {
      id,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      angle: 0,
      speed: 3,
      health: 100,
      alive: true,
      reload: 0,
      color: "#999"
    };
  }

  movePlayer(id, input) {
    const p = this.players[id];
    if (!p || !p.alive) return;

    p.angle = input.angle;

    if (input.up) {
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
    }

    p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
    p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
  }

  shoot(owner) {
    const p = this.players[owner] || this.bots[owner];
    if (!p || !p.alive) return;

    this.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.angle) * 10,
      vy: Math.sin(p.angle) * 10,
      life: 100,
      owner
    });
  }

  updateBots() {
    for (const id in this.bots) {
      const b = this.bots[id];
      if (!b.alive) continue;

      const targets = [
        ...Object.values(this.players),
        ...Object.values(this.bots).filter(x => x.id !== id)
      ].filter(t => t.alive);

      if (!targets.length) continue;

      let closest = targets[0];
      let dist = Infinity;

      for (const t of targets) {
        const d = Math.hypot(t.x - b.x, t.y - b.y);
        if (d < dist) {
          dist = d;
          closest = t;
        }
      }

      b.angle = Math.atan2(closest.y - b.y, closest.x - b.x);
      b.x += Math.cos(b.angle) * b.speed;
      b.y += Math.sin(b.angle) * b.speed;

      if (b.reload-- <= 0) {
        this.shoot(id);
        b.reload = 40;
      }
    }
  }

  update() {
    this.updateBots();

    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      for (const p of Object.values(this.players)) {
        if (p.alive && Math.hypot(p.x - b.x, p.y - b.y) < 20 && b.owner !== p.id) {
          p.health -= 20;
          b.life = 0;
          if (p.health <= 0) p.alive = false;
        }
      }

      for (const bot of Object.values(this.bots)) {
        if (bot.alive && Math.hypot(bot.x - b.x, bot.y - b.y) < 20 && b.owner !== bot.id) {
          bot.health -= 20;
          b.life = 0;
          if (bot.health <= 0) bot.alive = false;
        }
      }
    }

    this.bullets = this.bullets.filter(b => b.life > 0);
  }
}

module.exports = { Game, WORLD_SIZE };
