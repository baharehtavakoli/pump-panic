// ─────────────────────────────────────────────────────────────
// scene.js — the 3D night-shift pump station
//
// Two halls of 3 pumps (Hall A in front, Hall B behind), a storage
// tank, cooling tower, control room and pipes. Hall B starts offline
// and powers on during the shift.
//
// Each frame, updatePumps() makes every pump LOOK like its state:
// color for danger, steam for heat, swelling for pressure, black smoke
// for a clog, a flashing beacon, shaking when critical, charred when
// exploded. Danger colors (amber/red) are used ONLY for trouble.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { createParticles } from './particles.js';
import { buildDecor, skyTexture } from './decor.js';

const COLORS = {
  sky: 0x0e1726,
  ground: 0x1a2433,
  slab: 0x34435a,
  slabB: 0x2e3b50,
  steel: 0x9aaec6, // healthy pump body
  offline: 0x3a4250, // pump not powered yet
  amber: 0xf59e0b, // warning
  red: 0xdc2626, // critical
  char: 0x2b2b2e, // exploded
  motor: 0x2c5d8f,
  dark: 0x2a313b,
  pipe: 0x4f8fd0,
  pipeIn: 0x7fb3d5,
  concrete: 0x96a4b6,
  window: 0x9fd3ff,
  beaconIdle: 0x5b6b7f,
};

// Where the pumps stand: Hall A (front row) then Hall B (back row)
export const PUMP_POS = [
  [-3.6, 1], [0, 1], [3.6, 1],
  [-3.6, -3.4], [0, -3.4], [3.6, -3.4],
];

// Cartoon ("toon") shading: light falls in 3 flat bands instead of a smooth
// gradient. Together with the dark outlines this gives the chunky game look.
const TOON = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
TOON.minFilter = TOON.magFilter = THREE.NearestFilter;
TOON.needsUpdate = true;
const toon = (color, opts = {}) => new THREE.MeshToonMaterial({ color, gradientMap: TOON, ...opts });
// Things that should NOT get a dark outline (ground, glow, particles…)
const noOutline = (material) => ((material.userData.outlineParameters = { visible: false }), material);

// Soft dark "contact shadow" under pumps and tanks, so they sit on the floor
const BLOB = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function contactShadow(size) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    noOutline(new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false }))
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

// ── Small builders ───────────────────────────────────────────

function mesh(geometry, color, opts = {}) {
  const m = new THREE.Mesh(geometry, toon(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function pipe(scene, points, r = 0.16, color = COLORS.pipe) {
  const v = points.map((p) => new THREE.Vector3(...p));
  for (let i = 0; i < v.length - 1; i++) {
    const seg = mesh(new THREE.CylinderGeometry(r, r, v[i].distanceTo(v[i + 1]), 16), color);
    seg.position.copy(v[i]).lerp(v[i + 1], 0.5);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v[i + 1].clone().sub(v[i]).normalize());
    scene.add(seg);
  }
  for (const p of v) {
    const joint = mesh(new THREE.SphereGeometry(r * 1.15, 16, 10), color);
    joint.position.copy(p);
    scene.add(joint);
  }
}

function buildPump(index) {
  const [x, z] = PUMP_POS[index];
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const base = mesh(new THREE.BoxGeometry(2, 0.3, 2), COLORS.dark);
  base.position.y = 0.15;

  const bodyMat = toon(COLORS.steel);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.7, 36), bodyMat);
  body.position.y = 1.15;
  body.castShadow = true;

  // Pressure relief valve on the side (where steam vents)
  const valve = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10), COLORS.dark);
  valve.position.set(0.9, 1.7, 0);
  valve.rotation.z = Math.PI / 2;
  const wheel = mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 18), COLORS.concrete);
  wheel.position.set(1.15, 1.7, 0);
  wheel.rotation.y = Math.PI / 2;

  // The "top" (motor + cap + beacon) is one piece, so it can fly off in an explosion
  const top = new THREE.Group();
  top.position.y = 2.6;
  const motor = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 32), COLORS.motor);
  motor.position.y = -0.15;
  const cap = mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.14, 32), COLORS.dark);
  cap.position.y = 0.37;
  // Warning beacon: flashes amber/red when the pump is in trouble
  const beaconMat = toon(COLORS.beaconIdle);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.24, 16), beaconMat);
  beacon.position.y = 0.56;
  top.add(motor, cap, beacon);

  // Ring on the floor when you are working on this pump
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.05, 8, 48),
    noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }))
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  ring.visible = false;

  const blob = contactShadow(3.4);
  blob.position.y = 0.105;

  group.add(blob, base, body, valve, wheel, top, ring);

  // Every mesh knows which pump it belongs to (for tapping)
  group.traverse((c) => {
    if (c.isMesh) c.userData.pumpIndex = index;
  });

  // Floating badge above the pump (needed tool + danger bar), HTML
  const badgeEl = document.createElement('div');
  badgeEl.className = 'badge';
  const badge = new CSS2DObject(badgeEl);
  badge.position.set(0, 3.7, 0);
  badge.center.set(0.5, 1);
  badge.visible = false;
  group.add(badge);

  return {
    group, body, bodyMat, top, beaconMat, ring, badge, badgeEl,
    base: new THREE.Vector3(x, 0, z), jolt: 0, bounce: 0, powerFlash: 0,
  };
}

