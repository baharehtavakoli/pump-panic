// ─────────────────────────────────────────────────────────────
// decor.js — everything around the station that is only for looks:
// night sky (gradient, stars, moon), a distant skyline and hills,
// a fence, a second tank, a pipe rack, barrels, crates, cabinets,
// light poles with light pools, and walkway lines on the floor.
//
// Nothing here is clickable or part of the rules. Colors stay in the
// night/steel palette; amber and red are kept for pumps in trouble.
// Small repeated parts are merged into one mesh each, so phones stay fast.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Same "random" every time (so the skyline doesn't change between visits)
function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// Night sky: darker at the top, a little lighter at the horizon
export function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#070d19');
  g.addColorStop(0.55, '#0f1b30');
  g.addColorStop(1, '#1f3555');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildDecor(scene, { toon, noOutline }) {
  const rand = seeded(42);

  // Add one mesh. outline:false = no dark outline (for far or glowing things)
  const add = (geo, color, { cast = true, receive = true, outline = true, mat = null } = {}) => {
    const material = mat ?? toon(color);
    if (!outline) noOutline(material);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    scene.add(m);
    return m;
  };
  // A copy of a shape, moved (and turned) into place; many copies get merged
  const at = (geo, x, y, z, ry = 0) => geo.clone().rotateY(ry).translate(x, y, z);
  const merge = (list) => mergeGeometries(list, false);

  // ── Floor: concrete apron + white walkway lines ──
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(34, 26), noOutline(toon(0x223046)));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, 0.012, -4);
  apron.receiveShadow = true;
  scene.add(apron);

  const line = (w, d) => new THREE.BoxGeometry(w, 0.01, d);
  add(
    merge([at(line(14, 0.12), 0, 0.11, 3.45), at(line(0.12, 9.3), -6.95, 0.11, -1.2), at(line(0.12, 9.3), 6.95, 0.11, -1.2)]),
    0x8fa1b8,
    { cast: false, outline: false }
  );

  // ── Fence (back and sides): posts + two rails ──
  const post = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6);
  const posts = [];
  for (let x = -14; x <= 14; x += 2.2) posts.push(at(post, x, 0.7, -13));
  for (let z = -13; z <= 5; z += 2.2) posts.push(at(post, -14, 0.7, z), at(post, 14, 0.7, z));
  const rail = (len) => new THREE.BoxGeometry(len, 0.06, 0.06);
  const rails = [];
  for (const y of [0.7, 1.3]) {
    rails.push(at(rail(28), 0, y, -13));
    rails.push(at(rail(18), -14, y, -4, Math.PI / 2), at(rail(18), 14, y, -4, Math.PI / 2));
  }
  add(merge([...posts, ...rails]), 0x6f7f96, { receive: false });

  // ── Low safety railing in front of the station ──
  const front = [];
  for (let x = -7; x <= 7.01; x += 1.75) front.push(at(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), x, 0.45, 5.3));
  front.push(at(rail(14), 0, 0.9, 5.3), at(rail(14), 0, 0.5, 5.3));
  add(merge(front), 0x7fb3d5, { receive: false });

  // ── More tanks behind (smaller than the main one) ──
  add(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 32).translate(5.4, 1.6, -10.6), 0x8e9cb0);
  add(new THREE.CylinderGeometry(1.43, 1.43, 0.22, 32).translate(5.4, 2.5, -10.6), 0x2c5d8f);
  add(new THREE.CylinderGeometry(1, 1, 2.4, 28).translate(-4.6, 1.2, -11), 0x8193a8);

  // ── Pipe rack on the right: portal frames + three color-coded pipes ──
  const frame = [];
  for (const z of [-6, -3, 0, 3]) {
    frame.push(at(new THREE.BoxGeometry(0.16, 2.6, 0.16), 10.4, 1.3, z), at(new THREE.BoxGeometry(0.16, 2.6, 0.16), 11.6, 1.3, z));
    frame.push(at(new THREE.BoxGeometry(1.5, 0.14, 0.18), 11, 2.55, z));
  }
  add(merge(frame), 0x3d4651);
  const rackPipe = (x, color) =>
    add(new THREE.CylinderGeometry(0.11, 0.11, 11, 12).rotateX(Math.PI / 2).translate(x, 2.74, -1.5), color, { receive: false });
  rackPipe(10.65, 0x4f8fd0);
  rackPipe(11, 0x7fb3d5);
  rackPipe(11.35, 0x9aaec6);

  // ── Barrels (left) and crates (right front) ──
  const barrel = new THREE.CylinderGeometry(0.36, 0.36, 0.95, 16);
  const blue = [];
  const grey = [];
  [[-10.6, 1.6], [-9.8, 1.6], [-10.2, 2.35], [-9.4, 2.35], [-10.6, 3.1], [-9.8, 3.1]].forEach(([x, z], k) =>
    (k % 2 ? grey : blue).push(at(barrel, x, 0.48, z))
  );
  add(merge(blue), 0x2c5d8f);
  add(merge(grey), 0x6b7785);
  const crate = new THREE.BoxGeometry(1, 1, 1);
  add(merge([at(crate, 10.2, 0.5, 4.4), at(crate, 11.25, 0.5, 4.4, 0.2), at(crate, 10.6, 1.5, 4.4, -0.15)]), 0x2f6168);

  // ── Electrical cabinets beside the halls ──
  const cab = new THREE.BoxGeometry(0.9, 1.6, 0.6);
  add(merge([at(cab, 7.7, 0.8, 1.6), at(cab, 7.7, 0.8, 0.5), at(cab, 7.7, 0.8, -2.9)]), 0x7f93ab);
  const panel = new THREE.BoxGeometry(0.02, 0.5, 0.35);
  add(merge([at(panel, 7.24, 1.05, 1.6), at(panel, 7.24, 1.05, 0.5), at(panel, 7.24, 1.05, -2.9)]), 0x9fd3ff, {
    cast: false,
    outline: false,
    mat: new THREE.MeshBasicMaterial({ color: 0x9fd3ff }),
  });

  // ── Light poles with a pool of light ──
  const poleSpots = [[-8.3, 3.9], [8.3, 3.9], [-8.3, -6.4], [8.3, -6.4]];
  const poleParts = [];
  const heads = [];
  for (const [x, z] of poleSpots) {
    const dir = x < 0 ? 1 : -1; // arm points toward the station
    poleParts.push(at(new THREE.CylinderGeometry(0.08, 0.1, 5, 10), x, 2.5, z));
    poleParts.push(at(new THREE.BoxGeometry(1.1, 0.1, 0.1), x + dir * 0.5, 4.95, z));
    heads.push(at(new THREE.BoxGeometry(0.5, 0.16, 0.3), x + dir * 1, 4.88, z));
  }
  add(merge(poleParts), 0x3d4651);
  add(merge(heads), 0xfff1c9, { cast: false, outline: false, mat: new THREE.MeshBasicMaterial({ color: 0xfff1c9 }) });
  // Two real lights (the front poles) make warm pools on the floor
  for (const [x, z] of poleSpots.slice(0, 2)) {
    const l = new THREE.PointLight(0xffe9c4, 9, 9, 1.6);
    l.position.set(x + (x < 0 ? 1 : -1), 4.6, z);
    scene.add(l);
  }

  // ── Far away: skyline and hills (no fog, so they stay as silhouettes) ──
  const far = noOutline(new THREE.MeshBasicMaterial({ color: 0x0c1526, fog: false }));
  const towers = [];
  const windows = [];
  const win = new THREE.PlaneGeometry(0.35, 0.45);
  for (let x = -60; x <= 60; x += 2.4 + rand() * 2) {
    const w = 1.8 + rand() * 2.2;
    const h = 3 + rand() * 9;
    towers.push(new THREE.BoxGeometry(w, h, 2).translate(x, h / 2, -42 - rand() * 4));
    for (let k = 0; k < 4; k++) {
      if (rand() < 0.45) windows.push(win.clone().translate(x - w / 3 + rand() * (w * 0.66), 1 + rand() * (h - 2), -40.9));
    }
  }
  add(merge(towers), 0, { cast: false, receive: false, mat: far });
  add(merge(windows), 0, {
    cast: false,
    receive: false,
    mat: noOutline(new THREE.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.55, fog: false })),
  });
  const hill = new THREE.SphereGeometry(1, 24, 12);
  add(
    merge([hill.clone().scale(40, 9, 8).translate(-35, -2, -60), hill.clone().scale(46, 12, 8).translate(30, -3, -66)]),
    0,
    { cast: false, receive: false, mat: noOutline(new THREE.MeshBasicMaterial({ color: 0x0a1222, fog: false })) }
  );

  // ── Stars and moon ──
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const a = rand() * Math.PI * 2;
    const r = 70 + rand() * 30;
    starPos.push(Math.cos(a) * r, 14 + rand() * 60, -Math.abs(Math.sin(a) * r) - 10);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.8, fog: false });
  noOutline(starMat);
  scene.add(new THREE.Points(starGeo, starMat));

  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), noOutline(new THREE.MeshBasicMaterial({ color: 0xe8f1ff, fog: false })));
  moonDisc.position.set(-34, 34, -80);
  moonDisc.lookAt(0, 0, 0);
  scene.add(moonDisc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(7, 32),
    noOutline(new THREE.MeshBasicMaterial({ color: 0x9fb7d9, transparent: true, opacity: 0.12, fog: false, depthWrite: false }))
  );
  halo.position.set(-34, 34, -80.5);
  halo.lookAt(0, 0, 0);
  scene.add(halo);
}
