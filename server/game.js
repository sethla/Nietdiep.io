const WORLD_SIZE = 5000;

class Game {
  constructor() {
    this.players = {};
    this.bots = {};
    this.bullets = [];
    this.nextBotId = 1;
    this.maxBots = 15; // dynamisch max bots
  }

  // Voeg speler toe
  addPlayer(id, name, color) {
    name = name.slice(0, 15);
    this.players[id] = {
      id,
      name: name || "Player",
      color: color || "#4caf50",
      x: this.randomSpawn(),
      y: this.randomSpawn(),
      angle: 0,
      speed: 5,
      health: 100,
      alive: true,
      xp: 0,
      level: 1
    };
  }

  // Verwijder speler
  removePlayer(id) {
    delete this.players[id];
  }

  // Respawn speler
  respawnPlayer(id) {
    const p = this.players[id];
    if (!p) return;
    p.x = this.randomSpawn();
    p.y = this.randomSpawn();
    p.health = 100;
    p.alive = true;
  }

  // Random spawn binnen map
  randomSpawn() {
    return 50 + Math.random() * (WORLD_SIZE - 100);
  }

  // Voeg een bot toe (dynamisch)
  addBot() {
    if (Object.keys(this.bots).length >= this.maxBots) return;
    const id = "bot_" + this.nextBotId++;
    this.bots[id] = {
      id,
      name: "Bot" + id,
      color: "#ff9800",
      x: this.randomSpawn(),
      y: this.randomSpawn(),
      angle: Math.random() * Math.PI * 2,
      speed: 4,
      health: 100,
      alive: true
    };
  }

  // Move speler met WASD + mouse aiming
  movePlayer(id, input, delta) {
    const p = this.players[id];
    if (!p || !p.alive) return;

    p.angle = input.angle;

    let dx = 0, dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    p.x += dx * p.speed * (delta / 16);
    p.y += dy * p.speed * (delta / 16);

    // Map borders
    p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
    p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
  }

  // Beweeg bots automatisch en schiet
  moveBots(delta) {
    const allEntities = {...this.players, ...this.bots};
    for (let id in this.bots) {
      const bot = this.bots[id];
      if (!bot.alive) continue;

      // zoek dichtstbijzijnde target
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

      // Map borders
      bot.x = Math.max(0, Math.min(WORLD_SIZE, bot.x));
      bot.y = Math.max(0, Math.min(WORLD_SIZE, bot.y));
    }
  }

  // Schiet door speler
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

  // Schiet door bot
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

  // Update game state
  update(delta) {
    // Voeg automatisch bots toe als er minder dan max zijn
    while(Object.keys(this.bots).length < this.maxBots) this.addBot();

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