function buildWorld(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), noOutline(toon(COLORS.ground)));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Floors of the two halls
  const slabA = mesh(new THREE.BoxGeometry(12.5, 0.1, 4.2), COLORS.slab);
  slabA.position.set(0, 0.05, 1);
  const slabB = mesh(new THREE.BoxGeometry(12.5, 0.1, 4.2), COLORS.slabB);
  slabB.position.set(0, 0.05, -3.4);
  scene.add(slabA, slabB);

  // Storage tank
  const tank = mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.4, 40), COLORS.concrete);
  tank.position.set(0, 2.2, -8.6);
  const band = mesh(new THREE.CylinderGeometry(2.23, 2.23, 0.3, 40), COLORS.motor);
  band.position.set(0, 3.6, -8.6);
  const tankBlob = contactShadow(6.4);
  tankBlob.position.set(0, 0.02, -8.6);
  scene.add(tank, band, tankBlob);

  // Cooling tower (curved shape made by spinning a profile)
  const profile = [];
  for (let i = 0; i <= 12; i++) {
    const y = (i / 12) * 5.5;
    profile.push(new THREE.Vector2(1.6 + 1.2 * ((y - 3.5) / 3.5) ** 2, y));
  }
  const tower = mesh(new THREE.LatheGeometry(profile, 40), COLORS.concrete, { side: THREE.DoubleSide });
  tower.position.set(-9, 0, -8);
  scene.add(tower);

  // Control room with glowing windows
  const room = mesh(new THREE.BoxGeometry(4, 3, 3), 0x3a4656);
  room.position.set(9, 1.5, -7);
  scene.add(room);
  for (const x of [8.1, 9.9]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), noOutline(new THREE.MeshBasicMaterial({ color: COLORS.window })));
    win.position.set(x, 1.9, -5.49);
    scene.add(win);
  }

  // Pipes. Hall A: outlets → header → (between pumps) → Hall B header → tank
  for (const [x] of PUMP_POS.slice(0, 3)) pipe(scene, [[x, 1.1, 0.25], [x, 1.1, -0.6]]);
  pipe(scene, [[-3.6, 1.1, -0.6], [3.6, 1.1, -0.6]]);
  pipe(scene, [[1.8, 1.1, -0.6], [1.8, 1.1, -5.2]]);
  for (const [x] of PUMP_POS.slice(3)) pipe(scene, [[x, 1.1, -4.15], [x, 1.1, -5.2]]);
  pipe(scene, [[-3.6, 1.1, -5.2], [3.6, 1.1, -5.2]]);
  pipe(scene, [[0, 1.1, -5.2], [0, 1.1, -6.5]]);
  // Suction line in front (light blue = water coming in)
  for (const [x] of PUMP_POS.slice(0, 3)) pipe(scene, [[x, 0.7, 1.75], [x, 0.7, 3.2]], 0.13, COLORS.pipeIn);
  pipe(scene, [[-6, 0.7, 3.2], [3.6, 0.7, 3.2]], 0.13, COLORS.pipeIn);
}

