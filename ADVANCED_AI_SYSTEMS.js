// ====================================================
// BLACKSITE — Advanced AI & Tactical Systems
// Production-grade enemy behavior
// ====================================================

/**
 * INTELLIGENT ENEMY AI SYSTEM
 * 
 * Replace simple chase/strafe with tactical behaviors:
 * - Line of sight perception
 * - Cover-based positioning
 * - Squad coordination
 * - Flanking maneuvers
 * - Reload/suppression states
 * - Search patterns
 */

// src/ai/Enemy.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js';

export class Enemy {
  constructor(config) {
    const {
      position,
      scene,
      world,
      waveNumber = 1
    } = config;

    // Mesh
    this.mesh = this.createMesh();
    this.mesh.position.copy(position);
    scene.add(this.mesh);

    // State
    this.alive = true;
    this.maxHealth = 2 + waveNumber * 0.8;
    this.health = this.maxHealth;
    this.healthBar = this.createHealthBar();

    // AI
    this.brain = new AIBrain(this);
    this.perception = new Perception(this);
    this.movement = new Movement(this);
    this.weapon = new AIWeapon();

    // Squad
    this.squadId = null;
    this.squadMates = [];

    this.world = world;
    this.lastShotTime = 0;
    this.reloadTime = 0;
  }

