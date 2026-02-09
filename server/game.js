const WORLD_SIZE = 5000;

class Game {
  constructor() {
    this.players = {};
    this.bullets = [];
  }

  addPlayer(id, name, color) {
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
    p.x = Math.random() * WORLD_SIZE;
    p.y = Math.random() * WORLD_SIZE;
    p.health = 100;
    p.alive = true;
  }

  movePlayer(id, input, delta) {
    const p = this.players[id];
    if (!p || !p.alive) return;

    p.angle = input.angle;
    if (input.up) {
      p.x += Math.cos(p.angle) * p.speed * (delta / 16);
      p.y += Math.sin(p.angle) * p.speed * (delta / 16);

      // Map borders
      p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
      p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
    }
  }

  shoot(id) {
    const p = this.players[id];
    if (!p || !p.alive) return;

    this.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.angle) * 10,
      vy: Math.sin(p.angle) * 10,
      owner: id,
      life: 100
    });
  }

  update(delta) {
    // update bullets
    this.bullets.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
    });

    this.bullets = this.bullets.filter(b => b.life > 0);

    // bullet collision
    this.bullets.forEach(b => {
      for (let id in this.players) {
        const p = this.players[id];
        if (!p.alive || id === b.owner) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
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
