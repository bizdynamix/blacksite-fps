// ====================================================
// BLACKSITE — Quick-Start Refactoring Examples
// Ready-to-integrate implementations
// ====================================================

/**
 * FILE 1: src/core/Game.js
 * 
 * Main game orchestrator - bridges your existing code
 * into a modular structure. Minimal changes to existing logic.
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js';
import { World } from './World.js';
import { Player } from '../player/Player.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { EnemyManager } from '../ai/EnemyManager.js';
import { HUD } from '../ui/HUD.js';
import { InputManager } from './Input.js';

export class Game {
  constructor() {
    this.state = {
      running: false,
      paused: false,
      gameOver: false,
      wave: 1,
      kills: 0,
      time: 0
    };

    this.systems = {
      world: null,
      player: null,
      weapons: null,
      enemies: null,
      hud: null,
      input: null
    };

    this.deltaTime = 0;
    this.clock = new THREE.Clock();
  }

  async initialize() {
    console.log('🎮 Initializing BLACKSITE...');

    // 1. Setup renderer & scene
    this.systems.world = new World();

    // 2. Setup player
    this.systems.player = new Player(this.systems.world.camera);

    // 3. Setup weapons
    this.systems.weapons = new WeaponManager(
      this.systems.player,
      this.systems.world.scene
    );

    // 4. Setup enemies
    this.systems.enemies = new EnemyManager(this.systems.world.scene);

    // 5. Setup UI
    this.systems.hud = new HUD(this.state);

    // 6. Setup input
    this.systems.input = new InputManager(this);

    console.log('✓ BLACKSITE initialized');
  }

  start() {
    this.state.running = true;
    this.clock.start();
    this.systems.enemies.spawnWave(this.state.wave);
    this.gameLoop();
  }

  pause() {
    this.state.paused = !this.state.paused;
    if (this.state.paused) {
      document.exitPointerLock();
    } else {
      document.getElementById('canvas').requestPointerLock();
    }
  }

  gameLoop = () => {
    requestAnimationFrame(this.gameLoop);

    this.deltaTime = this.clock.getDelta();
    if (this.deltaTime > 0.05) this.deltaTime = 0.05; // Cap dt to 50ms

    if (this.state.running && !this.state.paused && !this.state.gameOver) {
      this.update(this.deltaTime);
    }

    this.render();
  };

  update(dt) {
    this.state.time += dt;

    // Update systems in order
    this.systems.player.update(dt, this.systems.input.getInputVector());
    this.systems.weapons.update(dt, this.systems.input.isMouseDown(0));
    this.systems.enemies.update(dt, this.systems.player.getPosition());
    
    // Collision checks
    this.checkProjectileCollisions();
    this.checkEnemyCollisions();

    // Wave logic
    this.updateWaveLogic(dt);

    // UI updates
    this.systems.hud.update(this.state, {
      playerHP: this.systems.player.health,
      playerArmor: this.systems.player.armor,
      ammo: this.systems.weapons.getCurrentWeapon()
    });
  }

  render() {
    this.systems.world.render();
  }

  checkProjectileCollisions() {
    // Player bullets vs enemies
    const bullets = this.systems.weapons.getActiveBullets();
    const enemies = this.systems.enemies.getAliveEnemies();

    bullets.forEach(bullet => {
      enemies.forEach(enemy => {
        if (bullet.mesh.position.distanceTo(enemy.mesh.position) < 0.3) {
          enemy.takeDamage(bullet.damage);
          this.systems.weapons.removeBullet(bullet);
          
          if (enemy.isDead()) {
            this.systems.enemies.removeEnemy(enemy);
            this.state.kills++;
            this.systems.hud.addKillFeed();
          }
        }
      });
    });

    // Enemy bullets vs player
    const eBullets = this.systems.enemies.getEnemyBullets();
    eBullets.forEach(bullet => {
      if (bullet.mesh.position.distanceTo(this.systems.player.camera.position) < 0.3) {
        this.systems.player.takeDamage(10);
        this.systems.enemies.removeEnemyBullet(bullet);
      }
    });
  }

  updateWaveLogic(dt) {
    const aliveEnemies = this.systems.enemies.getAliveEnemies();
    
    if (aliveEnemies.length === 0 && this.systems.enemies.spawnedCount > 0) {
      this.state.wave++;
      this.systems.hud.showWaveNotification(this.state.wave);
      this.systems.enemies.spawnWave(this.state.wave);
    }
  }
}

export default Game;


/**
 * FILE 2: src/core/Input.js
 * 
 * Centralized input handling
 */