  createMesh() {
    const group = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 1.1, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x2a1a1a,
        roughness: 0.9
      })
    );
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.38, 0.38),
      new THREE.MeshStandardMaterial({
        color: 0x3d2020,
        roughness: 0.8
      })
    );
    head.position.y = 1.64;
    head.castShadow = true;
    group.add(head);

    // Helmet
    const helm = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.2, 0.42),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.7,
        metalness: 0.3
      })
    );
    helm.position.y = 1.82;
    group.add(helm);

    // Legs
    [-0.15, 0.15].forEach(ox => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.7, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0x1a2010,
          roughness: 0.95
        })
      );
      leg.position.set(ox, 0.35, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    // Rifle in hands
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x111,
        metalness: 0.5,
        roughness: 0.5
      })
    );
    gun.position.set(0.34, 1.1, -0.28);
    group.add(gun);

    return group;
  }

  createHealthBar() {
    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.08),
      new THREE.MeshBasicMaterial({
        color: 0x00ff44,
        side: THREE.DoubleSide
      })
    );
    hpBar.position.y = 2.25;
    this.mesh.add(hpBar);
    return hpBar;
  }

  update(dt, playerPos, playerCamera) {
    if (!this.alive) return;

    // Update perception
    this.perception.update(playerPos, this.world);

    // Update AI brain
    this.brain.update(dt, playerPos, this.perception, this.world);

    // Movement
    this.movement.update(dt, this.brain.targetDirection, this.world);

    // Look at player
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

    // Update health bar
    this.healthBar.scale.x = Math.max(0, this.health / this.maxHealth);
    const healthRatio = this.health / this.maxHealth;
    this.healthBar.material.color.setHex(
      healthRatio > 0.5 ? 0x00ff44 : healthRatio > 0.2 ? 0xffcc44 : 0xff4444
    );

    // Shooting logic
    if (this.perception.canSeePlayer && this.weapon.canShoot()) {
      const distance = this.mesh.position.distanceTo(playerPos);
      const shootChance = Math.max(0.3, 1.0 - distance / 30);
      
      if (Math.random() < shootChance * dt) {
        this.shoot(playerPos);
      }
    }

    // Reload management
    if (this.weapon.needsReload()) {
      this.weapon.reload(dt);
    } else {
      this.weapon.update(dt);
    }
  }

  shoot(playerPos) {
    const direction = playerPos.clone().sub(this.mesh.position).normalize();
    
    // Add inaccuracy based on distance
    const distance = this.mesh.position.distanceTo(playerPos);
    const inaccuracy = 0.08 + (distance / 30) * 0.15;
    
    direction.x += (Math.random() - 0.5) * inaccuracy;
    direction.y += (Math.random() - 0.5) * inaccuracy * 0.5;
    direction.z += (Math.random() - 0.5) * inaccuracy;
    direction.normalize();

    this.weapon.fire(this.mesh.position, direction);
    this.lastShotTime = performance.now();

    // Emit bullet (handled by game)
    return {
      position: this.mesh.position.clone().setY(1.4),
      direction: direction,
      damage: 10
    };
  }

  takeDamage(damage) {
    this.health -= damage;
    if (this.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  die() {
    this.alive = false;
    // Death animation could go here
  }

  getPosition() {
    return this.mesh.position.clone();
  }
}


/**
 * AI PERCEPTION SYSTEM
 * 
 * Line of sight, hearing, memory
 */

export class Perception {
  constructor(enemy) {
    this.enemy = enemy;
    this.canSeePlayer = false;
    this.lastSeenPlayerPos = null;
    this.lastSeenTime = 0;
    this.memoryDuration = 5.0;  // Remember player position for 5 seconds
    
    // Hearing
    this.hearRadius = 30;
    this.lastHeardTime = 0;
  }

  update(playerPos, world) {
    // Check line of sight
    this.updateLineOfSight(playerPos, world);

    // Check if we can hear the player
    const distance = this.enemy.mesh.position.distanceTo(playerPos);
    if (distance < this.hearRadius) {
      this.lastHeardTime = Date.now();
    }

    // Fade out memory
    if (this.canSeePlayer) {
      this.lastSeenPlayerPos = playerPos.clone();
      this.lastSeenTime = Date.now();
    } else if (this.lastSeenPlayerPos) {
      const elapsed = (Date.now() - this.lastSeenTime) / 1000;
      if (elapsed > this.memoryDuration) {
        this.lastSeenPlayerPos = null;
      }
    }
  }

  updateLineOfSight(playerPos, world) {
    const enemyPos = this.enemy.mesh.position;
    const direction = playerPos.clone().sub(enemyPos);
    const distance = direction.length();

    // FOV check (180 degrees)
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.enemy.mesh.quaternion);
    const angleCos = direction.normalize().dot(forward);
    
    if (angleCos < -0.7) {  // ~135 degree FOV
      this.canSeePlayer = false;
      return;
    }

    // Raycast check (simplified - in production use THREE.Raycaster)
    // For now, assume line of sight if no major obstacles in path
    this.canSeePlayer = distance < 35;  // Vision range 35 units
  }

  hasMemoryOfPlayer() {
    return this.lastSeenPlayerPos !== null;
  }

  getLastSeenPosition() {
    return this.lastSeenPlayerPos ? this.lastSeenPlayerPos.clone() : null;
  }
}


/**
 * AI BRAIN
 * 
 * Decision-making and tactical planning
 */

export class AIBrain {
  constructor(enemy) {
    this.enemy = enemy;
    this.state = 'idle';
    this.stateTimer = 0;
    this.targetDirection = new THREE.Vector3();
  }

  update(dt, playerPos, perception, world) {
    this.stateTimer -= dt;

    // State machine
    if (this.stateTimer <= 0) {
      this.makeDecision(playerPos, perception, world);
    }

    // Execute current state
    this.executeState(dt, playerPos, perception, world);
  }

  makeDecision(playerPos, perception, world) {
    const distance = this.enemy.mesh.position.distanceTo(playerPos);

    if (perception.canSeePlayer) {
      // We can see the player - go aggressive
      if (distance < 6) {
        this.state = 'attack_close';
      } else if (distance < 15) {
        // Choose tactics: attack or flank
        if (this.hasCoverAdvantage(perception, world)) {
          this.state = 'suppress_fire';
        } else {
          this.state = 'flank';
        }
      } else {
        this.state = 'advance';
      }
    } else if (perception.hasMemoryOfPlayer()) {
      // Lost sight but remember last position
      this.state = 'search';
    } else {
      // No intel
      this.state = 'patrol';
    }

    this.stateTimer = 0.8 + Math.random() * 1.2;
  }

