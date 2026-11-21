// ─────────────────────────────────────────────────────────────
// particles.js — tiny particle system for steam, water, smoke, sparks
//
// A fixed pool of small spheres is reused over and over:
// emit() wakes one up, update() moves it, fades it and grows it.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';

export function createParticles(scene, max = 260) {
  const geometry = new THREE.SphereGeometry(1, 8, 6);
  const pool = [];
  for (let i = 0; i < max; i++) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    material.userData.outlineParameters = { visible: false }; // no dark outline on particles
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, life: 0, maxLife: 1, vel: new THREE.Vector3(), size: 0.1, grow: 0, gravity: 0, opacity: 1 });
  }
  let next = 0;

  // Start one particle
  //   pos, vel: THREE.Vector3   color: hex   size: radius
  //   life: seconds   grow: how much bigger it gets   gravity: pull down
  function emit({ pos, vel, color, size = 0.15, life = 1, grow = 0.6, gravity = 0, opacity = 0.8 }) {
    const p = pool[next];
    next = (next + 1) % max;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.set(color);
    p.vel.copy(vel);
    Object.assign(p, { life, maxLife: life, size, grow, gravity, opacity });
  }

  // Call every frame
  function update(dt) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = p.life / p.maxLife; // 1 → 0 over its life
      p.mesh.scale.setScalar(p.size * (1 + p.grow * (1 - k)));
      p.mesh.material.opacity = p.opacity * k;
    }
  }

  return { emit, update };
}
