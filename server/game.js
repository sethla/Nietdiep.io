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
          const MARGIN = 100;

    this.players[id] = {
      id,
      name: name || "Player",
      color: color || "#4caf50",
    x: MARGIN + Math.random() * (WORLD_SIZE - MARGIN*2),
    y: MARGIN + Math.random() * (WORLD_SIZE - MARGIN*2),
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
  movePlayer(id, input) {
  const p = this.players[id];
  if (!p || !p.alive) return;

  const speed = p.speed;
  let vx = 0;
  let vy = 0;

  if (input.up) vy -= speed;
  if (input.down) vy += speed;
  if (input.left) vx -= speed;
  if (input.right) vx += speed;

  // normalize (zodat diagonaal niet sneller is)
  const len = Math.hypot(vx, vy);
  if (len > 0) {
    vx = (vx / len) * speed;
    vy = (vy / len) * speed;
  }

  p.x += vx;
  p.y += vy;

  p.angle = input.angle;

  // map borders
  p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
  p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
}
getAllTargets(botId) {
  const targets = [];

  for (const id in this.players) {
    const p = this.players[id];
    if (p.alive) targets.push(p);
  }

  for (const id in this.bots) {
    if (id !== botId && this.bots[id].alive) {
      targets.push(this.bots[id]);
    }
  }

  return targets;
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
  updateBot(bot) {
  const targets = this.getAllTargets(bot.id);
  if (targets.length === 0) return;

  let closest = null;
  let dist = Infinity;

  for (const t of targets) {
    const d = Math.hypot(t.x - bot.x, t.y - bot.y);
    if (d < dist) {
      dist = d;
      closest = t;
    }
  }

  if (!closest) return;

  bot.angle = Math.atan2(closest.y - bot.y, closest.x - bot.x);

  // move
  bot.x += Math.cos(bot.angle) * bot.speed;
  bot.y += Math.sin(bot.angle) * bot.speed;

  // shoot
  if (bot.reload <= 0) {
    this.spawnBullet(bot);
    bot.reload = 30;
  } else {
    bot.reload--;
  }
}

}

module.exports = Game;