  executeState(dt, playerPos, perception, world) {
    const playerDir = playerPos.clone()
      .sub(this.enemy.mesh.position)
      .normalize();

    switch (this.state) {
      case 'attack_close':
        this.doAttackClose(playerDir);
        break;
      case 'suppress_fire':
        this.doSuppressFire(playerDir);
        break;
      case 'flank':
        this.doFlank(playerDir);
        break;
      case 'advance':
        this.doAdvance(playerDir);
        break;
      case 'search':
        this.doSearch(perception);
        break;
      case 'patrol':
        this.doPatrol();
        break;
      case 'idle':
        this.targetDirection.set(0, 0, 0);
        break;
    }
  }

  doAttackClose(direction) {
    // Rush the player while shooting
    this.targetDirection = direction.clone().normalize();
  }

  doSuppressFire(direction) {
    // Stay in place and shoot
    this.targetDirection.set(0, 0, 0);
    // Shooting handled in Enemy.update()
  }

  doFlank(direction) {
    // Circle around player
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
    const flanking = direction.clone()
      .addScaledVector(perpendicular, Math.sin(Date.now() * 0.003) * 0.5)
      .normalize();
    this.targetDirection = flanking;
  }

  doAdvance(direction) {
    // Walk toward player
    this.targetDirection = direction;
  }

  doSearch(perception) {
    // Move toward last known position
    if (perception.lastSeenPlayerPos) {
      const lastPos = perception.lastSeenPlayerPos;
      this.targetDirection = lastPos.clone()
        .sub(this.enemy.mesh.position)
        .normalize();
    } else {
      this.targetDirection.set(0, 0, 0);
    }
  }

  doPatrol() {
    // Wander around
    const wanderAngle = Date.now() * 0.0003;
    this.targetDirection.set(
      Math.sin(wanderAngle),
      0,
      Math.cos(wanderAngle)
    );
  }

  hasCoverAdvantage(perception, world) {
    // Simple implementation: check if enemy has nearby cover
    const radius = 5;
    const nearby = world.getObjectsInRadius(this.enemy.mesh.position, radius);
    return nearby.length > 0;
  }
}


/**
 * ENEMY MOVEMENT
 * 
 * Physics, collision, animation
 */

export class Movement {
  constructor(enemy) {
    this.enemy = enemy;
    this.velocity = new THREE.Vector3();
    this.speed = 1.9;
    this.legPhase = Math.random() * Math.PI * 2;
  }

  update(dt, targetDirection, world) {
    if (targetDirection.length() === 0) {
      // Idle - just animate in place
      this.animateLegs(dt);
      return;
    }

    // Move toward target
    const movement = targetDirection.clone()
      .multiplyScalar(this.speed * dt);

    // Collision resolution
    const newPos = this.enemy.mesh.position.clone().add(movement);
    if (!this.checkCollision(newPos, world)) {
      this.enemy.mesh.position.add(movement);
    }

    // Leg animation
    this.animateLegs(dt);
  }

  animateLegs(dt) {
    this.legPhase += dt * 8;

    const body = this.enemy.mesh.children[0];  // First child is body
    const legs = [
      this.enemy.mesh.children[3],
      this.enemy.mesh.children[4]
    ];

    legs.forEach((leg, i) => {
      if (leg) {
        const phase = this.legPhase + (i === 0 ? 0 : Math.PI);
        leg.rotation.x = Math.sin(phase) * 0.45;
      }
    });
  }

  checkCollision(newPos, world) {
    // Check if new position collides with world geometry
    const radius = 0.42;
    const checkBox = new THREE.Box3(
      new THREE.Vector3(
        newPos.x - radius,
        0,
        newPos.z - radius
      ),
      new THREE.Vector3(
        newPos.x + radius,
        2,
        newPos.z + radius
      )
    );

    return world.walls.some(wall => checkBox.intersectsBox(wall.box));
  }
}


