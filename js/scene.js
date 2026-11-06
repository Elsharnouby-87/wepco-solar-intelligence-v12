import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FLOW_ROUTES, routePowerState } from './topology.js';
import { SiteLife } from './site-life.js';

const COLORS = {
  mint: 0x61e9be,
  solar: 0x71bfe3,
  night: 0x10242d,
  day: 0x426d7c,
};
// Unified matte anodized frames — no mirror-bright rectangular subfields.
const panelDark = new THREE.MeshStandardMaterial({
  color: 0x1a303d,
  metalness: 0.18,
  roughness: 0.83,
});
const metal = new THREE.MeshStandardMaterial({
  color: 0x7d9ca0,
  metalness: 0.76,
  roughness: 0.32,
});
const white = new THREE.MeshStandardMaterial({
  color: 0xc4d9d9,
  metalness: 0.3,
  roughness: 0.43,
});
const graphite = new THREE.MeshStandardMaterial({
  color: 0x263640,
  metalness: 0.45,
  roughness: 0.45,
});
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const v = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  v.position.set(x, y, z);
  v.castShadow = true;
  v.receiveShadow = true;
  return v;
}
function cyl(r, h, material, x = 0, y = 0, z = 0) {
  const v = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), material);
  v.position.set(x, y, z);
  v.castShadow = true;
  return v;
}
function labelSprite(title, color = '#a9f2d4') {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 108;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(7,19,25,.84)';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = color;
  g.fillRect(0, 0, 5, 108);
  g.font = '700 30px Arial';
  g.fillText(title, 24, 65);
  g.fillStyle = 'rgba(133,182,185,.6)';
  g.fillRect(24, 81, 365, 1);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })
  );
  s.scale.set(9.7, 2.39, 1);
  return s;
}
function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 240;
  c.height = 476;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1f30';
  g.fillRect(0, 0, c.width, c.height);
  const cols = 12,
    rows = 22,
    pad = 6,
    gap = 2,
    cw = (240 - 2 * pad - (cols - 1) * gap) / cols,
    ch = (476 - 2 * pad - (rows - 1) * gap) / rows;
  for (let col = 0; col < cols; col++)
    for (let row = 0; row < rows; row++) {
      const x = pad + col * (cw + gap),
        y = pad + row * (ch + gap);
      const grad = g.createLinearGradient(x, y, x + cw, y + ch);
      grad.addColorStop(0, '#17394e');
      grad.addColorStop(0.5, '#173146');
      grad.addColorStop(1, '#0e2235');
      g.fillStyle = grad;
      g.fillRect(x, y, cw, ch);
      g.strokeStyle = 'rgba(126,191,214,.12)';
      g.lineWidth = 0.5;
      g.strokeRect(x + 0.25, y + 0.25, cw - 0.5, ch - 0.5);
      g.strokeStyle = 'rgba(178,212,218,.20)';
      g.beginPath();
      g.moveTo(x + cw * 0.5, y + 1);
      g.lineTo(x + cw * 0.5, y + ch - 1);
      g.stroke();
    }
  g.strokeStyle = '#29475a';
  g.lineWidth = 2;
  g.strokeRect(1.5, 1.5, 237, 473);
  // Removed the repeating white polygonal highlight from the glass texture.
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const assetProps = {
  power: { target: new THREE.Vector3(24, 0, -1), distance: 28 },
  pv: { target: new THREE.Vector3(-15, 0, -5), distance: 36 },
  bess: { target: new THREE.Vector3(29, 1, -16), distance: 18 },
  genset: { target: new THREE.Vector3(29, 1, 12), distance: 19 },
  esp: { target: new THREE.Vector3(30, 1, 26), distance: 16 },
};
export class MicrogridScene {
  constructor(mount, { onAssetClick, onTourChange } = {}) {
    this.mount = mount;
    this.onAssetClick = onAssetClick;
    this.onTourChange = onTourChange;
    this.tourActive = false;
    this.tourElapsed = 0;
    this.tourIndex = 0;
    this.mode = 'feasibility';
    this.hour = 12;
    this.paused = false;
    this.disposed = false;
    this.elapsed = 0;
    this.assetObjects = [];
    this.objectParents = new Map();
    this.pulses = [];
    this.fadeLabels = [];
    this.flowVisible = true;
    this.cableRoutes = [];
    this.flowStates = {};
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.58;
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        window.innerWidth < 700 ? 1.35 : 1.8
      )
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x37515b, 0.0038);
    this.camera = new THREE.PerspectiveCamera(41, 1, 0.1, 300);
    this.camera.position.set(57, 43, 68);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(4, 0, -1);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.056;
    this.controls.minDistance = 13;
    this.controls.maxDistance = 102;
    this.controls.maxPolarAngle = Math.PI / 2.02;
    this.controls.minPolarAngle = 0.25;
    this.controls.enablePan = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.13;
    this.ambient = new THREE.HemisphereLight(0xe6f5ff, 0x526363, 3.5);
    this.scene.add(this.ambient);
    this.sunLight = new THREE.DirectionalLight(0xfff2d9, 4.8);
    this.sunLight.position.set(-25, 42, -30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(
      window.innerWidth < 700 ? 1024 : 2048,
      window.innerWidth < 700 ? 1024 : 2048
    );
    this.sunLight.shadow.camera.left = -72;
    this.sunLight.shadow.camera.right = 72;
    this.sunLight.shadow.camera.top = 65;
    this.sunLight.shadow.camera.bottom = -65;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 145;
    this.sunLight.shadow.bias = -0.00013;
    this.sunLight.shadow.normalBias = 0.014;
    this.scene.add(this.sunLight);
    this.fill = new THREE.PointLight(0xe9f9ff, 23, 95);
    this.fill.position.set(28, 9, -12);
    this.scene.add(this.fill);
    // V9 — one continuous, gently sculpted desert surface. No rectangular PV plinth,
    // no second floor plane and no engineering grid over the real-world terrain.
    const terrainGeo = new THREE.PlaneGeometry(180, 150, 96, 80);
    const vp = terrainGeo.attributes.position;
    for (let i = 0; i < vp.count; i++) {
      const x = vp.getX(i),
        z = -vp.getY(i);
      const dx = Math.max(0, Math.abs(x - 1.5) - 45),
        dz = Math.max(0, Math.abs(z - 1.5) - 42);
      const fade = Math.min(1, Math.hypot(dx, dz) / 18);
      const relief =
        (0.012 + 0.11 * fade) *
        (Math.sin(x * 0.16 + z * 0.061) * Math.cos(z * 0.135) +
          0.32 * Math.sin(x * 0.29 - z * 0.18));
      vp.setZ(i, relief);
    }
    vp.needsUpdate = true;
    terrainGeo.computeVertexNormals();
    const ground = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({
        color: 0xd4c5a9,
        roughness: 1,
        metalness: 0,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    ground.name = 'Continuous natural Western Desert terrain';
    this.scene.add(ground);
    this.drawEarth();
    this.makeHardware();
    this.upgradeHardware();
    this.makePrecisionDetails();
    this.makeSolarArray('feasibility');
    this.makeFlow();
    this.makeSun();
    this.makePremiumDetails();
    this.siteLife = new SiteLife(this.scene);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.mouseDown = null;
    this.onDown = e => {
      this.mouseDown = { x: e.clientX, y: e.clientY };
      this.stopTour();
      this.controls.autoRotate = false;
    };
    this.onClick = e => {
      if (
        !this.mouseDown ||
        Math.hypot(this.mouseDown.x - e.clientX, this.mouseDown.y - e.clientY) >
          7
      )
        return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.assetObjects, true);
      if (hits.length) {
        let cur = hits[0].object;
        while (cur && !cur.userData.asset) cur = cur.parent;
        if (cur && cur.userData.asset)
          this.focusAsset(cur.userData.asset, true);
      }
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onDown);
    this.renderer.domElement.addEventListener('pointerup', this.onClick);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();
    this.setTime(12);
    this.last = performance.now();
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
  }
  drawEarth() {
    // Deterministic rock scatter, modelled with GPU instancing for mobile efficiency.
    // Pebbles belong outside the fenced process area; no artificial rectangle drawn.
    const stoneGeo = new THREE.DodecahedronGeometry(0.35, 0);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xb9ac90,
      roughness: 1,
      flatShading: true,
    });
    const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, 360);
    const dummy = new THREE.Object3D(),
      color = new THREE.Color();
    let index = 0,
      seed = 17006;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let k = 0; k < 1750 && index < 360; k++) {
      const x = (random() - 0.5) * 166,
        z = (random() - 0.5) * 137;
      if (x > -37 && x < 42 && z > -32 && z < 37) continue;
      const size = 0.22 + random() * 0.7;
      dummy.position.set(x, -0.14 + size * 0.07, z);
      dummy.rotation.set(random() * 0.26, random() * 6.28, random() * 0.26);
      dummy.scale.set(size, 0.13 + random() * 0.24, size * 0.57);
      dummy.updateMatrix();
      stones.setMatrixAt(index, dummy.matrix);
      color.setHSL(
        0.087 + random() * 0.045,
        0.13 + random() * 0.13,
        0.41 + random() * 0.24
      );
      stones.setColorAt(index, color);
      index++;
    }
    stones.count = index;
    stones.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
    stones.castShadow = false;
    stones.receiveShadow = true;
    this.scene.add(stones);
  }
  register(group, id) {
    group.userData.asset = id;
    this.assetObjects.push(group);
    return group;
  }
  makeHardware() {
    this.hardware = new THREE.Group();
    this.scene.add(this.hardware);
    // ESS battery storage units, elevated concrete slabs and cabinet ventilation.
    this.bessGroup = this.register(new THREE.Group(), 'bess');
    this.hardware.add(this.bessGroup);
    const slab = box(
      13,
      0.36,
      5.7,
      new THREE.MeshStandardMaterial({ color: 0x6d7771, roughness: 0.9 }),
      29,
      0.08,
      -16
    );
    this.bessGroup.add(slab);
    this.batteryIndicators = [];
    for (let i = 0; i < 3; i++) {
      const x = 24.7 + i * 4.3,
        z = -16;
      const b = box(3.35, 4.7, 3.2, white, x, 2.6, z);
      this.bessGroup.add(b);
      this.bessGroup.add(
        box(
          2.9,
          3.8,
          0.085,
          new THREE.MeshStandardMaterial({
            color: 0xcbdede,
            metalness: 0.17,
            roughness: 0.48,
          }),
          x,
          2.65,
          z + 1.68
        )
      );
      for (let k = 0; k < 11; k++) {
        const slot = box(
          2.5,
          0.065,
          0.023,
          graphite,
          x,
          1.13 + k * 0.27,
          z + 1.76
        );
        this.bessGroup.add(slot);
      }
      this.bessGroup.add(box(3.2, 0.15, 0.1, metal, x, 4.84, z + 1.63));
      const led = box(
        1.2,
        0.075,
        0.082,
        new THREE.MeshBasicMaterial({ color: 0x57d4ae }),
        x,
        4.45,
        z + 1.76
      );
      this.bessGroup.add(led);
      this.batteryIndicators.push(led);
    }
    const label = labelSprite('BATTERY STORAGE / BESS');
    label.position.set(29, 8, -16);
    this.bessGroup.add(label);
    // Power conversion equipment
    this.inverterGroup = new THREE.Group();
    this.hardware.add(this.inverterGroup);
    for (let i = 0; i < 3; i++) {
      const x = 24.5 + i * 4.5;
      this.inverterGroup.add(box(3.1, 3.25, 1.3, white, x, 2.1, -5));
      this.inverterGroup.add(box(1.7, 0.38, 0.052, graphite, x, 2.9, -4.31));
      this.inverterGroup.add(
        box(
          0.83,
          0.06,
          0.055,
          new THREE.MeshBasicMaterial({ color: 0x4bdcae }),
          x,
          3.32,
          -4.28
        )
      );
      this.inverterGroup.add(box(3.4, 0.16, 1.6, metal, x, 0.43, -5));
    }
    const labInv = labelSprite('SOLAR INVERTERS', '#a6e2f6');
    labInv.position.set(29, 6.6, -5);
    this.inverterGroup.add(labInv);
    // Generator skid and casing
    this.gensetGroup = this.register(new THREE.Group(), 'genset');
    this.hardware.add(this.gensetGroup);
    this.gensetGroup.add(box(10, 0.6, 5.2, graphite, 29, 0.3, 11));
    this.gensetShell = box(
      9,
      3.8,
      4.6,
      new THREE.MeshStandardMaterial({
        color: 0xa7b7ae,
        metalness: 0.25,
        roughness: 0.55,
      }),
      29,
      2.45,
      11
    );
    this.gensetGroup.add(this.gensetShell);
    const gensetHighlight = box(
      8.2,
      0.18,
      0.06,
      new THREE.MeshBasicMaterial({ color: 0xe7bb60 }),
      29,
      4.18,
      13.34
    );
    this.gensetGroup.add(gensetHighlight);
    this.gensetHighlight = gensetHighlight;
    for (let i = 0; i < 10; i++) {
      this.gensetGroup.add(
        box(3.7, 0.1, 0.052, graphite, 26.8, 1.15 + i * 0.27, 13.38)
      );
      this.gensetGroup.add(
        box(2.7, 0.1, 0.052, graphite, 31.7, 1.15 + i * 0.27, 13.38)
      );
    }
    this.gensetGroup.add(
      box(
        3.1,
        0.13,
        0.06,
        new THREE.MeshBasicMaterial({ color: 0xf3d883 }),
        27.3,
        3.65,
        13.4
      )
    );
    const exhaust = cyl(0.6, 2.5, metal, 32.2, 5.35, 10.1);
    this.gensetGroup.add(exhaust);
    this.gensetGroup.add(cyl(0.9, 0.25, graphite, 32.2, 6.65, 10.1));
    const genLab = labelSprite('DIESEL GENERATOR', '#f1ce87');
    genLab.position.set(29, 9, 11);
    this.gensetGroup.add(genLab);
    // ESP wellhead and VSD panel
    this.espGroup = this.register(new THREE.Group(), 'esp');
    this.hardware.add(this.espGroup);
    const wellPad = box(
      10,
      0.26,
      8,
      new THREE.MeshStandardMaterial({ color: 0x818c7e, roughness: 0.87 }),
      29,
      0.03,
      26
    );
    this.espGroup.add(wellPad);
    const casing = cyl(0.55, 4, metal, 29, 2.35, 26);
    this.espGroup.add(casing);
    this.espGroup.add(
      cyl(
        0.89,
        0.3,
        new THREE.MeshStandardMaterial({
          color: 0xbea36d,
          metalness: 0.6,
          roughness: 0.3,
        }),
        29,
        4.42,
        26
      )
    );
    const horizontal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 5.8, 10),
      new THREE.MeshStandardMaterial({
        color: 0x8fc7b2,
        metalness: 0.35,
        roughness: 0.4,
      })
    );
    horizontal.rotation.z = Math.PI / 2;
    horizontal.position.set(31, 3.55, 26);
    this.espGroup.add(horizontal);
    const pipeDown = cyl(0.13, 1.4, metal, 33.8, 2.85, 26);
    this.espGroup.add(pipeDown);
    this.espGroup.add(box(2.7, 3.4, 1.7, white, 24, 1.9, 26));
    this.espGroup.add(box(2.1, 0.45, 0.08, graphite, 24, 2.45, 26.9));
    this.espGroup.add(
      box(
        0.7,
        0.08,
        0.06,
        new THREE.MeshBasicMaterial({ color: 0x5debc4 }),
        24,
        2.91,
        26.95
      )
    );
    const ell = labelSprite('ESP WELL / VSD', '#b8e7fb');
    ell.position.set(29, 7.5, 26);
    this.espGroup.add(ell);
    // Physical outputs are wired through the dedicated switchboard in upgradeHardware();
    // no decorative pseudo-bus bypassing the LV switchgear is placed here.
  }
  /** Detail package: architectural enclosure geometry + genuine 3-phase cable paths.
   * Conceptual geometry with no claim of scaled mechanical design or exact cable route. */
  upgradeHardware() {
    const paint = (color, metalness = 0.2, roughness = 0.55) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const dark = paint(0x152c33, 0.58, 0.34),
      gasket = paint(0x344a4e, 0.6, 0.52),
      blue = paint(0x3c9bba, 0.25, 0.35);
    const copper = paint(0xdca954, 0.55, 0.28),
      signal = paint(0x5cdeab, 0.27, 0.3),
      screen = paint(0x0e4357, 0.1, 0.24);
    const warning = paint(0xecb74b, 0.12, 0.38),
      concrete = paint(0x89938d, 0.06, 0.87),
      rail = paint(0x7c8e8b, 0.66, 0.38);
    const cylinderBetween = (a, b, r, mat) => {
      const from = new THREE.Vector3(...a),
        to = new THREE.Vector3(...b);
      const delta = to.clone().sub(from);
      const item = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, delta.length(), 10),
        mat
      );
      item.position.copy(from).add(to).multiplyScalar(0.5);
      item.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize()
      );
      item.castShadow = true;
      return item;
    };
    // Battery enclosures: pitched roof lip, double panel seams, recessed touch HMI,
    // grounding, safety labels, vent grille, foundation anchor bolts, external ducts.
    for (let i = 0; i < 3; i++) {
      const x = 24.7 + i * 4.3,
        z = -16;
      this.bessGroup.add(box(3.56, 0.17, 3.45, gasket, x, 5.015, z));
      this.bessGroup.add(box(0.035, 3.8, 0.06, dark, x, 2.66, z + 1.742));
      this.bessGroup.add(box(0.18, 1.08, 0.12, rail, x + 1.45, 2.8, z + 1.73));
      this.bessGroup.add(box(0.68, 0.4, 0.1, dark, x - 0.92, 4.03, z + 1.75));
      this.bessGroup.add(
        box(0.46, 0.21, 0.11, screen, x - 0.92, 4.03, z + 1.82)
      );
      this.bessGroup.add(
        box(0.52, 0.1, 0.12, warning, x + 0.75, 3.96, z + 1.78)
      );
      this.bessGroup.add(box(0.72, 0.12, 0.09, dark, x + 0.7, 3.69, z + 1.76));
      for (let k = 0; k < 7; k++)
        this.bessGroup.add(
          box(0.7, 0.055, 0.065, dark, x - 1.08, 1.15 + k * 0.21, z - 1.725)
        );
      for (const dx of [-1.37, 1.37])
        for (const dz of [-1.13, 1.13])
          this.bessGroup.add(cyl(0.12, 0.24, rail, x + dx, 0.32, z + dz));
      const duct = box(0.34, 2.9, 0.45, rail, x + 1.56, 2.45, z - 0.58);
      this.bessGroup.add(duct);
      this.bessGroup.add(box(2.75, 0.16, 0.2, copper, x, 0.54, z + 1.77));
    }
    // Huawei-style inverter front bezels, communication ports, indicator lamps,
    // removable cover fasteners and AC isolator boxes.
    for (let i = 0; i < 3; i++) {
      const x = 24.5 + i * 4.5,
        z = -5;
      this.inverterGroup.add(
        box(2.9, 2.7, 0.055, paint(0xe0e8e4, 0.15, 0.34), x, 2.1, z + 0.695)
      );
      this.inverterGroup.add(box(2.35, 0.08, 0.075, rail, x, 3.39, z + 0.726));
      this.inverterGroup.add(box(0.68, 0.1, 0.075, screen, x, 1.2, z + 0.748));
      this.inverterGroup.add(box(0.24, 0.08, 0.075, signal, x, 3.2, z + 0.749));
      for (const dx of [-1.22, 1.22])
        for (const dy of [1.05, 3.2])
          this.inverterGroup.add(
            cyl(0.055, 0.035, copper, x + dx, dy, z + 0.79)
          );
      this.inverterGroup.add(
        box(0.42, 0.6, 0.5, dark, x + 1.1, 0.42, z + 0.75)
      );
      this.inverterGroup.add(
        cylinderBetween(
          [x - 0.9, 0.51, z + 0.8],
          [x - 0.9, 0.08, z + 1.7],
          0.075,
          dark
        )
      );
    }
    // Generator radiator matrix, acoustical shell, hinged side doors, nameplates,
    // inlet louvres and CAT-style exhaust stack / mushroom rain cap.
    this.gensetGroup.add(box(9.45, 0.31, 4.95, dark, 29, 4.5, 11));
    this.gensetGroup.add(
      box(4.05, 2.83, 0.09, paint(0xd2d4ba, 0.24, 0.42), 27.12, 2.38, 13.39)
    );
    this.gensetGroup.add(
      box(3.79, 2.83, 0.1, paint(0xc8ceb8, 0.2, 0.43), 31.3, 2.38, 13.39)
    );
    this.gensetGroup.add(box(0.07, 2.7, 0.1, dark, 29, 2.38, 13.46));
    for (let i = 0; i < 17; i++) {
      this.gensetGroup.add(
        box(0.09, 2.2, 0.1, dark, 25.5 + i * 0.31, 2.2, 13.49)
      );
    }
    this.gensetGroup.add(box(2.45, 1.65, 0.11, dark, 32, 2.06, 13.49));
    for (let i = 0; i < 14; i++)
      this.gensetGroup.add(
        box(2.28, 0.05, 0.06, rail, 32, 1.39 + i * 0.106, 13.58)
      );
    for (let j = 0; j < 5; j++)
      this.gensetGroup.add(
        box(0.16, 0.17, 0.07, dark, 25.3 + j * 0.9, 3.13, 13.58)
      );
    this.gensetGroup.add(box(2.02, 0.62, 0.08, warning, 26.8, 3.96, 13.56));
    this.gensetGroup.add(box(1.11, 0.24, 0.1, dark, 26.9, 3.95, 13.62));
    const exhaustCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.42, 14),
      dark
    );
    exhaustCap.position.set(32.2, 7.18, 10.1);
    this.gensetGroup.add(exhaustCap);
    this.gensetGroup.add(cyl(0.08, 0.22, copper, 32.2, 7.48, 10.1));
    // Vertical wellhead / Christmas-tree-inspired pressure-rated abstraction,
    // VSD cabinet screens, flanged flowline, and anti-slip service walkway.
    const mainPipe = paint(0x4f9b87, 0.62, 0.35);
    for (const height of [2.5, 3.4, 4.15]) {
      this.espGroup.add(cyl(0.75, 0.19, copper, 29, height, 26));
      for (let j = 0; j < 8; j++) {
        const theta = (j * Math.PI) / 4;
        this.espGroup.add(
          cyl(
            0.055,
            0.1,
            dark,
            29 + 0.64 * Math.cos(theta),
            height + 0.15,
            26 + 0.64 * Math.sin(theta)
          )
        );
      }
    }
    this.espGroup.add(
      cylinderBetween([29, 3.4, 26], [29, 5.7, 26], 0.22, mainPipe)
    );
    const valveWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.57, 0.075, 8, 20),
      warning
    );
    valveWheel.rotation.x = Math.PI / 2;
    valveWheel.position.set(29, 5.32, 26);
    this.espGroup.add(valveWheel);
    this.espGroup.add(
      cylinderBetween([29, 5.32, 26], [29, 5.32, 25.3], 0.07, rail)
    );
    for (const xx of [31.5, 32.6])
      this.espGroup.add(
        cylinderBetween([xx, 3.56, 26], [xx, 2.9, 26], 0.27, mainPipe)
      );
    this.espGroup.add(
      box(2.48, 2.63, 0.11, paint(0xdce8e2, 0.2, 0.44), 24, 1.92, 26.89)
    );
    this.espGroup.add(box(0.98, 0.48, 0.12, screen, 24, 2.6, 26.98));
    this.espGroup.add(box(1.36, 0.11, 0.1, signal, 24, 3.03, 27.0));
    for (let i = 0; i < 8; i++)
      this.espGroup.add(box(1.75, 0.045, 0.08, dark, 24, 1.15 + i * 0.1, 27.0));
    this.espGroup.add(box(0.18, 1.2, 0.18, rail, 25.15, 2.1, 27.0));
    // Distribution assembly and three-pole protective incomer breaker.
    const switchboard = this.register(new THREE.Group(), 'esp');
    this.hardware.add(switchboard);
    switchboard.add(box(4.3, 3.45, 2.5, concrete, 20.6, 1.92, 3));
    switchboard.add(
      box(3.95, 2.9, 0.065, paint(0xbccdcc, 0.24, 0.4), 20.6, 1.95, 4.28)
    );
    switchboard.add(box(0.1, 3.08, 0.09, dark, 20.6, 1.97, 4.36));
    switchboard.add(box(0.95, 0.49, 0.1, screen, 19.7, 2.48, 4.38));
    for (let i = 0; i < 3; i++) {
      switchboard.add(box(0.19, 0.41, 0.1, dark, 20.0 + i * 0.58, 1.5, 4.39));
      switchboard.add(
        box(0.065, 0.22, 0.11, signal, 20.0 + i * 0.58, 1.51, 4.48)
      );
    }
    const swLabel = labelSprite('LV MICROGRID SWITCHGEAR', '#b5efe0');
    swLabel.position.set(20.6, 5.65, 3);
    switchboard.add(swLabel);
    // Physical cable infrastructure: cable trays, support posts and rigid conduits
    // based on the equipment arrangement shown in the supplier SLD / datasheets.
    this.physicalCables = new THREE.Group();
    this.hardware.add(this.physicalCables);
    // Lidded/open-top ladder cable tray runs, individual conductors, rigid metallic
    // conduit risers and concrete supports. The geometry is *illustrative*, not a
    // route survey, cable schedule or hazardous-area installation specification.
    const cableMats = {
      dc: paint(0x396e84, 0.35, 0.35),
      pvac: paint(0x5b9f98, 0.35, 0.36),
      ess: paint(0x526d84, 0.35, 0.36),
      ac: paint(0x977155, 0.35, 0.4),
      load: paint(0x879ca7, 0.35, 0.34),
    };
    const trayMat = paint(0x2d4248, 0.72, 0.38),
      trayRail = paint(0x839397, 0.67, 0.35),
      conduitMat = paint(0x99a6a8, 0.58, 0.38);
    const cableRoutes = FLOW_ROUTES;
    this.cableRoutes = [];
    for (const route of cableRoutes) {
      const path = route.pts.map(q => new THREE.Vector3(...q));
      const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
      const length = curve.getLength(),
        segments = Math.max(16, Math.ceil(length * 3));
      // Straight tray pieces with 3-dimensional side rails and cross-rungs, not a floating tube.
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i],
          v = b.clone().sub(a),
          direction = v.clone().normalize();
        const len = v.length();
        const side = new THREE.Vector3(
          -direction.z,
          0,
          direction.x
        ).normalize();
        const middle = a.clone().add(b).multiplyScalar(0.5);
        const angle = Math.atan2(v.z, v.x);
        const plate = box(
          len,
          0.052,
          0.61,
          trayMat,
          middle.x,
          middle.y - 0.1,
          middle.z
        );
        plate.rotation.y = -angle;
        this.physicalCables.add(plate);
        for (const sign of [-1, 1]) {
          const railSide = box(
            len,
            0.22,
            0.055,
            trayRail,
            middle.x + sign * side.x * 0.295,
            middle.y + 0.045,
            middle.z + sign * side.z * 0.295
          );
          railSide.rotation.y = -angle;
          this.physicalCables.add(railSide);
        }
        const n = Math.max(2, Math.round(len / 2.0));
        for (let j = 0; j <= n; j++) {
          const t = j / n,
            loc = a.clone().lerp(b, t);
          const rung = box(
            0.065,
            0.047,
            0.59,
            trayRail,
            loc.x,
            loc.y - 0.052,
            loc.z
          );
          rung.rotation.y = -angle;
          this.physicalCables.add(rung);
        }
      }
      const wires = [];
      for (let phase = 0; phase < 3; phase++) {
        const pp = path.map(
          q =>
            new THREE.Vector3(
              q.x + (phase - 1) * 0.095,
              q.y + 0.086,
              q.z + (phase - 1) * 0.058
            )
        );
        const mat = new THREE.MeshStandardMaterial({
          color: cableMats[route.kind].color,
          metalness: 0.22,
          roughness: 0.42,
          emissive: 0x000000,
          emissiveIntensity: 0,
        });
        const conductor = new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(pp, false, 'centripetal'),
            segments,
            0.047,
            8,
            false
          ),
          mat
        );
        conductor.castShadow = true;
        this.physicalCables.add(conductor);
        wires.push(conductor);
      }
      for (
        let t = 0.04;
        t < 0.99;
        t += 1 / Math.max(7, Math.floor(length / 2.9))
      ) {
        const pt = curve.getPointAt(t);
        const plinth = box(0.52, 0.07, 0.52, concrete, pt.x, pt.y - 0.31, pt.z);
        const pedestal = box(
          0.105,
          0.18,
          0.105,
          trayRail,
          pt.x,
          pt.y - 0.19,
          pt.z
        );
        this.physicalCables.add(plinth, pedestal);
      }
      for (const drop of route.drops) {
        const a = [drop[0], drop[1], drop[2]],
          b = [drop[0], route.pts[0][1] + 0.1, drop[2]];
        const riser = cylinderBetween(a, b, 0.073, conduitMat);
        this.physicalCables.add(riser);
        const gland = box(
          0.2,
          0.075,
          0.2,
          trayRail,
          drop[0],
          b[1] + 0.06,
          drop[2]
        );
        this.physicalCables.add(gland);
      }
      this.cableRoutes.push({
        id: route.id,
        kind: route.kind,
        source: route.source,
        target: route.target,
        curve,
        segments,
        nominalKw: route.nominalKw,
        defaultColor: route.glow,
        wires,
      });
    }
    this.hardware.add(box(9, 0.12, 1.4, concrete, 28.9, -0.01, -9));
    for (const z of [-6.2, 2.8, 7.2]) {
      this.hardware.add(box(11, 0.09, 0.36, rail, 28.8, 0.15, z));
    }
    // The field combiner trunk feeds the DC input of the PV inverter; the AC output
    // is routed separately to the LV switchboard. These are not a single reversible path.
    const dcBox = box(
      1.1,
      1.2,
      0.65,
      paint(0xe1e5df, 0.2, 0.43),
      13.3,
      0.65,
      -23
    );
    const dcDoor = box(
      0.94,
      1.03,
      0.055,
      paint(0x193c47, 0.23, 0.45),
      13.3,
      0.67,
      -22.63
    );
    this.hardware.add(dcBox, dcDoor);
    for (let p = 0; p < 3; p++)
      this.hardware.add(
        box(
          0.18,
          0.07,
          0.08,
          paint(0x88ddeb, 0.12, 0.45),
          13.01 + p * 0.29,
          1.02,
          -22.58
        )
      );
    const dcMarker = labelSprite('PV DC COLLECTION / CONCEPTUAL', '#95dffd');
    dcMarker.position.set(11.5, 3, -22);
    dcMarker.scale.set(6.0, 1.3, 1);
    this.hardware.add(dcMarker);
    // AC inverter outlet and LV switchboard incoming section; colors denote paths only,
    // not a certified hazardous-area cable classification.
    for (const [x, z, color] of [
      [24.5, -4.06, 0x6fd9d3],
      [20.8, 4.45, 0x6fd9d3],
      [23.1, 3.9, 0xffb45f],
    ]) {
      this.hardware.add(
        box(0.7, 0.15, 0.1, new THREE.MeshBasicMaterial({ color }), x, 1.12, z)
      );
    }

    this.leds = this.batteryIndicators;
  }
  makePrecisionDetails() {
    // Design references: Huawei LUNA2000-161-2S11, Huawei SUN2000-150K-MG0,
    // Caterpillar 3406C and Jinko Tiger Neo 650 Wp reference sheets. Geometry is
    // deliberately illustrative, not exact vendor CAD geometry or an as-built.
    const powder = new THREE.MeshStandardMaterial({
      color: 0xd8e4e0,
      metalness: 0.22,
      roughness: 0.39,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: 0x536e71,
      metalness: 0.79,
      roughness: 0.29,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x16262c,
      metalness: 0.35,
      roughness: 0.44,
    });
    const black = new THREE.MeshStandardMaterial({
      color: 0x101a20,
      metalness: 0.27,
      roughness: 0.44,
    });
    const amber = new THREE.MeshStandardMaterial({
      color: 0xd8a147,
      metalness: 0.34,
      roughness: 0.44,
    });
    const cool = new THREE.MeshBasicMaterial({ color: 0x64edbe });
    const pale = new THREE.MeshBasicMaterial({ color: 0x87def6 });
    const stroke = (a, b, r, mat) => {
      const start = new THREE.Vector3(...a),
        end = new THREE.Vector3(...b);
      const d = end.clone().sub(start);
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, d.length(), 10),
        mat
      );
      pipe.position.copy(start).add(end).multiplyScalar(0.5);
      pipe.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize()
      );
      pipe.castShadow = true;
      return pipe;
    };
    // LUNA2000-inspired tall white ESS with rectangular intake, top green status bar,
    // detachable modules, bottom forklift skids, cooling fans and access hinges.
    for (let unit = 0; unit < 3; unit++) {
      const x = 24.7 + unit * 4.3,
        z = -16;
      this.bessGroup.add(box(2.45, 0.09, 0.115, dark, x, 4.6, z + 1.785));
      this.bessGroup.add(box(1.54, 0.065, 0.115, cool, x, 4.6, z + 1.852));
      this.bessGroup.add(
        box(1.15, 2.43, 0.08, dark, x - 0.46, 2.52, z + 1.807)
      );
      for (let j = 0; j < 14; j++)
        this.bessGroup.add(
          box(1.02, 0.046, 0.092, steel, x - 0.46, 1.38 + j * 0.174, z + 1.863)
        );
      for (const sy of [1.22, 3.92])
        this.bessGroup.add(
          box(0.11, 0.1, 0.105, steel, x + 1.32, sy, z + 1.89)
        );
      this.bessGroup.add(box(2.82, 0.19, 0.1, steel, x, 0.69, z + 1.82));
      for (let k = 0; k < 2; k++)
        this.bessGroup.add(
          box(0.64, 0.18, 2.2, dark, x + (k ? 1.13 : -1.13), 0.34, z)
        );
      this.bessGroup.add(
        box(0.55, 0.18, 0.14, amber, x + 1.01, 1.18, z + 1.887)
      );
      const cooling = box(1.9, 1.12, 0.06, steel, x, 2.05, z - 1.77);
      this.bessGroup.add(cooling);
      for (let j = 0; j < 11; j++)
        this.bessGroup.add(
          box(1.62, 0.025, 0.08, dark, x, 1.57 + j * 0.092, z - 1.84)
        );
    }

    // Perimeter fencing, low plinths and a service lane lift the scene beyond a flat schematic.
    const fenceMat = new THREE.MeshStandardMaterial({
      color: 0x5f7d76,
      metalness: 0.52,
      roughness: 0.52,
    });
    this.hardware.add(box(76, 0.04, 3.2, black, 0, 0.03, 15.8));
    for (const sx of [-38, 38]) {
      for (let i = 0; i < 11; i++) {
        const z = -33 + i * 6.0;
        this.hardware.add(box(0.08, 1.15, 0.08, fenceMat, sx, 0.58, z));
        if (i < 10)
          this.hardware.add(box(0.05, 0.05, 6.0, fenceMat, sx, 1.08, z + 3.0));
      }
    }
    for (const sz of [-35, 27]) {
      for (let i = 0; i < 15; i++) {
        const x = -35 + i * 5.1;
        this.hardware.add(box(0.08, 1.15, 0.08, fenceMat, x, 0.58, sz));
        if (i < 14)
          this.hardware.add(box(5.1, 0.05, 0.05, fenceMat, x + 2.55, 1.08, sz));
      }
    }
    // Inverter front human-machine interface, isolated AC connectors, cooling ribs.
    for (let i = 0; i < 3; i++) {
      const x = 24.5 + i * 4.5,
        z = -5;
      this.inverterGroup.add(box(2.43, 0.135, 0.083, steel, x, 3.3, z + 0.79));
      this.inverterGroup.add(box(1.8, 0.047, 0.085, pale, x, 3.33, z + 0.833));
      this.inverterGroup.add(box(1.24, 0.55, 0.115, dark, x, 2.34, z + 0.79));
      this.inverterGroup.add(box(0.59, 0.18, 0.12, cool, x, 2.34, z + 0.852));
      for (let j = 0; j < 10; j++)
        this.inverterGroup.add(
          box(1.9, 0.055, 0.078, dark, x, 1.28 + j * 0.115, z + 0.808)
        );
      for (let j = 0; j < 6; j++)
        this.inverterGroup.add(
          box(0.13, 0.66, 0.3, steel, x - 1.47 + j * 0.45, 2.86, z - 0.71)
        );
      for (let k = 0; k < 3; k++)
        this.inverterGroup.add(
          stroke(
            [x - 0.55 + k * 0.55, 0.5, z + 0.55],
            [x - 0.55 + k * 0.55, 0.12, z + 1.11],
            0.072,
            black
          )
        );
    }
    // Containerized genset skid, CAT-inspired acoustic enclosure, air intake and
    // vertical exhaust/silencer. Lights correspond to running state.
    for (let side of [-1, 1]) {
      const y = 1.18;
      for (let j = 0; j < 4; j++)
        this.gensetGroup.add(
          box(1.3, 0.16, 0.12, steel, 26.1 + j * 1.88, y, 11 + side * 2.53)
        );
    }
    this.gensetGroup.add(box(3.65, 0.14, 0.1, amber, 27.0, 3.72, 13.62));
    this.gensetGroup.add(box(1.55, 0.49, 0.11, dark, 27.1, 3.5, 13.7));
    this.gensetGroup.add(
      box(
        0.32,
        0.24,
        0.14,
        new THREE.MeshBasicMaterial({ color: 0xffc369 }),
        27.8,
        3.49,
        13.8
      )
    );
    for (let j = 0; j < 18; j++)
      this.gensetGroup.add(
        box(0.085, 1.27, 0.1, dark, 25.6 + j * 0.36, 2.34, 8.64)
      );
    this.gensetGroup.add(box(0.54, 1.02, 0.55, steel, 32.2, 6.82, 10.1));
    this.gensetGroup.add(
      stroke([31.7, 5.0, 10.1], [32.25, 6.53, 10.1], 0.13, steel)
    );
    for (const z of [8.82, 13.12])
      this.gensetGroup.add(box(10.2, 0.075, 0.07, amber, 29, 0.15, z));
    // ESP / VSD station: capped joints, lateral valves, cable protective risers.
    for (const h of [2.84, 3.72, 4.38]) {
      this.espGroup.add(
        stroke([29 - 0.38, h, 26], [29 + 0.38, h, 26], 0.075, steel)
      );
      for (const sign of [-1, 1])
        this.espGroup.add(cyl(0.12, 0.09, amber, 29 + sign * 0.42, h, 26));
    }
    this.espGroup.add(box(1.65, 0.14, 0.085, dark, 24, 3.18, 27.05));
    this.espGroup.add(box(0.54, 0.15, 0.09, pale, 24, 3.17, 27.1));
    this.espGroup.add(
      stroke([24.45, 0.5, 26.8], [24.45, 0.26, 27.5], 0.09, steel)
    );
    this.espGroup.add(stroke([29, 4.5, 26], [29, 5.65, 26], 0.11, steel));
    // Painted maintenance strips and bollards; conceptual layout only.
    const yellow = new THREE.MeshStandardMaterial({
      color: 0xe5bd63,
      roughness: 0.86,
    });
    for (let i = 0; i < 9; i++) {
      this.hardware.add(
        box(0.25, 0.016, 0.78, yellow, 22.9 + i * 0.85, -0.091, 0.75)
      );
      this.hardware.add(
        box(0.25, 0.016, 0.78, yellow, 22.9 + i * 0.85, -0.091, 17.3)
      );
    }
    for (const [x, z] of [
      [19.0, 1.7],
      [19.0, 4.5],
      [23, 18],
      [32.7, 19],
    ]) {
      this.hardware.add(cyl(0.11, 0.98, steel, x, 0.42, z));
      this.hardware.add(cyl(0.13, 0.12, amber, x, 0.88, z));
    }
    // Warm low-level luminaires indicate nighttime site access. A few lights are
    // preferred over a costly volumetric/postprocessing pass on mobile devices.
    this.siteLights = [];
    for (const [x, z] of [
      [16, -13],
      [35, -9],
      [18, 12],
      [36, 23],
    ]) {
      const pole = stroke([x, -0.1, z], [x, 5.5, z], 0.11, steel);
      this.hardware.add(pole);
      const arm = stroke([x, 5.48, z], [x + 0.65, 5.48, z], 0.095, steel);
      this.hardware.add(arm);
      const luminaire = box(0.75, 0.13, 0.36, powder, x + 0.8, 5.43, z);
      this.hardware.add(luminaire);
      const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a1 });
      const glass = box(0.58, 0.035, 0.22, glow, x + 0.8, 5.34, z);
      this.hardware.add(glass);
      this.siteLights.push(glass);
    }
  }
  makeSolarArray(mode) {
    if (this.pvGroup) {
      this.scene.remove(this.pvGroup);
      // Reclaim array-local GPU allocations on every design switch.
      // Globally shared hardware materials are kept alive.
      const freed = new Set();
      this.pvGroup.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const mat of materials) {
          if (mat === panelDark || mat === metal || mat === white || mat === graphite || freed.has(mat)) continue;
          freed.add(mat);
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      });
      this.assetObjects = this.assetObjects.filter(o => o !== this.pvGroup);
    }
    this.pvGroup = this.register(new THREE.Group(), 'pv');
    this.scene.add(this.pvGroup);
    const rows = mode === 'supplier' ? 13 : 12;
    const cols = mode === 'supplier' ? 54 : 39;
    const count = rows * cols; // 702 vendor option / 468 feasibility illustration.
    // Jinko 2382 x 1134 x 30 mm has 2.1005 length/width ratio.
    // 0.86 x 1.806 is a uniform conceptual scale of those *one-piece flat modules*.
    const moduleW = 0.86,
      moduleL = 1.806,
      pitch = mode === 'supplier' ? 0.91 : 1.15;
    const frameGeo = new THREE.BoxGeometry(moduleW, 0.034, moduleL);
    const faceGeo = new THREE.PlaneGeometry(moduleW - 0.056, moduleL - 0.056);
    // PlaneGeometry is XY by default; BoxGeometry's front glazing is XZ.
    // Rotate the glass into the horizontal XZ local plane BEFORE both are tilted.
    faceGeo.rotateX(-Math.PI / 2);
    // Diffuse anti-glare glass, consistent across every instance and every camera angle.
    const faceMat = new THREE.MeshLambertMaterial({
      map: panelTexture(),
      color: 0xdae7ef,
      emissive: 0x061525,
      emissiveIntensity: 0.23,
      side: THREE.DoubleSide,
    });
    const frames = new THREE.InstancedMesh(frameGeo, panelDark, count);
    const faces = new THREE.InstancedMesh(faceGeo, faceMat, count);
    frames.castShadow = true;
    frames.receiveShadow = false;
    faces.castShadow = false;
    faces.receiveShadow = false;
    const mount = new THREE.Object3D();
    let id = 0;
    const tilt = (25 * Math.PI) / 180; // illustrative rack tilt, not site-approved setting.
    const left = -28,
      top = -26,
      tableY = 1.25,
      rowStep = 3.65;
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x556b70,
      metalness: 0.26,
      roughness: 0.72,
    });
    const darkFixings = new THREE.MeshStandardMaterial({
      color: 0x263e49,
      metalness: 0.24,
      roughness: 0.72,
    });
    const halfSpan = Math.sin(tilt) * 0.56;
    for (let row = 0; row < rows; row++) {
      const z = top + row * rowStep;
      const centerX = left + ((cols - 1) * pitch) / 2,
        rowWidth = (cols - 1) * pitch + moduleW;
      // Two structural girts track the same slope as the module, safely underneath glazing.
      for (const localZ of [-0.56, 0.56]) {
        const y = tableY + Math.sin(tilt) * localZ - 0.12;
        const rail = box(
          rowWidth,
          0.075,
          0.13,
          legMat,
          centerX,
          y,
          z + Math.cos(tilt) * localZ
        );
        this.pvGroup.add(rail);
      }
      for (const c of [1, Math.floor(cols / 2), cols - 2]) {
        const x = left + c * pitch;
        for (const localZ of [-0.56, 0.56]) {
          const ry = tableY + Math.sin(tilt) * localZ - 0.12;
          const rz = z + Math.cos(tilt) * localZ;
          this.pvGroup.add(
            box(0.12, ry - 0.03, 0.12, legMat, x, (ry - 0.03) / 2, rz)
          );
          this.pvGroup.add(box(0.45, 0.11, 0.45, darkFixings, x, 0.02, rz));
        }
        // Cross brace under the panel; never emerges through the front glass.
        const cross = box(0.07, 0.055, 1.17, legMat, x, tableY - 0.27, z);
        cross.rotation.x = -tilt;
        this.pvGroup.add(cross);
      }
      for (let col = 0; col < cols; col++) {
        mount.position.set(left + col * pitch, tableY, z);
        mount.rotation.set(-tilt, 0, 0);
        mount.updateMatrix();
        frames.setMatrixAt(id, mount.matrix);
        // Front glass just above the aluminum rim in the same local XZ plane.
        mount.position.y += Math.cos(tilt) * 0.019;
        mount.position.z -= Math.sin(tilt) * 0.019;
        mount.updateMatrix();
        faces.setMatrixAt(id, mount.matrix);
        id++;
      }
      // Low-profile terminal box outside the array's east edge.
      const x = left + (cols - 1) * pitch + 1.15;
      this.pvGroup.add(box(0.52, 0.55, 0.42, legMat, x, 0.38, z));
      this.pvGroup.add(box(0.42, 0.43, 0.035, darkFixings, x, 0.39, z + 0.229));
    }
    frames.instanceMatrix.needsUpdate = true;
    faces.instanceMatrix.needsUpdate = true;
    this.pvGroup.add(frames, faces);
    // Continuous site terrain; rack supports and cable trays remain underneath PV rows.
    const tag = labelSprite(
      mode === 'supplier' ? 'PV FIELD / 702 MODULES' : 'PV FIELD / 468 MODULES',
      '#9fdaf5'
    );
    tag.position.set(-15, 5, -29);
    tag.scale.set(8.0, 1.62, 1);
    this.pvGroup.add(tag);
    this.pvGroup.userData.mode = mode;
    this.mode = mode;
    // Hide the *entire* third PV inverter in the two-inverter financial illustration;
    // previous children.slice(8,12) hid only a few disconnected decorative meshes.
    this.inverterGroup.children.forEach(o => {
      if (o.type === 'Sprite') return;
      o.visible = mode === 'supplier' || o.position.x < 31.25;
    });
    if (this.premiumReady) this.decoratePremiumPV();
  }

  /** Small anodized clamps and under-array DC string runs on each solar table. */
  decoratePremiumPV() {
    if (!this.pvGroup || this.pvGroup.userData.premiumDone) return;
    const rows = this.mode === 'supplier' ? 13 : 12;
    const cols = this.mode === 'supplier' ? 54 : 39,
      pitch = this.mode === 'supplier' ? 0.91 : 1.15;
    const geo = new THREE.BoxGeometry(0.075, 0.043, 0.13);
    const material = new THREE.MeshStandardMaterial({
      color: 0x304754,
      metalness: 0.21,
      roughness: 0.78,
    });
    const mesh = new THREE.InstancedMesh(geo, material, rows * cols * 2);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let r = 0; r < rows; r++) {
      const z = -26 + r * 3.65;
      for (let c = 0; c < cols; c++)
        for (const sign of [-1, 1]) {
          dummy.position.set(
            -28 + c * pitch + sign * 0.426,
            1.25 + Math.cos((25 * Math.PI) / 180) * 0.01,
            z - Math.sin((25 * Math.PI) / 180) * 0.01
          );
          dummy.rotation.set((-25 * Math.PI) / 180, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(n++, dummy.matrix);
        }
      const harness = box(
        (cols - 1) * pitch + 0.7,
        0.022,
        0.035,
        graphite,
        -28 + ((cols - 1) * pitch) / 2,
        0.45,
        z - 0.54
      );
      this.pvGroup.add(harness);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    this.pvGroup.add(mesh);
    this.pvGroup.userData.premiumDone = true;
  }
  /** Extra scene realism is decorative; never feeds into the power calculation. */
  makePremiumDetails() {
    const material = (color, metalness = 0.38, roughness = 0.5) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const steel = material(0x889e9e, 0.83, 0.29);
    const dark = material(0x1b3239, 0.6, 0.43);
    const pale = material(0xd8e5e1, 0.2, 0.34);
    const amber = material(0xe8c173, 0.3, 0.44);
    const add = (parent, w, h, d, mat, x, y, z) => {
      const m = box(w, h, d, mat, x, y, z);
      parent.add(m);
      return m;
    };
    const tag = (header, sub, color = '#9be8d7') => {
      const c = document.createElement('canvas');
      c.width = 420;
      c.height = 132;
      const g = c.getContext('2d');
      g.fillStyle = 'rgba(10,27,34,.94)';
      g.fillRect(0, 0, 420, 132);
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.strokeRect(1, 1, 418, 130);
      g.fillStyle = color;
      g.fillRect(0, 0, 6, 132);
      g.font = '600 21px Arial';
      g.fillText(sub, 23, 43);
      g.fillStyle = '#f4ffff';
      g.font = '700 34px Arial';
      g.fillText(header, 23, 96);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
        })
      );
      sp.scale.set(1.9, 0.59, 1);
      return sp;
    };
    // Single continuous, neutral sandstone material with procedural wind ripples
    // and multi-scale grain. This texture applies ONLY to the main ground mesh.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const g = canvas.getContext('2d');
    g.fillStyle = '#cbbd9f';
    g.fillRect(0, 0, 512, 512);
    let seed = 20261106;
    const rnd = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 17500; i++) {
      g.fillStyle =
        rnd() > 0.55 ? 'rgba(246,232,197,.16)' : 'rgba(85,76,60,.12)';
      const x = rnd() * 512,
        y = rnd() * 512,
        r = 0.35 + rnd() * 2.1;
      g.fillRect(x, y, r, r);
    }
    for (let i = 0; i < 120; i++) {
      const y = rnd() * 512,
        osc = 3 + rnd() * 7;
      g.strokeStyle = 'rgba(111,96,70,.043)';
      g.lineWidth = 0.45 + rnd() * 0.75;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(130, y + osc, 285, y - osc, 512, y + osc * 0.4);
      g.stroke();
    }
    for (let i = 0; i < 38; i++) {
      const x = rnd() * 512,
        y = rnd() * 512,
        r = 4 + rnd() * 16;
      const shade = g.createRadialGradient(x, y, 0, x, y, r);
      shade.addColorStop(0, 'rgba(114,100,79,.065)');
      shade.addColorStop(1, 'rgba(114,100,79,0)');
      g.fillStyle = shade;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const gravel = new THREE.CanvasTexture(canvas);
    gravel.colorSpace = THREE.SRGBColorSpace;
    gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping;
    gravel.repeat.set(7, 6);
    gravel.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    const groundMesh = this.scene.getObjectByName(
      'Continuous natural Western Desert terrain'
    );
    if (groundMesh) {
      groundMesh.material.map = gravel;
      groundMesh.material.color.setHex(0xe0d6c5);
      groundMesh.material.needsUpdate = true;
    }
    // Two subtle wheel ruts show vehicle access between the PV field and cabinets.
    // They sit on the sand; there is no large concrete slab under the solar modules.
    const tyre = material(0x96876c, 0, 1);
    tyre.transparent = true;
    tyre.opacity = 0.4;
    for (const x of [11.0, 13.25])
      add(this.hardware, 0.21, 0.018, 27, tyre, x, -0.153, -1);
    // Huawei LUNA2000-inspired cabinet frontage with vent towers and active state strip.
    this.premiumBatteryLEDs = [];
    this.premiumInverterLEDs = [];
    for (let i = 0; i < 3; i++) {
      const x = 24.7 + i * 4.3,
        z = -16;
      add(this.bessGroup, 3.15, 0.105, 0.1, steel, x, 4.57, z + 1.81);
      for (const dx of [-1.02, 0.76]) {
        add(this.bessGroup, 0.86, 2.42, 0.1, dark, x + dx, 2.46, z + 1.85);
        for (let n = 0; n < 17; n++)
          add(
            this.bessGroup,
            0.75,
            0.045,
            0.075,
            steel,
            x + dx,
            1.42 + n * 0.13,
            z + 1.93
          );
      }
      add(this.bessGroup, 0.065, 3.47, 0.075, steel, x, 2.57, z + 1.87);
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x65efc5,
        emissive: 0x65efc5,
        emissiveIntensity: 1.3,
      });
      this.premiumBatteryLEDs.push(
        add(this.bessGroup, 1.68, 0.076, 0.087, ledMat, x, 4.53, z + 1.92)
      );
      const label = tag(
        'ESS ' + String(i + 1).padStart(2, '0'),
        'SMART ENERGY STORAGE'
      );
      label.position.set(x, 3.62, z + 1.96);
      this.bessGroup.add(label);
    }
    // SUN2000-150K inspired smooth white face, central indicator and cable glands.
    for (let i = 0; i < 3; i++) {
      const x = 24.5 + i * 4.5,
        z = -5;
      add(this.inverterGroup, 3.0, 2.7, 0.13, pale, x, 2.1, z + 1.01);
      add(this.inverterGroup, 0.95, 0.33, 0.1, dark, x, 2.22, z + 1.12);
      for (const dx of [-1.34, 0, 1.34])
        for (const yy of [0.88, 3.34])
          add(
            this.inverterGroup,
            0.075,
            0.075,
            0.065,
            steel,
            x + dx,
            yy,
            z + 1.12
          );
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x65e8ce,
        emissive: 0x65e8ce,
        emissiveIntensity: 1.4,
      });
      this.premiumInverterLEDs.push(
        add(
          this.inverterGroup,
          0.18,
          0.06,
          0.045,
          ledMat,
          x + 0.37,
          2.25,
          z + 1.18
        )
      );
      const label = tag('150K-MG0', 'PV CONTROLLER', '#9dd8ee');
      label.position.set(x, 3.91, z + 1.16);
      label.scale.set(1.5, 0.47, 1);
      this.inverterGroup.add(label);
    }
    // CAT-inspired radiator fan cowls, steel access ribs and running indicator.
    for (const x of [26.9, 31.4]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.68, 0.075, 8, 26),
        dark
      );
      ring.position.set(x, 2.54, 13.72);
      this.gensetGroup.add(ring);
      for (let j = 0; j < 6; j++) {
        const fan = add(
          this.gensetGroup,
          0.1,
          0.58,
          0.05,
          steel,
          x,
          2.54,
          13.75
        );
        fan.rotation.z = (j * Math.PI) / 3;
      }
    }
    for (let i = 0; i < 7; i++)
      add(
        this.gensetGroup,
        0.053,
        1.22,
        0.08,
        steel,
        25.8 + i * 1.1,
        2.13,
        8.64
      );
    const genLED = new THREE.MeshStandardMaterial({
      color: 0x71817d,
      emissive: 0x223a3b,
      emissiveIntensity: 0.3,
    });
    this.premiumDieselLED = add(
      this.gensetGroup,
      0.5,
      0.2,
      0.086,
      genLED,
      30.1,
      4.27,
      13.7
    );
    // Wellhead flange stud circle and refined VSD cooling grille.
    for (let i = 0; i < 8; i++)
      add(this.espGroup, 1.71, 0.038, 0.078, dark, 24, 1.17 + i * 0.15, 27.03);
    for (const h of [3.34, 4.24, 4.75]) {
      this.espGroup.add(cyl(0.8, 0.12, steel, 29, h, 26));
      for (let a = 0; a < 8; a++) {
        const rad = (a * Math.PI) / 4;
        this.espGroup.add(
          cyl(
            0.057,
            0.1,
            amber,
            29 + 0.7 * Math.cos(rad),
            h + 0.13,
            26 + 0.7 * Math.sin(rad)
          )
        );
      }
    }
    // Warm-site safety lighting linked only to the displayed virtual clock.
    this.premiumLamps = [];
    const positions = [
      [16, -13],
      [35, -9],
      [18, 12],
      [36, 23],
    ];
    positions.forEach(([x, z], index) => {
      if (window.innerWidth <= 690 && index % 2) return;
      const l = new THREE.PointLight(0xffd09a, 0, 18, 2);
      l.position.set(x + 0.8, 5.18, z);
      this.scene.add(l);
      this.premiumLamps.push(l);
    });
    this.premiumReady = true;
    this.decoratePremiumPV();
  }

  makeFlow() {
    // Emissive current-direction traces are placed inside a translucent conduit on
    // the installed conceptual cable-tray centreline. Additive shells improve wide
    // zoom readability without suggesting actual cables radiate light.
    this.energyFlowGroup = new THREE.Group();
    this.hardware.add(this.energyFlowGroup);
    this.pulses = [];
    for (const route of this.cableRoutes) {
      const lightCurve = new THREE.CatmullRomCurve3(
        route.curve.points.map(q =>
          q.clone().add(new THREE.Vector3(0, 0.2, 0))
        ),
        false,
        'centripetal'
      );
      const shell = new THREE.Mesh(
        new THREE.TubeGeometry(lightCurve, route.segments, 0.19, 10, false),
        new THREE.MeshPhysicalMaterial({
          color: 0x223742,
          metalness: 0.1,
          roughness: 0.16,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      shell.renderOrder = 2;
      this.physicalCables.add(shell); // always visible even when FX hidden
      const halo = new THREE.Mesh(
        new THREE.TubeGeometry(lightCurve, route.segments, 0.29, 10, false),
        new THREE.MeshBasicMaterial({
          color: route.defaultColor,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      halo.renderOrder = 3;
      this.energyFlowGroup.add(halo);
      const glow = new THREE.Mesh(
        new THREE.TubeGeometry(lightCurve, route.segments, 0.11, 10, false),
        new THREE.MeshBasicMaterial({
          color: route.defaultColor,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.renderOrder = 4;
      this.energyFlowGroup.add(glow);
      const pulses = [];
      for (let i = 0; i < 24; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: route.defaultColor,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        });
        const pulse = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.96, 9),
          mat
        );
        const aura = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 1.38, 10),
          new THREE.MeshBasicMaterial({
            color: route.defaultColor,
            transparent: true,
            opacity: 0.33,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        pulse.add(aura);
        pulse.userData.aura = aura;
        pulse.visible = false;
        pulse.renderOrder = 5;
        this.energyFlowGroup.add(pulse);
        pulses.push(pulse);
      }
      this.pulses.push({
        id: route.id,
        curve: lightCurve,
        samples: lightCurve.getPoints(180),
        nominalKw: route.nominalKw,
        glow,
        halo,
        pulses,
        state: {
          active: false,
          kw: 0,
          color: route.defaultColor,
          direction: 1,
        },
        wires: route.wires,
      });
    }
  }
  setFlowVisible(flag) {
    this.flowVisible = Boolean(flag);
    if (this.energyFlowGroup) this.energyFlowGroup.visible = this.flowVisible;
    for (const flow of this.pulses) {
      const ratio = Math.min(1, flow.state.kw / flow.nominalKw);
      for (const wire of flow.wires)
        wire.material.emissiveIntensity =
          this.flowVisible && flow.state.active ? 0.78 + ratio * 2.4 : 0;
    }
  }
  applyFlowState(id, kw, color, direction = 1) {
    const flow = this.pulses.find(p => p.id === id);
    if (!flow) return;
    flow.state = { active: kw > 0.15, kw: Math.max(0, kw), color, direction };
    const ratio = Math.max(0, Math.min(1, flow.state.kw / flow.nominalKw));
    flow.glow.material.color.setHex(color);
    flow.halo.material.color.setHex(color);
    flow.glow.material.opacity =
      this.flowVisible && flow.state.active ? 0.86 + ratio * 0.46 : 0;
    flow.halo.material.opacity =
      this.flowVisible && flow.state.active ? 0.2 + ratio * 0.26 : 0;
    for (const wire of flow.wires) {
      wire.material.emissive.setHex(color);
      wire.material.emissiveIntensity =
        this.flowVisible && flow.state.active ? 0.78 + ratio * 2.4 : 0;
    }
  }
  makeSun() {
    this.sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(3, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xf2d8a0, fog: false })
    );
    this.scene.add(this.sunOrb);
    this.sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xf7d899,
        transparent: true,
        opacity: 0.33,
      })
    );
    this.sunHalo.scale.set(12, 12, 1);
    this.scene.add(this.sunHalo);
    const dust = new THREE.BufferGeometry();
    const array = [];
    for (let i = 0; i < 280; i++) {
      array.push(
        (Math.sin(i * 73) * 0.5 + 0.5) * 115 - 57,
        Math.sin(i * 61) * 0.45 + 5 + (i % 8),
        (Math.sin(i * 23 + 6) * 0.5 + 0.5) * 85 - 42
      );
    }
    dust.setAttribute('position', new THREE.Float32BufferAttribute(array, 3));
    this.particles = new THREE.Points(
      dust,
      new THREE.PointsMaterial({
        color: 0xb9e9ca,
        size: 0.09,
        transparent: true,
        opacity: 0.28,
      })
    );
    this.scene.add(this.particles);
  }
  setTime(hour) {
    this.hour = hour;
    const solarFactor = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12));
    const bright = Math.max(0, Math.min(1, solarFactor * 1.13));
    const nightColor = new THREE.Color(COLORS.night),
      dayColor = new THREE.Color(COLORS.day);
    const bg = nightColor.clone().lerp(dayColor, bright);
    this.scene.background = bg;
    this.scene.fog.color = bg;
    this.sunOrb.position.set(
      -45 + (hour / 24) * 95,
      3 + Math.max(0, solarFactor) * 50,
      -43
    );
    this.sunHalo.position.copy(this.sunOrb.position);
    this.sunOrb.visible = bright > 0.05;
    this.sunHalo.visible = this.sunOrb.visible;
    this.sunLight.position.copy(this.sunOrb.position);
    this.sunLight.intensity = 1.1 + bright * 4.7;
    this.ambient.intensity = 1.45 + bright * 2.2;
    this.dieselOn = !(hour >= 9.5 && hour < 15);
    this.solarOn = bright > 0.08; // overridden by calculated dispatch
    this.gensetHighlight.material.color.setHex(
      this.dieselOn ? 0xf9c663 : 0x5c6e68
    );
    this.batteryIndicators.forEach(led =>
      led.material.color.setHex(hour >= 9.5 && hour < 15 ? 0x56f2b3 : 0x4c7978)
    );
    this.fill.intensity = 16 + bright * 9;
    if (this.premiumLamps)
      this.premiumLamps.forEach(lamp => {
        lamp.intensity = 0.2 + (1 - bright) * 2.4;
      });
    return {
      solarFactor,
      gensetOn: this.dieselOn,
      batteryState: !this.dieselOn ? 'SUPPORT' : 'STANDBY',
    };
  }
  /** Feed the physically computed dispatch back into the 3D scene and cable pulses. */
  setDispatch(row) {
    if (!row) return;
    this.dieselOn = Boolean(row.dieselOn);
    this.solarOn = row.pvUsed > 0.5;
    this.bessActive = row.charge > 0.05 || row.batteryToLoad > 0.05;
    this.bessDischarge = row.batteryToLoad > 0.05;
    this.gensetHighlight.material.color.setHex(
      this.dieselOn ? 0xf6b84b : 0x3e6f66
    );
    this.batteryIndicators.forEach(led =>
      led.material.color.setHex(
        this.bessDischarge ? 0x6aa8f1 : this.bessActive ? 0x62f9b9 : 0x446a68
      )
    );
    const sunPower = Math.max(0, Math.min(1, row.ghi / 850));
    this.sunLight.intensity = 1.1 + sunPower * 4.7;
    this.ambient.intensity = 1.45 + sunPower * 2.2;
    // Route powers are computed from hourly electrical dispatch (AC-equivalent kW).
    // Do not imply calibrated DC-side measurements or simultaneous DG/PV paralleling.
    const powers = routePowerState(row);
    for (const route of FLOW_ROUTES) {
      const flow = powers[route.id];
      this.applyFlowState(route.id, flow.kw, flow.color, flow.direction);
    }
    if (this.premiumBatteryLEDs) {
      const batteryActive = row.charge > 0.05 || row.batteryToLoad > 0.05;
      const batteryColor =
        row.batteryToLoad > 0.05
          ? 0x7ca5ff
          : row.charge > 0.05
            ? 0x65edc2
            : 0x607b7d;
      for (const led of this.premiumBatteryLEDs) {
        led.material.color.setHex(batteryColor);
        led.material.emissive.setHex(batteryColor);
        led.material.emissiveIntensity = batteryActive ? 1.55 : 0.24;
      }
      for (const led of this.premiumInverterLEDs) {
        const active = row.pvUsed > 0.05;
        led.material.color.setHex(active ? 0x68edd0 : 0x647c7f);
        led.material.emissive.setHex(active ? 0x68edd0 : 0x1d343c);
        led.material.emissiveIntensity = active ? 1.45 : 0.13;
      }
      this.premiumDieselLED.material.color.setHex(
        row.dieselOn ? 0xffc074 : 0x798784
      );
      this.premiumDieselLED.material.emissive.setHex(
        row.dieselOn ? 0xffa744 : 0x243a3c
      );
      this.premiumDieselLED.material.emissiveIntensity = row.dieselOn
        ? 1.8
        : 0.16;
    }
  }
  setMode(mode) {
    if (!['feasibility', 'supplier'].includes(mode)) return;
    this.makeSolarArray(mode);
    // Animation intensity references equipment limits of the chosen *visual* scheme.
    // BESS rating for feasibility is provisional per engineering model assumptions.
    const ratings =
      mode === 'supplier'
        ? { pv_dc: 456, pv_ac: 450, battery: 324, generator: 250, load: 250 }
        : { pv_dc: 304, pv_ac: 300, battery: 150, generator: 250, load: 250 };
    for (const flow of this.pulses)
      flow.nominalKw = ratings[flow.id] || flow.nominalKw;
  }

  stopTour() {
    if (!this.tourActive) return;
    this.tourActive = false;
    if (this.onTourChange) this.onTourChange(false);
  }
  setCameraView(key, fromTour = false) {
    const views = {
      overview: { eye: [57, 43, 68], target: [4, 0, -1] },
      pv: { eye: [-11, 18, 30], target: [-12, 1, -9] },
      bess: { eye: [50, 17, -6], target: [29, 2, -16] },
      power: { eye: [44, 16, 18], target: [24, 1, -2] },
      genset: { eye: [49, 16, 31], target: [29, 2, 11] },
      esp: { eye: [44, 15, 41], target: [29, 3, 25] },
    };
    const p = views[key];
    if (!p) return false;
    if (!fromTour) this.stopTour();
    this.controls.autoRotate = false;
    this.focusTarget = new THREE.Vector3(...p.target);
    this.focusCamera = new THREE.Vector3(...p.eye);
    return true;
  }
  startTour() {
    this.tourSequence = ['overview', 'pv', 'bess', 'power', 'genset', 'esp'];
    this.tourActive = true;
    this.tourIndex = 0;
    this.tourElapsed = 0;
    this.setCameraView(this.tourSequence[0], true);
    if (this.onTourChange) this.onTourChange(true);
  }

  focusAsset(id, sendCallback = false) {
    if (!assetProps[id]) return;
    this.stopTour();
    this.selectedAsset = id;
    this.controls.autoRotate = false;
    this.focusTarget = assetProps[id].target.clone();
    const dir = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize();
    this.focusCamera = assetProps[id].target
      .clone()
      .addScaledVector(dir, assetProps[id].distance);
    if (sendCallback && this.onAssetClick) this.onAssetClick(id);
  }
  resetCamera() {
    this.setCameraView('overview');
    this.controls.autoRotate = true;
  }
  setPaused(pause) {
    this.paused = Boolean(pause);
  }
  animate(now) {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    // Save GPU work while hidden or scrolled offscreen; throttle small screens.
    const rect = this.mount.getBoundingClientRect();
    if (document.hidden || rect.bottom < -120 || rect.top > window.innerHeight + 120) {
      this.last = now;
      return;
    }
    if (window.innerWidth < 700 && now - (this.lastRendered || 0) < 32) return;
    this.lastRendered = now;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (!this.paused) {
      this.elapsed += dt;
      if (this.siteLife) this.siteLife.update(dt);
      if (this.tourActive) {
        this.tourElapsed += dt;
        if (this.tourElapsed >= 6.6) {
          this.tourElapsed = 0;
          this.tourIndex = (this.tourIndex + 1) % this.tourSequence.length;
          this.setCameraView(this.tourSequence[this.tourIndex], true);
        }
      }
      for (const p of this.pulses) {
        const ratio = Math.max(0, Math.min(1, p.state.kw / p.nominalKw));
        const visible = this.flowVisible && p.state.active && ratio > 0.01;
        const activeCount = Math.max(4, Math.round(6 + ratio * 16));
        const speed = (0.16 + ratio * 0.72) * (p.id === 'generator' ? 0.85 : 1);
        p.glow.visible = visible;
        p.halo.visible = visible;
        p.glow.material.opacity = visible ? 0.86 + ratio * 0.46 : 0;
        p.halo.material.opacity = visible ? 0.2 + ratio * 0.26 : 0;
        p.pulses.forEach((pulse, i) => {
          pulse.visible = visible && i < activeCount;
          if (!pulse.visible) return;
          // Sample precomputed, bounded waypoints. Avoid CatmullRom extrapolation at t=1.
          const raw = (this.elapsed * speed + i / activeCount) % 1;
          const phase = Number.isFinite(raw) ? raw : 0;
          const t = Math.max(
            0,
            Math.min(0.999999, p.state.direction > 0 ? phase : 1 - phase)
          );
          const scaled = t * (p.samples.length - 1);
          const n = Math.min(p.samples.length - 2, Math.floor(scaled));
          const progress = scaled - n;
          pulse.position.copy(p.samples[n]).lerp(p.samples[n + 1], progress);
          const tangent = p.samples[n + 1]
            .clone()
            .sub(p.samples[n])
            .normalize()
            .multiplyScalar(p.state.direction);
          pulse.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            tangent
          );
          const width = 1.04 + ratio * 0.85;
          pulse.scale.set(width, 0.88 + ratio * 0.28, width);
          pulse.material.color.setHex(p.state.color);
          pulse.material.opacity = 0.96;
          pulse.userData.aura.material.color.setHex(p.state.color);
          pulse.userData.aura.material.opacity = 0.34 + ratio * 0.34;
        });
      }
      this.sunOrb.rotation.y += dt * 0.06;
    }
    if (this.focusTarget) {
      this.controls.target.lerp(this.focusTarget, Math.min(1, dt * 3.8));
      this.camera.position.lerp(this.focusCamera, Math.min(1, dt * 1.95));
      if (this.controls.target.distanceTo(this.focusTarget) < 0.1) {
        this.focusTarget = null;
        this.focusCamera = null;
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  resize() {
    const w = Math.max(20, this.mount.clientWidth),
      h = Math.max(20, this.mount.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onClick);
    this.controls.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
