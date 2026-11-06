import * as THREE from 'three';

// V10 — illustrative industrial PPE characters and dry-zone succulents.
// Entire module is visual-only and does not feed the electrical/financial model.
const finish = (color, roughness = 0.84) =>
  new THREE.MeshStandardMaterial({ color, roughness });
const suit = finish(0x263d4a),
  dark = finish(0x152831),
  boots = finish(0x24292d);
const gloves = finish(0x363f43),
  skin = finish(0xaf8265);
const vest = finish(0xb6a43c),
  reflective = new THREE.MeshStandardMaterial({
    color: 0xc6d3d0,
    roughness: 0.62,
    emissive: 0x96b7ae,
    emissiveIntensity: 0.09,
  });
const yellow = finish(0xe5b540, 0.6),
  white = finish(0xe5e5d7, 0.6);
const tabletMaterial = finish(0x1e2b31),
  screenMaterial = finish(0x4d6a77, 0.45);
const leafColors = [0x526a52, 0x748567, 0x607a61].map(v => finish(v, 0.96));
const stone = finish(0x998a70, 0.98);
function mesh(group, geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  group.add(m);
  return m;
}
function block(p, w, h, d, mat, x = 0, y = 0, z = 0) {
  return mesh(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}
function ball(p, r, mat, x, y, z) {
  return mesh(p, new THREE.SphereGeometry(r, 12, 9), mat, x, y, z);
}
function makeWorker(helmet) {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const torso = mesh(
    body,
    new THREE.CylinderGeometry(0.28, 0.3, 0.62, 10),
    suit,
    0,
    1.31,
    0
  );
  torso.rotation.z = 0.014;
  block(body, 0.54, 0.49, 0.07, vest, 0, 1.37, 0.245);
  block(body, 0.54, 0.49, 0.07, vest, 0, 1.37, -0.245);
  for (const z of [-0.286, 0.286]) {
    block(body, 0.55, 0.05, 0.02, reflective, 0, 1.22, z);
    for (const x of [-0.2, 0.2])
      block(body, 0.055, 0.43, 0.02, reflective, x, 1.39, z);
  }
  const legs = [],
    arms = [];
  for (const x of [-0.145, 0.145]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.93, 0);
    body.add(leg);
    mesh(
      leg,
      new THREE.CylinderGeometry(0.103, 0.093, 0.6, 9),
      suit,
      0,
      -0.33,
      0
    );
    ball(leg, 0.098, suit, 0, -0.64, 0);
    block(leg, 0.2, 0.16, 0.3, boots, 0, -0.79, 0.06);
    legs.push(leg);
  }
  for (const x of [-0.355, 0.355]) {
    const arm = new THREE.Group();
    arm.position.set(x, 1.55, 0);
    body.add(arm);
    ball(arm, 0.13, suit, 0, 0, 0);
    mesh(
      arm,
      new THREE.CylinderGeometry(0.095, 0.082, 0.47, 9),
      suit,
      0,
      -0.28,
      0
    );
    mesh(
      arm,
      new THREE.CylinderGeometry(0.07, 0.064, 0.2, 8),
      dark,
      0,
      -0.6,
      0.015
    );
    ball(arm, 0.075, gloves, 0, -0.74, 0.032);
    arms.push(arm);
  }
  mesh(
    body,
    new THREE.CylinderGeometry(0.092, 0.11, 0.14, 10),
    skin,
    0,
    1.66,
    0
  );
  const head = new THREE.Group();
  head.position.set(0, 1.7, 0);
  body.add(head);
  const face = ball(head, 0.21, skin, 0, 0.02, 0.015);
  face.scale.set(0.93, 1.12, 0.9);
  mesh(
    head,
    new THREE.SphereGeometry(0.25, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
    helmet,
    0,
    0.18,
    -0.01
  );
  mesh(
    head,
    new THREE.CylinderGeometry(0.255, 0.255, 0.055, 16),
    helmet,
    0,
    0.145,
    -0.01
  );
  const brim = mesh(
    head,
    new THREE.CylinderGeometry(0.265, 0.26, 0.034, 16),
    helmet,
    0,
    0.127,
    0.05
  );
  brim.scale.z = 1.06;
  block(head, 0.35, 0.045, 0.062, dark, 0, 0.041, 0.207);
  const tab = new THREE.Group();
  tab.position.set(-0.16, 1.13, 0.35);
  tab.rotation.z = -0.18;
  body.add(tab);
  block(tab, 0.29, 0.4, 0.047, tabletMaterial);
  block(tab, 0.255, 0.33, 0.008, screenMaterial, 0, 0, 0.026);
  root.userData.rig = { body, head, legs, arms, tab };
  root.position.y = -0.12;
  return root;
}
function agaveLeaf(h, w, r) {
  const points = [
    [0, 0, 0],
    [-w, 0.09, 0],
    [-w * 0.7, h * 0.35, r * 0.37],
    [-w * 0.2, h * 0.83, r * 0.85],
    [0, h, r],
    [w * 0.2, h * 0.83, r * 0.85],
    [w * 0.7, h * 0.35, r * 0.37],
    [w, 0.09, 0],
  ];
  const verts = [];
  for (let i = 1; i < points.length - 1; i++)
    verts.push(...points[0], ...points[i], ...points[i + 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}
function agave(x, z, size, angle) {
  const group = new THREE.Group();
  group.position.set(x, -0.13, z);
  group.scale.setScalar(size);
  mesh(
    group,
    new THREE.CylinderGeometry(0.31, 0.35, 0.05, 10),
    stone,
    0,
    -0.018,
    0,
    false
  );
  for (let ring = 0; ring < 2; ring++) {
    const count = ring ? 7 : 11,
      mul = ring ? 0.68 : 1;
    for (let i = 0; i < count; i++) {
      const height = (0.8 + (i % 3) * 0.09) * mul,
        reach = (0.72 + (i % 4) * 0.07) * mul;
      const leaf = mesh(
        group,
        agaveLeaf(height, 0.16 * mul, reach),
        leafColors[(i + ring) % 3],
        0,
        0.015,
        0,
        false
      );
      leaf.rotation.y = (i / count) * Math.PI * 2 + angle + ring * 0.27;
      leaf.material.side = THREE.DoubleSide;
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = angle + (i * Math.PI) / 2;
    const peb = mesh(
      group,
      new THREE.IcosahedronGeometry(0.11 + (i % 2) * 0.06, 0),
      stone,
      Math.cos(a) * 0.38,
      -0.005,
      Math.sin(a) * 0.33,
      false
    );
    peb.scale.y = 0.32;
  }
  return group;
}
const turn = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
function face(person, angle, speed) {
  person.rotation.y += turn(person.rotation.y, angle) * Math.min(1, speed);
}
function pose(person, walking, t, checking) {
  const { body, head, legs, arms, tab } = person.userData.rig;
  const stride = walking ? Math.sin(t * 6.4) * 0.46 : 0;
  legs[0].rotation.x = stride;
  legs[1].rotation.x = -stride;
  arms[0].rotation.x = walking ? -stride * 0.48 : -0.36;
  arms[1].rotation.x = walking ? stride * 0.48 : checking ? -0.32 : -0.12;
  arms[1].rotation.z = checking ? -0.12 : 0;
  body.position.y = walking
    ? Math.abs(Math.sin(t * 6.4)) * 0.02
    : Math.sin(t * 0.8) * 0.004;
  head.rotation.y = Math.sin(t * 0.5) * (checking ? 0.12 : 0.05);
  head.rotation.x = checking ? 0.075 : 0;
  tab.rotation.x = checking ? -0.1 : -0.21;
}
export class SiteLife {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'PPE inspection staff and natural desert succulents';
    scene.add(this.group);
    this.clock = 0;
    this.pv = makeWorker(yellow);
    this.pv.name = 'PV inspector with tablet';
    this.pv.position.set(-13.8, -0.12, 21.0);
    this.group.add(this.pv);
    this.power = makeWorker(white);
    this.power.name = 'Equipment patrol inspector';
    this.group.add(this.power);
    // Clearance route east of the BESS, inverters and diesel skid.
    this.route = [
      { x: 36.7, z: -12.2, pause: 7, target: [29, -16] },
      { x: 37.15, z: -1.75 },
      { x: 29.2, z: -1.75, pause: 8, target: [29, -5] },
      { x: 37.15, z: -1.75 },
      { x: 37.15, z: 6.35 },
      { x: 24.0, z: 6.35, pause: 8, target: [20.6, 3] },
      { x: 37.15, z: 6.35 },
      { x: 37.15, z: 25.2 },
      { x: 36.1, z: 25.2, pause: 8, target: [29, 26] },
      { x: 37.15, z: 25.2 },
      { x: 37.15, z: -12.2 },
      { x: 36.7, z: -12.2 },
    ];
    this.power.position.set(this.route[0].x, -0.12, this.route[0].z);
    this.next = 1;
    this.wait = 7;
    this.lookAt = this.route[0].target;
    for (const [x, z, size, a] of [
      [-37.5, -28.2, 1.02, 0.25],
      [-38.2, 29.7, 0.8, 1.1],
      [43.1, -27.2, 0.96, 2.1],
      [43.3, 35.4, 1.15, 2.7],
    ])
      this.group.add(agave(x, z, size, a));
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.clock += dt;
    const t = this.clock % 24;
    let x,
      walk = false;
    if (t < 5.3) {
      x = -13.8 + (4.2 * t) / 5.3;
      walk = true;
      face(this.pv, Math.PI / 2, dt * 5);
    } else if (t < 14.5) {
      x = -9.6;
      face(this.pv, Math.PI, dt * 4);
    } else if (t < 19.8) {
      x = -9.6 - (4.2 * (t - 14.5)) / 5.3;
      walk = true;
      face(this.pv, -Math.PI / 2, dt * 5);
    } else {
      x = -13.8;
      face(this.pv, Math.PI, dt * 4);
    }
    this.pv.position.x = x;
    pose(this.pv, walk, this.clock, t >= 5.3 && t < 14.5);
    let rest = dt,
      moving = false;
    for (let guard = 0; rest > 0.00001 && guard < 10; guard++) {
      if (this.wait > 0) {
        const spent = Math.min(rest, this.wait);
        rest -= spent;
        this.wait -= spent;
        if (this.wait > 0.00001) break;
      }
      const n = this.route[this.next],
        dx = n.x - this.power.position.x,
        dz = n.z - this.power.position.z,
        dist = Math.hypot(dx, dz);
      if (dist < 0.015) {
        this.wait = n.pause || 0;
        this.lookAt = n.target || null;
        this.next = (this.next + 1) % this.route.length;
        continue;
      }
      const move = Math.min(dist, 1.13 * rest);
      this.power.position.x += (dx / dist) * move;
      this.power.position.z += (dz / dist) * move;
      rest -= move / 1.13;
      moving = true;
      face(this.power, Math.atan2(dx, dz), dt * 4.5);
    }
    if (!moving && this.lookAt) {
      face(
        this.power,
        Math.atan2(
          this.lookAt[0] - this.power.position.x,
          this.lookAt[1] - this.power.position.z
        ),
        dt * 3.2
      );
    }
    pose(this.power, moving, this.clock + 0.8, !moving);
  }
}