/**
 * AI WEAPON SYSTEM
 * 
 * Simplified weapon for enemies
 */

export class AIWeapon {
  constructor() {
    this.fireRate = 600;  // RPM
    this.fireDelay = 60000 / this.fireRate;
    this.lastFireTime = 0;
    this.ammo = 30;
    this.maxAmmo = 30;
    this.reloadTime = 2.0;
    this.reloadProgress = 0;
  }

  canShoot() {
    return this.ammo > 0 && 
           (performance.now() - this.lastFireTime) > this.fireDelay;
  }

  fire(position, direction) {
    this.lastFireTime = performance.now();
    this.ammo--;
    return { position, direction };
  }

  needsReload() {
    return this.ammo <= 0;
  }

  reload(dt) {
    this.reloadProgress += dt;
    if (this.reloadProgress >= this.reloadTime) {
      this.ammo = this.maxAmmo;
      this.reloadProgress = 0;
    }
  }

  update(dt) {
    // Weapon behavior updates
  }
}


/**
 * SQUAD COORDINATION
 * 
 * Multiple enemies working together
 */

export class Squad {
  constructor(enemies) {
    this.enemies = enemies;
    this.id = Math.random();
    
    enemies.forEach(e => {
      e.squadId = this.id;
      e.squadMates = enemies.filter(x => x !== e);
    });
  }

  update(dt, playerPos, world) {
    // Coordinate behavior
    // Example: Suppress from multiple angles
    
    const positions = this.enemies.map(e => e.mesh.position);
    const avgPos = this.getAveragePosition(positions);
    
    // Spread out tactics
    this.enemies.forEach((enemy, i) => {
      const angle = (i / this.enemies.length) * Math.PI * 2;
      const offset = new THREE.Vector3(
        Math.cos(angle) * 5,
        0,
        Math.sin(angle) * 5
      );
      
      enemy.brain.squadTactic = 'spread';
    });
  }

  getAveragePosition(positions) {
    const avg = new THREE.Vector3();
    positions.forEach(p => avg.add(p));
    avg.divideScalar(positions.length);
    return avg;
  }
}


/**
 * USAGE IN YOUR GAME
 * ====================
 */

/*

// In your enemy manager:

import { Enemy } from './Enemy.js';
import { Squad } from './Squad.js';

class EnemyManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.enemies = [];
    this.squads = [];
  }

  spawnWave(waveNumber) {
    const enemyCount = 3 + waveNumber * 2;
    const squad = [];

    for (let i = 0; i < enemyCount; i++) {
      const angle = (i / enemyCount) * Math.PI * 2;
      const distance = 20 + Math.random() * 5;
      
      const enemy = new Enemy({
        position: new THREE.Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        ),
        scene: this.scene,
        world: this.world,
        waveNumber
      });

      this.enemies.push(enemy);
      squad.push(enemy);
    }

    // Group into squad for coordination
    if (squad.length > 0) {
      this.squads.push(new Squad(squad));
    }
  }

  update(dt, playerPos, playerCamera) {
    this.enemies.forEach(enemy => {
      enemy.update(dt, playerPos, playerCamera);
    });

    this.squads.forEach(squad => {
      squad.update(dt, playerPos, this.world);
    });

    // Remove dead enemies
    this.enemies = this.enemies.filter(e => {
      if (!e.alive) {
        this.scene.remove(e.mesh);
      }
      return e.alive;
    });
  }

  getEnemyBullets() {
    const bullets = [];
    this.enemies.forEach(enemy => {
      if (enemy.weapon.lastShotTime === performance.now()) {
        // Enemy just shot
        const bullet = enemy.shoot(this.playerPos);
        if (bullet) bullets.push(bullet);
      }
    });
    return bullets;
  }
}

*/
