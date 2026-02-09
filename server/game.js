const WORLD_SIZE = 3000;

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
      speed: 5
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
    this.bullets.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
    });

    this.bullets = this.bullets.filter(b => b.life > 0);
  }
}

module.exports = Game;