// ── Main ─────────────────────────────────────────────────────

export function createWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Draws a dark outline around every object (same thickness on screen
  // for big and small objects), like the stroke on the UI.
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0055, defaultColor: [0.043, 0.071, 0.125], defaultAlpha: 1 });

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = skyTexture(); // darker at the top, lighter at the horizon
  scene.fog = new THREE.Fog(0x15243b, 28, 62);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const target = new THREE.Vector3(0, 1, -1.4);

  // Night lighting: cool moonlight + soft fill, plus a flash for explosions
  // Moonlight comes from the left side, so shadows fall to the right
  // and forward, where the camera can see them. Less fill light = more contrast.
  scene.add(new THREE.HemisphereLight(0xaec4e6, 0x1d2a40, 1.5));
  const moon = new THREE.DirectionalLight(0xdbe8ff, 3.6);
  moon.position.set(-12, 16, 5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.03;
  Object.assign(moon.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
  scene.add(moon);
  const flash = new THREE.PointLight(0xffb15c, 0, 18, 1.5);
  scene.add(flash);

  buildWorld(scene);
  buildDecor(scene, { toon, noOutline }); // sky, skyline, fence, props, light poles
  const pumps = PUMP_POS.map((_, i) => {
    const p = buildPump(i);
    scene.add(p.group);
    return p;
  });
  const pickables = [];
  pumps.forEach((p) => p.group.traverse((c) => c.isMesh && pickables.push(c)));

  // "HALL B · OFFLINE / ONLINE" sign next to the back row
  const signEl = document.createElement('div');
  signEl.className = 'hall-sign';
  const sign = new CSS2DObject(signEl);
  sign.position.set(-7.6, 0.3, -3.4); // left of the back row, clear of the pump badges
  scene.add(sign);
  function setHallB(online) {
    signEl.className = `hall-sign ${online ? 'on' : ''}`;
    signEl.textContent = online ? 'HALL B · ONLINE' : 'HALL B · OFFLINE';
  }
  setHallB(false);

  const particles = createParticles(scene, 320);
  const flying = []; // pump tops blown off by explosions
  let shake = 0; // camera shake strength

  // Frame both halls on any screen shape (portrait phones need more distance)
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const portrait = camera.aspect < 1;
    const halfWidth = portrait ? 5.9 : 7; // world units that must fit left↔right
    // On phones, look a bit lower so the pumps sit higher (room for the buttons below)
    target.y = portrait ? -0.25 : 1;
    // Wide screens: step back a bit more so the whole station (and the tank) fits under the HUD
    const minDist = portrait ? 14 : 18;
    const dist = Math.max(minDist, halfWidth / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    const dir = new THREE.Vector3(0, 0.7, 0.72).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // Which pump was tapped? (index or null)
  const raycaster = new THREE.Raycaster();
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.pumpIndex : null;
  }

  // ── Effects the game triggers ──────────────────────────────

  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // A point relative to pump i's base
  const at = (i, dx, y, dz) => v(pumps[i].base.x + dx, y, pumps[i].base.z + dz);

  // Water spray falling on a pump (call every frame while COOL is held)
  function spray(i) {
    for (let k = 0; k < 3; k++) {
      particles.emit({
        pos: at(i, rnd(-0.6, 0.6), 4.2, rnd(-0.6, 0.6)),
        vel: v(rnd(-0.3, 0.3), -3, rnd(-0.3, 0.3)),
        color: 0x6ec3ff, size: 0.07, life: 0.6, grow: 0, gravity: 8, opacity: 0.9,
      });
    }
  }

  // Big steam burst from the relief valve
  function vent(i) {
    for (let k = 0; k < 30; k++) {
      particles.emit({
        pos: at(i, 1.2, 1.7, 0),
        vel: v(rnd(2, 4), rnd(0.5, 2.5), rnd(-1, 1)),
        color: 0xf1f5f9, size: 0.12, life: rnd(0.6, 1.1), grow: 2.5, opacity: 0.7,
      });
    }
  }

  // Wrench hit: sparks + a little jolt
  function hit(i) {
    pumps[i].jolt = 1;
    for (let k = 0; k < 10; k++) {
      particles.emit({
        pos: at(i, rnd(-0.5, 0.5), rnd(1, 2), 0.8),
        vel: v(rnd(-2, 2), rnd(1, 3), rnd(0.5, 2)),
        color: 0xdbeafe, size: 0.04, life: 0.35, grow: 0, gravity: 9, opacity: 1,
      });
    }
  }

  // Cartoon explosion: top flies off, puff cloud, debris, flash, camera shake
  function explode(i) {
    const p = pumps[i];
    const world = p.top.getWorldPosition(new THREE.Vector3());
    p.group.remove(p.top);
    scene.add(p.top);
    p.top.position.copy(world);
    flying.push({ obj: p.top, vel: v(rnd(-2.5, 2.5), 10, rnd(0, 2)), spin: v(rnd(-6, 6), rnd(-4, 4), rnd(-6, 6)), life: 2.2 });

    for (let k = 0; k < 36; k++) {
      particles.emit({
        pos: at(i, rnd(-0.4, 0.4), rnd(1, 2.6), rnd(-0.4, 0.4)),
        vel: v(rnd(-3, 3), rnd(1, 5), rnd(-3, 3)),
        color: k % 3 ? 0x6b7280 : 0xffb15c, size: rnd(0.2, 0.4), life: rnd(0.8, 1.6), grow: 2, opacity: 0.85,
      });
    }
    // Debris: small dark bits that fall back down
    for (let k = 0; k < 14; k++) {
      particles.emit({
        pos: at(i, 0, 2.2, 0),
        vel: v(rnd(-5, 5), rnd(4, 9), rnd(-5, 5)),
        color: 0x1f2937, size: rnd(0.06, 0.12), life: 1.3, grow: 0, gravity: 16, opacity: 1,
      });
    }
    flash.position.copy(at(i, 0, 2.5, 1));
    flash.intensity = 60;
    shake = 0.5;
  }

  // Pump back in service after repair
  function restore(i) {
    const p = pumps[i];
    for (const f of flying) if (f.obj === p.top) f.life = 0; // stop it mid-flight
    scene.remove(p.top);
    p.group.add(p.top);
    p.top.position.set(0, 2.6, 0);
    p.top.rotation.set(0, 0, 0);
    p.top.visible = true;
  }

  // Hall B powering up: a white flash on the pump + sparkles
  function powerOn(i) {
    pumps[i].powerFlash = 1;
    for (let k = 0; k < 16; k++) {
      particles.emit({
        pos: at(i, rnd(-0.8, 0.8), rnd(0.5, 3), rnd(-0.8, 0.8)),
        vel: v(0, rnd(1, 2.5), 0),
        color: 0x9fd3ff, size: 0.06, life: 0.9, grow: 0, opacity: 1,
      });
    }
  }

  // "Saved!" effect: sparkle burst + squash-and-stretch bounce
  function celebrate(i) {
    pumps[i].bounce = 1;
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2;
      particles.emit({
        pos: at(i, 0, 2.2, 0),
        vel: v(Math.cos(a) * rnd(2, 4), rnd(2.5, 5.5), Math.sin(a) * rnd(2, 4)),
        color: k % 2 ? 0x6ee07f : 0xffffff, size: 0.08, life: 0.75, grow: 0, gravity: 7, opacity: 1,
      });
    }
  }

  // Floating text above a pump ("+150", "BOOM!") that rises and fades
  function popup(i, html, kind = 'good') {
    const el = document.createElement('div');
    el.className = `pop pop--${kind}`;
    el.innerHTML = `<span>${html}</span>`;
    const label = new CSS2DObject(el);
    label.position.set(0, 4.8, 0);
    label.center.set(0.5, 1);
    pumps[i].group.add(label);
    setTimeout(() => pumps[i].group.remove(label), 1100);
  }

  function select(i) {
    pumps.forEach((p, k) => (p.ring.visible = k === i));
  }

  // A wide picture of the station right now (smoke, debris and all),
  // used as the background of the result card. 1200×627 = LinkedIn size.
  function snapshot(w = 1200, h = 627) {
    const prevSize = renderer.getSize(new THREE.Vector2());
    const prevRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false); // temporarily, the player never sees it

    // A landscape camera, a bit lower and closer for drama. It looks above the
    // station so the pumps sit in the lower part (the text goes on top).
    const cam = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
    cam.position.set(0, 7.2, 12.5);
    cam.lookAt(0, 2.6, -1.6);
    outline.render(scene, cam);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h); // copy before anything else draws

    renderer.setPixelRatio(prevRatio);
    renderer.setSize(prevSize.x, prevSize.y, false);
    return canvas;
  }

  // ── Per-frame look of each pump ────────────────────────────
  //   states[i] = { online, trouble, danger (0–100), working, broken (seconds left) }

  const steel = new THREE.Color(COLORS.steel);
  const amber = new THREE.Color(COLORS.amber);
  const red = new THREE.Color(COLORS.red);
  const tmp = new THREE.Color();

  function updatePumps(states, t, dt) {
    states.forEach((s, i) => {
      const p = pumps[i];
      const d = s.danger / 100; // 0 → 1
      p.group.position.copy(p.base);
      p.group.rotation.z = 0;
      p.body.scale.set(1, 1, 1);
      p.bodyMat.emissive.setHex(0x000000);
      p.beaconMat.color.setHex(COLORS.beaconIdle);
      p.beaconMat.emissive.setHex(0x000000);

      if (s.online === false) {
        p.bodyMat.color.setHex(COLORS.offline); // not powered yet
      } else if (s.broken > 0) {
        // Exploded: charred body, lazy smoke
        p.bodyMat.color.setHex(COLORS.char);
        if (Math.random() < dt * 6) {
          particles.emit({
            pos: at(i, rnd(-0.3, 0.3), 2.1, rnd(-0.3, 0.3)),
            vel: v(rnd(-0.2, 0.2), rnd(0.8, 1.4), 0),
            color: 0x374151, size: 0.2, life: 1.6, grow: 2, opacity: 0.6,
          });
        }
      } else if (s.trouble) {
        // Steel → amber → red as danger rises
        if (d < 0.5) tmp.copy(steel).lerp(amber, d / 0.5);
        else tmp.copy(amber).lerp(red, (d - 0.5) / 0.5);
        p.bodyMat.color.copy(tmp);

        // Beacon flashes faster as danger rises
        const lit = Math.sin(t * (6 + 12 * d)) > 0;
        p.beaconMat.color.copy(d < 0.7 ? amber : red);
        p.beaconMat.emissive.copy(d < 0.7 ? amber : red);
        p.beaconMat.emissiveIntensity = lit ? 1.4 : 0.1;

        if (s.trouble === 'heat') {
          p.bodyMat.emissive.setHex(COLORS.red);
          p.bodyMat.emissiveIntensity = 0.15 + 0.6 * d * (0.7 + 0.3 * Math.sin(t * 8));
          if (Math.random() < dt * (4 + 20 * d)) {
            particles.emit({
              pos: at(i, rnd(-0.5, 0.5), 2.2, rnd(-0.5, 0.5)),
              vel: v(rnd(-0.2, 0.2), rnd(1.2, 2), rnd(-0.2, 0.2)),
              color: 0xe2e8f0, size: 0.12, life: 1.2, grow: 2.5, opacity: 0.5,
            });
          }
        }
        if (s.trouble === 'pressure') {
          // The body swells and throbs faster as pressure builds
          const swell = 1 + (0.04 + 0.16 * d) * (0.5 + 0.5 * Math.sin(t * (6 + 14 * d)));
          p.body.scale.set(swell, 1, swell);
        }
        if (s.trouble === 'clog') {
          p.group.rotation.z = Math.sin(t * 40) * 0.015 * (0.3 + d);
          if (Math.random() < dt * (3 + 14 * d)) {
            particles.emit({
              pos: at(i, rnd(-0.3, 0.3), 3.1, rnd(-0.3, 0.3)),
              vel: v(rnd(-0.3, 0.3), rnd(1, 1.8), 0),
              color: 0x111827, size: 0.14, life: 1.1, grow: 2, opacity: 0.75,
            });
          }
        }
        // Critical: the whole pump shakes (unless you are working on it)
        if (d > 0.7 && !s.working) p.group.position.x += (Math.random() - 0.5) * 0.25 * (d - 0.7) / 0.3;
      } else {
        p.bodyMat.color.copy(steel);
      }

      // Power-on flash (Hall B coming online)
      if (p.powerFlash > 0) {
        p.bodyMat.emissive.setHex(0xffffff);
        p.bodyMat.emissiveIntensity = p.powerFlash * 0.9;
        p.powerFlash = Math.max(0, p.powerFlash - dt * 1.5);
      }

      // Happy bounce after a save (squash and stretch)
      if (p.bounce > 0) {
        const k = Math.sin((1 - p.bounce) * Math.PI * 3) * p.bounce * 0.28;
        p.body.scale.y *= 1 + k;
        p.body.scale.x *= 1 - k * 0.5;
        p.body.scale.z *= 1 - k * 0.5;
        p.top.position.y = 2.6 + k * 0.9;
        p.bounce = Math.max(0, p.bounce - dt * 2.2);
      }

      // Wrench jolt
      if (p.jolt > 0) {
        p.group.position.x += Math.sin(p.jolt * 30) * 0.05 * p.jolt;
        p.jolt = Math.max(0, p.jolt - dt * 5);
      }
    });
  }

  // ── Render one frame ───────────────────────────────────────

  function render(dt) {
    particles.update(dt);
    for (const f of flying) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.vel.y -= 18 * dt;
      f.obj.position.addScaledVector(f.vel, dt);
      f.obj.rotation.x += f.spin.x * dt;
      f.obj.rotation.y += f.spin.y * dt;
      f.obj.rotation.z += f.spin.z * dt;
      if (f.obj.position.y < 0.4 && f.vel.y < 0) {
        f.vel.y *= -0.35; // little bounce
        f.vel.x *= 0.5;
        f.vel.z *= 0.5;
        f.obj.position.y = 0.4;
      }
      if (f.life <= 0) f.obj.visible = false;
    }
    flash.intensity *= Math.max(0, 1 - dt * 6);

    // Camera shake (offset only for this frame)
    const offset = v((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
    camera.position.add(offset);
    outline.render(scene, camera);
    labelRenderer.render(scene, camera);
    camera.position.sub(offset);
    shake = Math.max(0, shake - dt * 1.2);
  }

  return {
    renderer, pumps, pick, select, spray, vent, hit, explode, restore,
    powerOn, setHallB, celebrate, popup, snapshot, updatePumps, render,
  };
}
