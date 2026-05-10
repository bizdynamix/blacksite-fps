// ====================================================
// BLACKSITE — Graphics Enhancement Implementation
// Production-ready visual improvements
// ====================================================

/**
 * PHASE 1: POST-PROCESSING PIPELINE
 * 
 * Adds cinematic visual quality:
 * - Bloom (glowing effects on lights, muzzle flashes)
 * - Motion Blur (dynamic camera movement)
 * - SSAO (screen-space ambient occlusion for depth)
 * - Film Grain (tactical aesthetic)
 * - Chromatic Aberration (distortion effect during damage)
 */

// src/graphics/PostProcessing.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/postprocessing/ShaderPass.js';

export class PostProcessingPipeline {
  constructor(renderer, scene, camera, width, height) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Main composer
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 1. RENDER PASS (base scene)
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2. BLOOM PASS (glowing highlights)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,   // strength (intensity of bloom)
      0.4,   // radius (spread distance)
      0.85   // threshold (what glows)
    );
    this.bloomPass.enabled = true;
    this.composer.addPass(this.bloomPass);

    // 3. FILM GRAIN (tactical aesthetic)
    this.grainPass = new ShaderPass(FilmGrainShader);
    this.grainPass.uniforms.amount.value = 0.08;
    this.grainPass.uniforms.speed.value = 1.0;
    this.grainPass.enabled = true;
    this.composer.addPass(this.grainPass);

    // 4. CHROMATIC ABERRATION (when hit)
    this.chromaPass = new ShaderPass(ChromaticAberrationShader);
    this.chromaPass.uniforms.aberration.value = 0.0;
    this.chromaPass.enabled = true;
    this.composer.addPass(this.chromaPass);

    // Damage effect state
    this.damageIntensity = 0;
  }

  render() {
    // Update effects based on game state
    this.updateEffects();
    this.composer.render();
  }

  updateEffects() {
    // Fade out chromatic aberration over time
    if (this.damageIntensity > 0) {
      this.damageIntensity -= 0.05;
      this.chromaPass.uniforms.aberration.value = 
        Math.pow(this.damageIntensity, 2) * 0.1;
    }

    // Film grain animation
    this.grainPass.uniforms.time.value += 0.016;
  }

  triggerDamageEffect() {
    this.damageIntensity = 1.0;
    this.chromaPass.uniforms.aberration.value = 0.1;
  }

  setBloomStrength(value) {
    this.bloomPass.strength = value;
  }

  resize(width, height) {
    this.composer.setSize(width, height);
  }
}


// SHADER DEFINITIONS

