const WORLD_SIZE = 5000;
const PLAYER_SIZE = 20;
const BULLET_DAMAGE = 20;
const COLLISION_DAMAGE = 10;
const MAX_HEALTH = 100;

class Game {
  constructor() {
    this.players = {};
    this.bullets = [];
  }

  addPlayer(id) {
    this.players[id] = {
      id,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      angle: 0,
      speed: 200, // units per second
      health: MAX_HEALTH,
      alive: true,
      xp: 0,
      level: 1,
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
    p.health = MAX_HEALTH;
    p.alive = true;
  }

  movePlayer(id, input, delta) {
    const p = this.players[id];
    if (!p || !p.alive) return;

    p.angle = input.angle;

    if (input.up) {
      const distance = p.speed * (delta / 1000); // speed per second
      p.x += Math.cos(p.angle) * distance;
      p.y += Math.sin(p.angle) * distance;
    }

    p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
    p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
  }

  shoot(id) {
    const p = this.players[id];
    if (!p || !p.alive) return;

    this.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.angle) * 500, // pixels/sec
      vy: Math.sin(p.angle) * 500,
      owner: id,
      life: 2000 // ms
    });
  }

  update(delta) {
    // Move bullets
    this.bullets.forEach(b => {
      b.x += b.vx * (delta / 1000);
      b.y += b.vy * (delta / 1000);
      b.life -= delta;

      // Bullet hit players
      for (const id in this.players) {
        const p = this.players[id];
        if (!p.alive) continue;
        if (id !== b.owner && this._collide(p, b)) {
          p.health -= BULLET_DAMAGE;
          b.life = 0;
          if (p.health <= 0) {
            p.alive = false;
          }
        }
      }
    });

    // Player collisions
    const ids = Object.keys(this.players);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = this.players[ids[i]];
        const b = this.players[ids[j]];
        if (!a.alive || !b.alive) continue;
        if (this._playerCollide(a, b)) {
          a.health -= COLLISION_DAMAGE;
          b.health -= COLLISION_DAMAGE;
          if (a.health <= 0) a.alive = false;
          if (b.health <= 0) b.alive = false;
        }
      }
    }

    this.bullets = this.bullets.filter(b => b.life > 0);

    // Remove dead players from the map
    for (const id in this.players) {
      if (!this.players[id].alive) {
        delete this.players[id];
      }
    }
  }

  _collide(player, bullet) {
    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    return Math.sqrt(dx*dx + dy*dy) < PLAYER_SIZE;
  }

  _playerCollide(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx*dx + dy*dy) < PLAYER_SIZE * 2;
  }
}

module.exports = Game;
