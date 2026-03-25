const WORLD_SIZE = 5000;
const LevelCostMultiplier = 1.1;
const BaseLevelCost = 67;
const maxOrbs = 50;
const MaxLevel = 67;
const crypto = require('crypto');

class Game {
  constructor() {
    this.Orbs = {};
    this.players = {};
    this.bullets = [];
  }

  addPlayer(id, name, color) {
    const adminHash = crypto.createHash('sha256').update('adminpassword').digest('hex'); // Change 'adminpassword' to your desired password
    if (crypto.createHash('sha256').update(name).digest('hex') === adminHash) 
      this.players[id] = {
      id,
      name: "NILL",
      color: color || "#4caf50",
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      angle: 5,
      CanUpgrade: 91000000000000000000000000000000000000000000000000000000000000000000,
      speed: 3,
      health: 1,
      maxHealth: 91000000000000000000000000000000000000000000000000000000000000000000,
      alive: true,
      xp: 0,
      level: 66,
      damage: 54,
      power: 312,
      bulletSpeed: 30,
      fireRate: 0,
      bodyDamage: 5,
      regenerationRate: 3,
      tick: 0,
      bodyCooldown: 0,
      upgradeCounts: {}

    };
    else

    this.players[id] = {
      id,
      name: name || "Player",
      color: color || "#4caf50",
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      angle: 0,
      CanUpgrade: 0,
      speed: 4,
      health: 100,
      maxHealth: 100,
      alive: true,
      xp: 0,
      level: 1,
      damage: 5,
      power: 20,
      bulletSpeed: 3,
      fireRate: 500,
      bodyDamage: 10,
      regenerationRate: 0.0001,
      tick: 0,
      bodyCooldown: 0,
      upgradeCounts: {}

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
      p.angle = 0;
      p.CanUpgrade = 0;
      p.speed = 4;
      p.health = 100;
      p.maxHealth = 100;
      p.alive = true;
      p.xp = 0;
      p.level = 1;
      p.damage = 5;
      p.power = 20;
      p.bulletSpeed = 3;
      p.fireRate = 500;
      p.bodyDamage = 10;
      p.regenerationRate = 0.0001;
      p.tick = 0;
      p.bodyCooldown = 0;
      p.upgradeCounts = {};

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

    const now = Date.now();
    if (p.lastShot && now - p.lastShot < p.fireRate) return;
    p.lastShot = now;

    this.bullets.push({
      x: p.x + Math.cos(p.angle) * 25,
      y: p.y + Math.sin(p.angle) * 25,
      vx: Math.cos(p.angle) * p.bulletSpeed,
      vy: Math.sin(p.angle) * p.bulletSpeed,
      owner: id,
      life: p.power
    });
  }
  updateLevel(id) {
    const p = this.players[id];
    if (!p) return;

    const nextLevelXp = Math.floor(BaseLevelCost * (LevelCostMultiplier ** (p.level - 1)));
    if (p.xp >= nextLevelXp && p.level < MaxLevel) {
      p.level++;
      p.xp -= nextLevelXp;
      p.CanUpgrade++;
    }
  }

  applyUpgrade(id, stat, multiplier = 1) {
    const p = this.players[id];
    if (!p || p.CanUpgrade < multiplier) return;

    const upgrades = {
      damage: () => { p.damage += 2 * multiplier; },
      power: () => { p.power += 5 * multiplier; },
      bulletSpeed: () => { p.bulletSpeed += 1 * multiplier; },
      fireRate: () => { for(let i=0; i<multiplier; i++) p.fireRate = Math.max(100, p.fireRate - 50); },
      bodyDamage: () => { p.bodyDamage += 2 * multiplier; },
      regenerationRate: () => { p.regenerationRate += 0.05 * multiplier; },
      speed: () => { p.speed += 0.2 * multiplier; },
      maxHealth: () => {
        p.maxHealth += 20 * multiplier;
        p.health = Math.min(p.maxHealth, p.health + 20 * multiplier);
      }
    };

    if (upgrades[stat]) {
      upgrades[stat]();
      p.CanUpgrade -= multiplier;
      if (p.CanUpgrade < 0) p.CanUpgrade = 0;
      if (!p.upgradeCounts[stat]) p.upgradeCounts[stat] = 0;
      p.upgradeCounts[stat] += multiplier;
    }
  }
  addOrbs() {
    while (Object.keys(this.Orbs).length < maxOrbs) {
      const id = Math.random().toString(36).slice(2);
      this.Orbs[id] = {
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
      };
    }
    
    


  }

  update(delta) {
    // Update bullets
    this.bullets.forEach(b => {
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
    });
    
    this.bullets = this.bullets.filter(b => b.life > 0);
    // Regenerate health
    for (let id in this.players) {
      const p = this.players[id];
      if (p.alive && p.health < p.maxHealth) {
        p.health = Math.min(p.maxHealth, p.health + p.regenerationRate);
      }
    }
    // Body damage
    for (let id in this.players) {
      const p = this.players[id];
      if (!p.alive) continue;

      p.bodyCooldown -= delta;

      for (let otherId in this.players) {
        if (id === otherId) continue;
        const op = this.players[otherId];
        if (!op.alive) continue;

        const dx = p.x - op.x;
        const dy = p.y - op.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 40) {
          if (p.bodyCooldown <= 0) {
            op.health -= p.bodyDamage;
            p.bodyCooldown = 500; 
          }

          if (op.bodyCooldown <= 0) {
            p.health -= op.bodyDamage;
            op.bodyCooldown = 500;
          }

      // Death check
      if (p.health <= 0 && p.alive) {
        op.xp += 20;
        this.updateLevel(op.id);
        p.alive = false;
      }

      if (op.health <= 0 && op.alive) {
        p.xp += 20;
        this.updateLevel(p.id);
        op.alive = false;
      }
    }
  }
}
    // Bullet collisions
    this.bullets.forEach(b => {
      for (let id in this.players) {
        const p = this.players[id];
        if (!p.alive || id === b.owner) continue;

        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 20) {
          p.health -= b.owner && this.players[b.owner] ? this.players[b.owner].damage : 1;
          if (p.health <= 0) {
              if (b.owner && this.players[b.owner]) {
                this.players[b.owner].xp += 20;
              }
            this.updateLevel(b.owner);
            p.alive = false;
          }
        }
      }
    });
  }
}

module.exports = Game;