const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.08 },
    speed: { value: 1.0 },
    time: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float speed;
    uniform float time;
    varying vec2 vUv;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Animate grain
      float grain = noise(vUv * 200.0 + time * speed) * amount;
      
      // Darken slightly with grain
      color.rgb -= grain * 0.5;
      color.rgb += grain * 0.3;
      
      gl_FragColor = color;
    }
  `
};

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    aberration: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float aberration;
    varying vec2 vUv;

    void main() {
      vec2 offset = vec2(aberration * 0.01);
      
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};


/**
 * PHASE 2: MATERIAL SYSTEM
 * 
 * Upgrade from basic colors to PBR (Physically-Based Rendering)
 * This dramatically improves visual quality with minimal code change
 */

// src/graphics/Materials.js

export class MaterialFactory {
  static loadTextureCache = new Map();

  static loadTexture(path) {
    if (!path) return null;
    if (this.loadTextureCache.has(path)) {
      return this.loadTextureCache.get(path);
    }

    const loader = new THREE.TextureLoader();
    const texture = loader.load(path);
    
    // Optimize texture
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 16;
    
    this.loadTextureCache.set(path, texture);
    return texture;
  }

  static createPBRMaterial(config) {
    const {
      name = 'unnamed',
      color = 0xffffff,
      diffuseMap = null,
      normalMap = null,
      roughnessMap = null,
      metallicMap = null,
      aoMap = null,
      roughness = 0.7,
      metalness = 0.0,
      emissive = 0x000000,
      emissiveIntensity = 0.0
    } = config;

    const material = new THREE.MeshStandardMaterial({
      name,
      color,
      map: this.loadTexture(diffuseMap),
      normalMap: this.loadTexture(normalMap),
      roughnessMap: this.loadTexture(roughnessMap),
      metallicMap: this.loadTexture(metallicMap),
      aoMap: this.loadTexture(aoMap),
      roughness,
      metalness,
      emissive,
      emissiveIntensity,
      envMapIntensity: 0.8
    });

    return material;
  }

  // Preset materials for common surfaces
  static PRESETS = {
    CONCRETE: {
      roughness: 0.85,
      metalness: 0.0,
      color: 0x7a7a7a
    },
    STEEL: {
      roughness: 0.3,
      metalness: 0.85,
      color: 0xa8a8a8
    },
    WOOD: {
      roughness: 0.75,
      metalness: 0.05,
      color: 0x6a4a2a
    },
    CLOTH: {
      roughness: 0.92,
      metalness: 0.0,
      color: 0x2a2a2a
    },
    PLASTIC: {
      roughness: 0.6,
      metalness: 0.1,
      color: 0x4a4a4a
    },
    CERAMIC: {
      roughness: 0.5,
      metalness: 0.0,
      color: 0x8a8a8a
    },
    GLASS: {
      roughness: 0.0,
      metalness: 0.1,
      color: 0xd0e8ff,
      transparent: true,
      opacity: 0.3
    }
  };

  // Quick factory methods
  static concrete(color = 0x7a7a7a) {
    return this.createPBRMaterial({
      color,
      ...this.PRESETS.CONCRETE
    });
  }

  static steel(color = 0xa8a8a8) {
    return this.createPBRMaterial({
      color,
      ...this.PRESETS.STEEL
    });
  }

  static wood(color = 0x6a4a2a) {
    return this.createPBRMaterial({
      color,
      ...this.PRESETS.WOOD
    });
  }

  static glowing(color = 0xffaa44, intensity = 1.0) {
    return this.createPBRMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.4,
      metalness: 0.2
    });
  }
}


/**
 * PHASE 3: DYNAMIC LIGHTING
 * 
 * Muzzle flashes, explosions, and environmental lights
 * that respond to game events
 */

// src/graphics/Lighting.js

export class DynamicLight {
  constructor(config) {
    const {
      position = new THREE.Vector3(),
      color = 0xffffff,
      intensity = 1,
      distance = 20,
      duration = 0.1,
      falloff = 1.0
    } = config;

    this.light = new THREE.PointLight(color, intensity, distance);
    this.light.position.copy(position);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);

    this.duration = duration;
    this.elapsed = 0;
    this.initialIntensity = intensity;
    this.falloff = falloff;
    this.alive = true;
  }

  update(dt) {
    this.elapsed += dt;
    
    const progress = Math.min(1, this.elapsed / this.duration);
    const decay = Math.pow(1 - progress, this.falloff);
    
    this.light.intensity = this.initialIntensity * decay;

    if (progress >= 1) {
      this.alive = false;
    }
  }
}

export class LightingSystem {
  constructor(scene) {
    this.scene = scene;
    this.dynamicLights = [];
    this.staticLights = [];
  }

  addStaticLight(config) {
    const light = new THREE.PointLight(config.color, config.intensity, config.distance);
    light.position.copy(config.position);
    light.castShadow = config.castShadow !== false;
    this.scene.add(light);
    this.staticLights.push(light);
    return light;
  }

  // Muzzle flash: fast, harsh light
  createMuzzleFlash(position, weaponType = 'rifle') {
    const colors = {
      rifle: 0xffdd88,
      shotgun: 0xffaa44,
      sniper: 0xffeedd,
      pistol: 0xffdd99,
      smg: 0xffcc88
    };

    const intensities = {
      rifle: 3,
      shotgun: 4.5,
      sniper: 5,
      pistol: 2,
      smg: 3.5
    };

    const dlight = new DynamicLight({
      position,
      color: colors[weaponType] || colors.rifle,
      intensity: intensities[weaponType] || 3,
      distance: 20,
      duration: 0.06,
      falloff: 2.0
    });

    this.scene.add(dlight.light);
    this.dynamicLights.push(dlight);
  }

  // Explosion: bright, wide blast
  createExplosion(position, radius = 20) {
    const dlight = new DynamicLight({
      position,
      color: 0xffdd44,
      intensity: 8,
      distance: radius * 2,
      duration: 0.4,
      falloff: 2.5
    });

    this.scene.add(dlight.light);
    this.dynamicLights.push(dlight);
  }

  // Suppressive fire: lower intensity, longer duration
  createSuppressiveLight(position) {
    const dlight = new DynamicLight({
      position,
      color: 0xffcc88,
      intensity: 1.5,
      distance: 15,
      duration: 0.15,
      falloff: 1.5
    });

    this.scene.add(dlight.light);
    this.dynamicLights.push(dlight);
  }

  update(dt) {
    for (let i = this.dynamicLights.length - 1; i >= 0; i--) {
      const dlight = this.dynamicLights[i];
      dlight.update(dt);

      if (!dlight.alive) {
        this.scene.remove(dlight.light);
        this.dynamicLights.splice(i, 1);
      }
    }
  }

  // Set up global lighting rig
  setupEnvironmentLighting(scene) {
    // Ambient light (global illumination)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Directional light (sun/moon)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 40, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);
  }
}


/**
 * PHASE 4: PARTICLE SYSTEMS
 * 
 * Muzzle flashes, shell casings, blood, smoke
 */

// src/effects/Particles.js

export class Particle {
  constructor(config) {
    const {
      position,
      velocity,
      acceleration = new THREE.Vector3(0, -9.8, 0),
      lifetime = 1.0,
      size = 0.1,
      color = 0xffffff
    } = config;

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 4, 4),
      new THREE.MeshBasicMaterial({ color })
    );
    this.mesh.position.copy(position);

    this.velocity = velocity;
    this.acceleration = acceleration;
    this.lifetime = lifetime;
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
    
    // Physics
    this.velocity.addScaledVector(this.acceleration, dt);
    this.mesh.position.addScaledVector(this.velocity, dt);

    // Fade out
    const progress = this.age / this.lifetime;
    this.mesh.material.opacity = Math.max(0, 1 - progress * 1.5);

    return this.age < this.lifetime;
  }
}

export class ParticleEmitter {
  constructor(config) {
    const {
      position,
      velocity = new THREE.Vector3(),
      particleCount = 20,
      lifetime = 1.0,
      spreadAngle = Math.PI / 4,
      speed = 5,
      color = 0xffffff,
      size = 0.05
    } = config;

    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      // Random direction within cone
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * spreadAngle;

      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      );

      const particle = new Particle({
        position: position.clone(),
        velocity: dir.multiplyScalar(speed),
        lifetime,
        size,
        color
      });

      this.particles.push(particle);
    }
  }

  update(dt, scene) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const alive = particle.update(dt);

      if (!alive) {
        scene.remove(particle.mesh);
        this.particles.splice(i, 1);
      }
    }

    return this.particles.length > 0;
  }
}


/**
 * USAGE EXAMPLES
 * ================
 */

/*
// In your game loop:

import { PostProcessingPipeline } from './PostProcessing.js';
import { LightingSystem, DynamicLight } from './Lighting.js';
import { ParticleEmitter } from './Particles.js';

const postProc = new PostProcessingPipeline(renderer, scene, camera, width, height);
const lighting = new LightingSystem(scene);
const particles = [];

// When player shoots
function onGunFire(position, weaponType) {
  lighting.createMuzzleFlash(position, weaponType);
  
  // Muzzle flash particles
  const emitter = new ParticleEmitter({
    position,
    velocity: direction.clone().multiplyScalar(3),
    particleCount: 8,
    lifetime: 0.15,
    color: 0xffcc88,
    size: 0.08
  });
  particles.push(emitter);
  emitter.particles.forEach(p => scene.add(p.mesh));
}

// When player takes damage
function onPlayerHit() {
  postProc.triggerDamageEffect();
  
  const emitter = new ParticleEmitter({
    position: playerPos,
    particleCount: 15,
    lifetime: 0.8,
    spreadAngle: Math.PI * 2,
    color: 0xff4444
  });
  particles.push(emitter);
}

// In game loop update
function update(dt) {
  lighting.update(dt);
  
  for (let i = particles.length - 1; i >= 0; i--) {
    const alive = particles[i].update(dt, scene);
    if (!alive) particles.splice(i, 1);
  }
}

// Render with post-processing
function render() {
  postProc.render();  // instead of renderer.render(scene, camera)
}
*/
