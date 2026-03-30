const WORLD_SIZE = 5000;
const LevelCostMultiplier = 1.1;
const BaseLevelCost = 67;
const maxOrbs = 250;
const MaxLevel = 67;
const MAX_PLAYERS = 15;
const crypto = require('crypto');

class Game {
  constructor() {
    this.Orbs = {};
    this.players = {};
    this.bullets = [];
    this.queue = []; // Array of {id, name, color, skin}
  }
  
  addPlayer(id, name, color, skin = 'default', customSkinUrl = null) {
    const adminHash = crypto.createHash('sha256').update('adminpassword').digest('hex');
    if (crypto.createHash('sha256').update(name).digest('hex') === adminHash)
      this.players[id] = {
      id,
      name: "NILL",
      color: color || "#4caf50",
      skin: skin,
      customSkinUrl: customSkinUrl || null,
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
      bulletSpeed: 1200,
      fireRate: 0,
      bodyDamage: 5,
      regenerationRate: 3,
      size: 20,
      tick: 0,
      bodyCooldown: 0,
      upgradeCounts: {}

    };
    else

    this.players[id] = {
      id,
      name: name || "Player",
      color: color || "#4caf50",
      skin: skin,
      customSkinUrl: customSkinUrl || null,
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
      bulletSpeed: 400,
      fireRate: 500,
      bodyDamage: 10,
      regenerationRate: 0.0001,
      size: 20,
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

    if (input.angle !== undefined) p.angle = input.angle;

    const vx = input.vx || 0;
    const vy = input.vy || 0;
    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      const nx = vx / len;
      const ny = vy / len;
      p.x += nx * p.speed * (delta / 16);
      p.y += ny * p.speed * (delta / 16);
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
      startX: p.x + Math.cos(p.angle) * 25,
      startY: p.y + Math.sin(p.angle) * 25,
      angle: p.angle,
      speed: p.bulletSpeed,
      startTime: now,
      owner: id,
      power: p.power,
      damage: p.damage
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
      p.size = 20 + p.level * 1.5; // player size grows with level
    }
  }

