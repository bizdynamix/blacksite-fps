import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js';

export function createVector(x = 0, y = 0, z = 0) {
  return new THREE.Vector3(x, y, z);
}
