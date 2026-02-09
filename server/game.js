const WORLD_SIZE = 3000;
const PLAYER_SIZE = 20; // For collision detection
const BULLET_DAMAGE = 20;

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
      speed: 5,
      health: 100,  // New: player health
    };
  }

  removePlayer(id) {
    delete this.players[id];
  }

  movePlayer(id, input) {
    const p = this.players[id];
    if (!p) return;

    p.angle = input.angle;

    if (input.up) {
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
    }

    // Keep player inside map
    p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
    p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
  }

  shoot(id) {
    const p = this.players[id];
    if (!p) return;

    this.bullets.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.angle) * 10,
      vy: Math.sin(p.angle) * 10,
      owner: id,
      life: 100
    });
  }

  update() {
    // Move bullets
    this.bullets.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      // Check collisions with players
      for (const id in this.players) {
        const p = this.players[id];
        if (id !== b.owner && this._collide(p, b)) {
          p.health -= BULLET_DAMAGE;
          b.life = 0; // destroy bullet on hit
          if (p.health <= 0) {
            this.removePlayer(p.id); // remove dead player
          }
        }
      }
    });

    // Remove dead bullets
    this.bullets = this.bullets.filter(b => b.life > 0);
  }

  _collide(player, bullet) {
    // Simple circle collision
    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    return Math.sqrt(dx*dx + dy*dy) < PLAYER_SIZE;
  }
}

module.exports = Game;