export class InputManager {
  constructor(game) {
    this.game = game;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: [false, false, false] };
    this.sensitivity = {
      normal: 0.0018,
      ads: 0.0009,
      sniper: 0.00038
    };

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Quick actions
      if (e.code === 'Escape') this.game.pause();
      if (e.code === 'KeyR') this.game.systems.weapons.reload();
      if (e.code === 'KeyQ') this.game.systems.player.leanLeft();
      if (e.code === 'KeyE') this.game.systems.player.leanRight();
      if (e.code === 'Space') this.game.systems.player.jump();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.game.systems.player.setSprinting(true);
      }

      // Weapon switching
      if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        const idx = parseInt(e.code[5]) - 1;
        this.game.systems.weapons.switchWeapon(idx);
      }

      e.preventDefault();
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.game.systems.player.setSprinting(false);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!document.pointerLockElement) return;

      const weaponSens = this.game.systems.weapons.getCurrentWeapon().adsFov 
        ? this.sensitivity.ads 
        : this.sensitivity.normal;

      this.game.systems.player.rotate(
        e.movementX * weaponSens,
        e.movementY * weaponSens
      );
    });

    document.addEventListener('mousedown', (e) => {
      this.mouse.down[e.button] = true;

      if (e.button === 0) { // Left click: shoot
        this.game.systems.weapons.startShooting();
      }
      if (e.button === 2) { // Right click: ADS
        this.game.systems.weapons.adsIn();
      }
    });

    document.addEventListener('mouseup', (e) => {
      this.mouse.down[e.button] = false;

      if (e.button === 0) {
        this.game.systems.weapons.stopShooting();
      }
      if (e.button === 2) {
        this.game.systems.weapons.adsOut();
      }
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('wheel', (e) => {
      const nextWeapon = this.game.systems.weapons.currentWeapon + 
        (e.deltaY > 0 ? 1 : -1);
      this.game.systems.weapons.switchWeapon(nextWeapon);
    });
  }

  getInputVector() {
    const vector = { x: 0, z: 0 };
    if (this.keys['KeyW']) vector.z -= 1;
    if (this.keys['KeyS']) vector.z += 1;
    if (this.keys['KeyA']) vector.x -= 1;
    if (this.keys['KeyD']) vector.x += 1;
    return vector;
  }

  isMouseDown(button) {
    return this.mouse.down[button];
  }

  isKeyPressed(code) {
    return this.keys[code];
  }
}


/**
 * FILE 3: src/weapons/Weapon.js
 * 
 * Base weapon class for all weapons
 */

export class Weapon {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type; // 'rifle', 'shotgun', 'sniper', 'pistol', 'smg'
    
    // Magazine system
    this.magSize = config.mag;
    this.reserveAmmo = config.res;
    this.currentAmmo = config.mag;
    
    // Damage
    this.damage = config.dmg;
    this.penetration = config.penetration || 0; // How far through walls
    
    // Ballistics
    this.fireRate = config.rpm;
    this.fireDelay = 60 / config.rpm;
    this.spread = config.spread;
    this.spreadADS = config.adsSpr;
    this.pellets = config.pellets || 1;
    
    // Reload
    this.reloadTime = config.reload;
    this.reloading = false;
    this.reloadProgress = 0;
    
    // Aiming
    this.adsFov = config.adsFov;
    this.adsSpread = config.adsSpr;
    this.isADS = false;
    
    // Mechanics
    this.lastShotTime = 0;
    this.bulletSpeed = config.bSpeed;
  }

  canShoot() {
    return !this.reloading && 
           this.currentAmmo > 0 && 
           (Date.now() - this.lastShotTime) > this.fireDelay;
  }

  shoot() {
    if (!this.canShoot()) return null;

    this.lastShotTime = Date.now();
    this.currentAmmo--;

    if (this.currentAmmo === 0 && this.reserveAmmo > 0) {
      this.startReload();
    }

    return {
      damage: this.damage,
      spread: this.isADS ? this.spreadADS : this.spread,
      pellets: this.pellets,
      bulletSpeed: this.bulletSpeed
    };
  }

  reload() {
    if (this.reloading || this.currentAmmo >= this.magSize) return;
    if (this.reserveAmmo <= 0) return;

    this.reloading = true;
    this.reloadProgress = 0;
  }

  startReload() {
    this.reloading = true;
  }

  updateReload(dt) {
    if (!this.reloading) return;

    this.reloadProgress += dt / this.reloadTime;

    if (this.reloadProgress >= 1) {
      // Transfer ammo
      const needed = this.magSize - this.currentAmmo;
      const transferred = Math.min(needed, this.reserveAmmo);
      
      this.currentAmmo += transferred;
      this.reserveAmmo -= transferred;
      this.reloading = false;
      this.reloadProgress = 0;
    }
  }

  setADS(active) {
    this.isADS = active;
  }

  getAmmoString() {
    return `${this.currentAmmo} / ${this.reserveAmmo}`;
  }
}


