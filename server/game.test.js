const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('./game');

test('new players start with sane default stats', () => {
  const game = new Game();
  game.addPlayer('p1', 'Alice', '#12AB34', 'default');

  const player = game.players.p1;
  assert.equal(player.name, 'Alice');
  assert.equal(player.color, '#12AB34');
  assert.equal(player.bulletSpeed, 400);
  assert.equal(player.fireRate, 500);
  assert.equal(player.health, 100);
});

test('invalid names and colors are normalized', () => {
  const game = new Game();
  game.addPlayer('p2', '', 'invalid');

  const player = game.players.p2;
  assert.equal(player.name, 'Player');
  assert.equal(player.color, '#4caf50');
});

test('respawning restores a functional weapon state', () => {
  const game = new Game();
  game.addPlayer('p3', 'Bob', '#00FF00', 'default');
  game.players.p3.bulletSpeed = 3;
  game.players.p3.health = 0;
  game.players.p3.alive = false;

  game.respawnPlayer('p3');

  const player = game.players.p3;
  assert.equal(player.alive, true);
  assert.equal(player.bulletSpeed, 400);
  assert.equal(player.health, 100);
  assert.equal(player.maxHealth, 100);
});