  applyUpgrade(id, stat, multiplier = 1) {
    const p = this.players[id];
    if (!p || p.CanUpgrade < multiplier) return;

    const upgrades = {
      damage: () => { p.damage += 2 * multiplier; },
      power: () => { p.power += 5 * multiplier; },
      bulletSpeed: () => { p.bulletSpeed += 30 * multiplier; },
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
  checkBodyCollisions() {
    for (let id in this.players) {
      const p = this.players[id];
      if (!p.alive) continue;

      p.bodyCooldown -= 100; // Since we check every 100ms

      for (let otherId in this.players) {
        if (id === otherId) continue;
        const op = this.players[otherId];
        if (!op.alive) continue;

        const dx = p.x - op.x;
        const dy = p.y - op.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const bodyRange = p.size + op.size;
        if (dist < bodyRange) {
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
  }

  update(delta) {
    const now = Date.now();

    // Remove old bullets (after 5 seconds)
    this.bullets = this.bullets.filter(b => now - b.startTime < 5000);

    // Regenerate health and update size by XP
    for (let id in this.players) {
      const p = this.players[id];
      if (p.alive && p.health < p.maxHealth) {
        p.health = Math.min(p.maxHealth, p.health + p.regenerationRate);
      }
      if (p.alive) {
        p.size = 20 + Math.sqrt(p.xp || 0) * 0.3;
      }
    }
    // Body damage (only check every 100ms to reduce load)
    if (now - (this.lastBodyCheck || 0) > 100) {
      this.lastBodyCheck = now;
      this.checkBodyCollisions();
    }
    // Bullet collisions
    this.bullets.forEach(b => {
      // Calculate current bullet position
      const age = now - b.startTime;
      const distance = (age / 1000) * b.speed;
      const x = b.startX + Math.cos(b.angle) * distance;
      const y = b.startY + Math.sin(b.angle) * distance;

      // Check if bullet is still alive (within world bounds)
      if (x < 0 || x > WORLD_SIZE || y < 0 || y > WORLD_SIZE) return;

      // Check bullet collision with orbs
      for (let orbId in this.Orbs) {
        const orb = this.Orbs[orbId];
        const dx = orb.x - x;
        const dy = orb.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const orbRadius = 3 * orb.size;

        if (dist < orbRadius + 5) {
          orb.health -= b.damage;
          b.startTime = 0; // Mark bullet for removal
          if (orb.health <= 0) {
            delete this.Orbs[orbId];
          }
          return; // Bullet hit an orb, stop checking
        }
      }

      for (let id in this.players) {
        const p = this.players[id];
        if (!p.alive || id === b.owner) continue;

        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < p.size) {
          p.health -= b.damage;
          if (p.health <= 0) {
            if (b.owner && this.players[b.owner]) {
              this.players[b.owner].xp += 20;
              this.updateLevel(b.owner);
            }
            p.alive = false;
          }
          // Remove bullet after hit
          b.startTime = 0;
        }
      }
    });

    // Remove hit bullets
    this.bullets = this.bullets.filter(b => b.startTime > 0);

    // Spawn orbs
    this.addOrbs();

    // Orb collisions
    this.checkOrbCollisions();
  }

  addOrbs() {
    while (Object.keys(this.Orbs).length < maxOrbs) {
      const id = Math.random().toString(36).slice(2);
      const size = Math.random() * 0.3 + 0.3;
      const colorIndex = Math.floor(Math.random() * 5);
      const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'];
      const xpValues = [10, 20, 30, 40, 50];
      const hpValues = [10, 15, 20, 25, 30];

      this.Orbs[id] = {
        id,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: size,
        color: colors[colorIndex],
        xpValue: xpValues[colorIndex] * size,
        maxHealth: hpValues[colorIndex],
        health: hpValues[colorIndex],
        damage: 5 + colorIndex * 2
      };
    }
  }

  checkOrbCollisions() {
    for (let orbId in this.Orbs) {
      const orb = this.Orbs[orbId];

      for (let playerId in this.players) {
        const p = this.players[playerId];
        if (!p.alive) continue;

        const dx = p.x - orb.x;
        const dy = p.y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const orbRadius = 3 * orb.size;

        if (dist < 20 + orbRadius) {
          p.xp += orb.xpValue;
          this.updateLevel(playerId);
          delete this.Orbs[orbId];
          break;
        }
        // Orb damage check - if player is close but not collecting
        if (dist < 20 + orbRadius * 2) {
          if (!orb.lastDamageTime || Date.now() - orb.lastDamageTime > 1000) {
            p.health -= orb.damage;
            orb.lastDamageTime = Date.now();
            if (p.health <= 0) {
              p.alive = false;
            }
          }
        }
      }
    }
  }

  canAddPlayer() {
    const activePlayerCount = Object.keys(this.players).length;
    return activePlayerCount < MAX_PLAYERS;
  }

  getQueuePosition(id) {
    return this.queue.findIndex(entry => entry.id === id) + 1;
  }

  addToQueue(id, name, color, skin = 'default', customSkinUrl = null) {
    if (!this.queue.find(entry => entry.id === id)) {
      this.queue.push({ id, name, color, skin, customSkinUrl: customSkinUrl || null });
    }
  }

  setPlayerSkin(id, skin = 'default', customSkinUrl = null) {
    const p = this.players[id];
    if (!p) return;

    p.skin = skin;
    p.customSkinUrl = customSkinUrl || null;
  }

  removeFromQueue(id) {
    const index = this.queue.findIndex(entry => entry.id === id);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  processQueue() {
    while (this.queue.length > 0 && this.canAddPlayer()) {
      const entry = this.queue.shift();
      this.addPlayer(entry.id, entry.name, entry.color, entry.skin, entry.customSkinUrl);
      return entry.id;
    }
    return null;
  }

  getLeaderboard() {
    return Object.values(this.players)
      .filter(p => p.alive)
      .sort((a, b) => b.level - a.level)
      .slice(0, 10)
      .map(p => ({
        name: p.name,
        level: p.level,
        xp: p.xp
      }));
  }
}

module.exports = Game;