/**
 * FILE 4: src/player/Player.js
 * 
 * Player entity
 */

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 75;
    this.maxArmor = 100;

    this.velocity = new THREE.Vector3();
    this.onGround = true;
    
    this.controls = {
      yaw: 0,
      pitch: 0,
      lean: 0,
      sprint: false
    };

    this.speeds = {
      walk: 5.5,
      sprint: 9.5,
      jump: 7,
      gravity: -18
    };
  }

  update(dt, inputVector) {
    // Movement
    const speed = this.controls.sprint ? this.speeds.sprint : this.speeds.walk;
    const forward = new THREE.Vector3(-Math.sin(this.controls.yaw), 0, -Math.cos(this.controls.yaw));
    const right = new THREE.Vector3(Math.cos(this.controls.yaw), 0, -Math.sin(this.controls.yaw));

    let movement = new THREE.Vector3();
    if (inputVector.z < 0) movement.addScaledVector(forward, speed * dt);
    if (inputVector.z > 0) movement.addScaledVector(forward, -speed * 0.7 * dt);
    if (inputVector.x < 0) movement.addScaledVector(right, -speed * 0.8 * dt);
    if (inputVector.x > 0) movement.addScaledVector(right, speed * 0.8 * dt);

    this.camera.position.add(movement);

    // Gravity
    this.velocity.y += this.speeds.gravity * dt;
    this.camera.position.y += this.velocity.y * dt;
    
    if (this.camera.position.y <= 1.75) {
      this.camera.position.y = 1.75;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Update rotation
    this.camera.rotation.set(this.controls.pitch, this.controls.yaw, this.controls.lean * 0.3, 'YXZ');
  }

  rotate(yawDelta, pitchDelta) {
    this.controls.yaw -= yawDelta;
    this.controls.pitch = Math.max(-1.35, Math.min(1.35, this.controls.pitch - pitchDelta));
  }

  jump() {
    if (!this.onGround) return;
    this.velocity.y = this.speeds.jump;
    this.onGround = false;
  }

  setSprinting(active) {
    this.controls.sprint = active;
  }

  leanLeft() {
    this.controls.lean = Math.max(-1, this.controls.lean - 0.1);
  }

  leanRight() {
    this.controls.lean = Math.min(1, this.controls.lean + 0.1);
  }

  takeDamage(damage) {
    let actualDamage = damage;

    // Armor mitigation
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, damage * 0.6);
      this.armor -= absorbed;
      actualDamage -= absorbed;
    }

    this.health -= actualDamage;
    if (this.health < 0) this.health = 0;

    return this.health <= 0;
  }

  getPosition() {
    return this.camera.position.clone();
  }
}


/**
 * FILE 5: weapons/weapons.json
 * 
 * Data-driven weapon definitions
 */

{
  "weapons": [
    {
      "id": 0,
      "name": "M4A1 CARBINE",
      "type": "rifle",
      "mag": 30,
      "res": 120,
      "dmg": 25,
      "rpm": 600,
      "reload": 2.0,
      "spread": 0.012,
      "adsSpr": 0.003,
      "pellets": 1,
      "adsFov": 55,
      "bSpeed": 45,
      "penetration": 0.8
    },
    {
      "id": 1,
      "name": "M870 SHOTGUN",
      "type": "shotgun",
      "mag": 8,
      "res": 32,
      "dmg": 18,
      "rpm": 85,
      "reload": 2.8,
      "spread": 0.06,
      "adsSpr": 0.04,
      "pellets": 8,
      "adsFov": 65,
      "bSpeed": 35,
      "penetration": 0.3
    },
    {
      "id": 2,
      "name": "AWM SNIPER",
      "type": "sniper",
      "mag": 5,
      "res": 20,
      "dmg": 120,
      "rpm": 50,
      "reload": 3.5,
      "spread": 0.001,
      "adsSpr": 0.0002,
      "pellets": 1,
      "adsFov": 22,
      "bSpeed": 85,
      "penetration": 1.0
    }
  ]
}


// ====================================================
// IMPLEMENTATION NOTES
// ====================================================

/*
 * To use these modules in your existing project:
 * 
 * 1. Create folder structure:
 *    - src/core/
 *    - src/player/
 *    - src/weapons/
 *    - src/ai/
 *    - src/ui/
 *    - assets/data/
 * 
 * 2. Copy this code into separate files
 * 
 * 3. Create a simple wrapper HTML:
 * 
 *    <!DOCTYPE html>
 *    <html>
 *    <head>
 *      <style>
 *        body { margin: 0; overflow: hidden; }
 *        canvas { display: block; }
 *      </style>
 *    </head>
 *    <body>
 *      <canvas id="canvas"></canvas>
 *      <div id="hud"></div>
 *      <script type="module">
 *        import Game from './src/core/Game.js';
 *        
 *        const game = new Game();
 *        game.initialize().then(() => {
 *          document.getElementById('canvas')
 *            .requestPointerLock = document.getElementById('canvas')
 *            .requestPointerLock ||
 *            document.getElementById('canvas').mozRequestPointerLock;
 *          game.start();
 *        });
 *      </script>
 *    </body>
 *    </html>
 * 
 * 4. Keep your existing HUD, UI, and map code
 *    - It integrates cleanly with the new architecture
 *    - Gradually migrate piece by piece
 * 
 * 5. This is NOT a breaking rewrite - it's evolutionary refactoring
 *    - Your current game loop still works
 *    - These modules enhance/organize existing code
 *    - You can integrate one module at a time
 */
