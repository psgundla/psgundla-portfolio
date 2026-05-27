/* Three.js Monument-Valley landscape — scroll-driven journey
 * Stops: Charminar (Hyderabad) → Manipal beach → Eiffel (Grenoble/Paris) → Zollverein (Essen)
 * Style: low-poly, flat-shaded, pastel; soft directional + ambient light, fog.
 */
(function () {
  if (typeof THREE === 'undefined') return;

  const PALETTES = {
    day:   { sky: 0xb8d8eb, fog: 0xc4dff0, ground: 0x9bbf76, ground2: 0xb6cf85, mtn: 0x9aa9b5, mtnFar: 0xc1ccd6, sun: 0xfff5d6, ambient: 0xc8d8e8, glow: 0xfff5d6 },
    dawn:  { sky: 0xf3c9a8, fog: 0xefb88f, ground: 0xa68763, ground2: 0xc59f74, mtn: 0xa3697d, mtnFar: 0xd8a08f, sun: 0xffd9a8, ambient: 0xe8b09a, glow: 0xff9c66 },
    dusk:  { sky: 0xd6a896, fog: 0xc88c6f, ground: 0x8e6a55, ground2: 0xa8806a, mtn: 0x7a4f5f, mtnFar: 0xb88078, sun: 0xff9966, ambient: 0xc88a78, glow: 0xff7a3a },
    night: { sky: 0x1a2334, fog: 0x141d2e, ground: 0x2a3a4f, ground2: 0x394a63, mtn: 0x1f2a3f, mtnFar: 0x2c3a52, sun: 0xc8d3ee, ambient: 0x3a4660, glow: 0xa9b8d6 }
  };
  const ALT_PALETTES = {
    default: null,
    warm:    { ground: 0xc59a6c, ground2: 0xd6b58a, mtn: 0xa66b52, mtnFar: 0xc89886 },
    cool:    { ground: 0x6f9a8a, ground2: 0x88b1a0, mtn: 0x4f6f88, mtnFar: 0x88a3b6 },
    mono:    { ground: 0x9aa3a8, ground2: 0xb6bcc0, mtn: 0x6a737a, mtnFar: 0xa8aeb3 }
  };

  // Stops along the path (z position negative = forward into scene).
  // Camera flies along x-z curve; landmarks placed at these stops.
  const STOPS = [
    { id: 'origin',    pos: [0,    0,   30] },   // 0 — hero
    { id: 'about',     pos: [-6,   0,   -8] },   // 1
    { id: 'hyderabad', pos: [-30,  0,  -50] },   // 2 — Charminar
    { id: 'manipal',   pos: [-50,  0,  -98] },   // 3 — beach
    { id: 'grenoble',  pos: [-30,  0, -150] },   // 4 — Eiffel
    { id: 'essen',     pos: [-10,  0, -208] },   // 5 — Zollverein
    { id: 'research',  pos: [ 16,  0, -262] },   // 6
    { id: 'stack',     pos: [ 40,  0, -312] },   // 7
    { id: 'gallery',   pos: [ 60,  0, -358] },   // 8
    { id: 'contact',   pos: [ 80,  0, -402] }    // 9
  ];

  const state = {
    palette: 'day',
    altPalette: 'default',
    fogDensity: 0.012,
    cameraSpeed: 1.0,
    terrainStyle: 'rolling', // rolling / spiky / flat
    landscapeStyle: 'monument', // monument / wireframe / voxel
    progress: 0,
    targetProgress: 0
  };

  const host = document.getElementById('scene-host');
  if (!host) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 800);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  // Fog
  scene.fog = new THREE.FogExp2(PALETTES.day.fog, state.fogDensity);
  scene.background = new THREE.Color(PALETTES.day.sky);

  // Lights
  const ambient = new THREE.HemisphereLight(PALETTES.day.sky, PALETTES.day.ground, 0.85);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(PALETTES.day.sun, 1.0);
  sun.position.set(80, 110, 60);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(-60, 40, -60);
  scene.add(rim);

  // Materials registry — so we can recolour on palette change
  const mats = {};
  function flatMat(name, color, opts = {}) {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
    mats[name] = m;
    return m;
  }
  flatMat('ground',   PALETTES.day.ground);
  flatMat('ground2',  PALETTES.day.ground2);
  flatMat('mountain', PALETTES.day.mtn);
  flatMat('mtnFar',   PALETTES.day.mtnFar);
  flatMat('paper',    0xf6f1e6);
  flatMat('charcoal', 0x2a3445);
  flatMat('terra',    0xc5946a);
  flatMat('sand',     0xe8d39a);
  flatMat('water',    0x6aa3c7, { transparent:true, opacity:0.85 });
  flatMat('palmTrunk',0x8a5a3a);
  flatMat('palmLeaf', 0x6c9a48);
  flatMat('eiffel',   0x6e6356);
  flatMat('iron',     0x9a4a3a);
  flatMat('iron2',    0x7a3a2c);
  flatMat('roof',     0x3a3038);
  flatMat('white',    0xf2ece0);
  flatMat('cream',    0xe7d3a8);
  flatMat('domeGold', 0xc89a3a);

  // ---------- TERRAIN ----------
  // A long ribbon of land split into chunks, each a low-poly plane.
  const terrainGroup = new THREE.Group();
  scene.add(terrainGroup);

  function makeTerrainStrip(length = 480) {
    // Existing children -> dispose
    while (terrainGroup.children.length) {
      const c = terrainGroup.children.pop();
      c.geometry && c.geometry.dispose();
    }
    // The path winds from STOPS[0] to STOPS[last]
    // Make a wide ground plane covering the whole region with subtle elevation.
    const geom = new THREE.PlaneGeometry(360, length, 80, Math.floor(length / 6));
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const x = v.x;
      const z = v.z;
      // Elevation: base sine + noise; keep a "valley" along the camera path
      const dPath = pathDistance(x, z);
      let h = 0;
      if (state.terrainStyle === 'flat') {
        h = Math.max(0, dPath - 30) * 0.35 + Math.sin(x * 0.05 + z * 0.04) * 0.4;
      } else if (state.terrainStyle === 'spiky') {
        h = Math.max(0, dPath - 22) * 0.7 + (pseudoNoise(x * 0.18, z * 0.18) * 6);
      } else { // rolling
        h = Math.max(0, dPath - 28) * 0.45 + Math.sin(x * 0.04) * 1.2 + Math.cos(z * 0.05) * 1.4 + pseudoNoise(x * 0.06, z * 0.06) * 1.6;
      }
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, mats.ground);
    mesh.position.set(20, -1.5, -length / 2 + 30);
    terrainGroup.add(mesh);

    // Distant ridge lines (multiple silhouette layers for parallax)
    for (let layer = 0; layer < 3; layer++) {
      const ridgeGeom = makeRidge(420, layer);
      const m = layer === 0 ? mats.mountain : layer === 1 ? mats.mtnFar : mats.mtnFar;
      const ridge = new THREE.Mesh(ridgeGeom, m);
      ridge.position.set(20, layer === 0 ? 4 : layer === 1 ? 9 : 14, -length / 2 + 30 - (40 + layer * 20));
      terrainGroup.add(ridge);
    }

    // Path "tiles" (subtle lighter strip following the journey for legibility)
    const pathGeom = new THREE.BufferGeometry();
    const verts = [];
    for (let i = 0; i < STOPS.length - 1; i++) {
      const a = STOPS[i].pos, b = STOPS[i + 1].pos;
      const steps = 24;
      for (let s = 0; s < steps; s++) {
        const t1 = s / steps, t2 = (s + 1) / steps;
        const p1x = a[0] + (b[0] - a[0]) * t1, p1z = a[2] + (b[2] - a[2]) * t1;
        const p2x = a[0] + (b[0] - a[0]) * t2, p2z = a[2] + (b[2] - a[2]) * t2;
        verts.push(p1x, 0.02, p1z, p2x, 0.02, p2z);
      }
    }
    pathGeom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const pathLine = new THREE.Line(pathGeom, new THREE.LineBasicMaterial({ color: 0xd97757, transparent: true, opacity: 0.22 }));
    terrainGroup.add(pathLine);
  }

  function pseudoNoise(x, y) {
    // Cheap pseudo-noise — superposition of sines
    return (
      Math.sin(x * 1.7 + y * 0.9) * 0.5 +
      Math.sin(x * 2.3 - y * 1.2) * 0.3 +
      Math.cos(x * 0.5 + y * 1.5) * 0.4
    );
  }

  function pathDistance(x, z) {
    // Approximate min distance from (x,z) to piecewise-linear path through STOPS
    let best = Infinity;
    for (let i = 0; i < STOPS.length - 1; i++) {
      const a = STOPS[i].pos, b = STOPS[i + 1].pos;
      const ax = a[0], az = a[2], bx = b[0], bz = b[2];
      const dx = bx - ax, dz = bz - az;
      const len2 = dx * dx + dz * dz;
      let t = ((x - ax) * dx + (z - az) * dz) / Math.max(len2, 0.0001);
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, pz = az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) best = d;
    }
    return best;
  }

  function makeRidge(width, layer) {
    const geom = new THREE.BufferGeometry();
    const verts = [];
    const segs = 80;
    const peakBase = 6 + layer * 4;
    for (let i = 0; i < segs; i++) {
      const x1 = -width / 2 + (i / segs) * width;
      const x2 = -width / 2 + ((i + 1) / segs) * width;
      const h1 = peakBase + Math.abs(Math.sin(i * 0.7 + layer)) * (8 + layer * 3) + pseudoNoise(i * 0.3, layer) * 2;
      const h2 = peakBase + Math.abs(Math.sin((i + 1) * 0.7 + layer)) * (8 + layer * 3) + pseudoNoise((i + 1) * 0.3, layer) * 2;
      verts.push(x1, 0, 0,  x2, 0, 0,  x1, h1, 0);
      verts.push(x2, 0, 0,  x2, h2, 0,  x1, h1, 0);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geom.computeVertexNormals();
    return geom;
  }

  // ---------- LANDMARKS ----------

  // Charminar — 4 minarets at corners + 4 archways + dome
  function buildCharminar() {
    const g = new THREE.Group();
    const cream = mats.cream, white = mats.white, gold = mats.domeGold;

    // Square base
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 14), cream);
    base.position.y = 2;
    g.add(base);
    // Step
    const step = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 16), white);
    step.position.y = 0.4;
    g.add(step);

    // Arches (4 sides) — cut-outs as black recessed boxes
    const archMat = mats.charcoal;
    [[0,0,7.01],[0,0,-7.01],[7.01,0,0],[-7.01,0,0]].forEach((p,i)=>{
      const arch = new THREE.Mesh(new THREE.BoxGeometry(i<2?5:0.4, 5, i<2?0.4:5), archMat);
      arch.position.set(p[0], 2.5, p[2]);
      g.add(arch);
    });

    // Upper section
    const upper = new THREE.Mesh(new THREE.BoxGeometry(11, 3.5, 11), white);
    upper.position.y = 5.75;
    g.add(upper);

    // Central dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.position.y = 7.6;
    g.add(dome);
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 8), gold);
    finial.position.y = 10.2;
    g.add(finial);

    // 4 minarets at corners
    [[6.5,0,6.5],[-6.5,0,6.5],[6.5,0,-6.5],[-6.5,0,-6.5]].forEach(p=>{
      const min = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 12, 12), cream);
      shaft.position.y = 6;
      min.add(shaft);
      // Balconies
      for (let b = 0; b < 3; b++) {
        const bal = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.4, 12), white);
        bal.position.y = 3 + b * 3;
        min.add(bal);
      }
      // Top dome
      const minDome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8, 0, Math.PI*2, 0, Math.PI/2), gold);
      minDome.position.y = 12.05;
      min.add(minDome);
      const minSpire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.2, 8), gold);
      minSpire.position.y = 13.2;
      min.add(minSpire);
      min.position.set(p[0], 0, p[2]);
      g.add(min);
    });

    return g;
  }

  // Manipal beach — sand + water + palms + stones
  function buildBeach() {
    const g = new THREE.Group();
    const sandMat = mats.sand, water = mats.water, trunk = mats.palmTrunk, leaf = mats.palmLeaf;

    // Sand patch
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(36, 20, 1, 1), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0.05;
    g.add(sand);

    // Water (slightly lower, shifted to one side)
    const w = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), water);
    w.rotation.x = -Math.PI / 2;
    w.position.set(-22, 0.02, -8);
    g.add(w);

    // Palms
    const palmPositions = [
      [4, 0, 2], [-2, 0, -3], [8, 0, -2], [-6, 0, 4], [12, 0, 5], [0, 0, 6]
    ];
    palmPositions.forEach((p, idx) => {
      const palm = new THREE.Group();
      // Curved trunk via stacked cylinders
      const segs = 6;
      for (let s = 0; s < segs; s++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8), trunk);
        seg.position.set(Math.sin(s * 0.3 + idx) * 0.3, s * 1.2 + 0.7, Math.cos(s * 0.3 + idx) * 0.2);
        seg.rotation.z = Math.sin(s * 0.4 + idx) * 0.18;
        palm.add(seg);
      }
      // Leaves — 6 cones radial
      const top = segs * 1.2 + 0.5;
      for (let l = 0; l < 6; l++) {
        const leafMesh = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.2, 5), leaf);
        const ang = (l / 6) * Math.PI * 2;
        leafMesh.position.set(Math.cos(ang) * 1.1, top, Math.sin(ang) * 1.1);
        leafMesh.rotation.z = -Math.PI / 2.2 * Math.cos(ang);
        leafMesh.rotation.x = Math.PI / 2.2 * Math.sin(ang);
        palm.add(leafMesh);
      }
      palm.position.set(p[0], 0, p[2]);
      const s = 0.85 + (idx % 3) * 0.12;
      palm.scale.setScalar(s);
      g.add(palm);
    });

    // Stones
    [[-10, -2], [-8, 3], [10, -4], [14, 2]].forEach(p => {
      const r = 0.5 + Math.random() * 0.4;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mats.mountain);
      stone.position.set(p[0], r * 0.6, p[1]);
      stone.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(stone);
    });

    return g;
  }

  // Grenoble Alps — cluster of snow-capped low-poly peaks
  function buildAlps() {
    const g = new THREE.Group();
    const rock = new THREE.MeshLambertMaterial({ color: 0x6e7986, flatShading: true });
    const rockDark = new THREE.MeshLambertMaterial({ color: 0x4a5460, flatShading: true });
    const snow = new THREE.MeshLambertMaterial({ color: 0xf2ece0, flatShading: true });
    const grass = new THREE.MeshLambertMaterial({ color: 0x6f9a4a, flatShading: true });
    const peaks = [
      { x: 0,    z: 0,   r: 4.5, h: 14, mat: rock },
      { x: -8,   z: 2,   r: 3.6, h: 11, mat: rockDark },
      { x: 7,    z: -3,  r: 4.2, h: 12.5, mat: rock },
      { x: -3,   z: -7,  r: 3.0, h:  9,  mat: rockDark },
      { x: 4,    z:  6,  r: 2.5, h:  6,  mat: grass }
    ];
    peaks.forEach(p => {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.h, 5, 1), p.mat);
      peak.position.set(p.x, p.h/2, p.z);
      peak.rotation.y = Math.random() * Math.PI;
      g.add(peak);
      if (p.mat !== grass) {
        const cap = new THREE.Mesh(new THREE.ConeGeometry(p.r * 0.45, p.h * 0.3, 5, 1), snow);
        cap.position.set(p.x, p.h - p.h * 0.15, p.z);
        cap.rotation.y = peak.rotation.y;
        g.add(cap);
      }
    });
    // Foothill base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 1.2, 8), grass);
    base.position.y = 0.6;
    g.add(base);
    // A few pine trees on the foothills
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const tx = Math.cos(ang) * 10, tz = Math.sin(ang) * 10;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.0, 6), mats.palmTrunk);
      tr.position.set(tx, 1.7, tz);
      g.add(tr);
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8 - k*0.15, 1.1, 7), mats.palmLeaf);
        cone.position.set(tx, 2.0 + k*0.65, tz);
        g.add(cone);
      }
    }
    return g;
  }

  // Eiffel kept for compat (unused)
  function buildEiffel() {
    const g = new THREE.Group();
    const eiffMat = mats.eiffel;

    // Base pad
    const pad = new THREE.Mesh(new THREE.BoxGeometry(12, 0.8, 12), mats.cream);
    pad.position.y = 0.4;
    g.add(pad);

    // 4 legs
    const legHeight = 8;
    [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(s => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.5, legHeight, 6),
        eiffMat
      );
      leg.position.set(s[0] * 4, legHeight / 2, s[1] * 4);
      // Lean inward
      leg.rotation.z = -s[0] * 0.32;
      leg.rotation.x = s[1] * 0.32;
      g.add(leg);
    });

    // First platform
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 7), mats.cream);
    p1.position.y = 8.2;
    g.add(p1);

    // Mid section — narrower lattice
    const midH = 6;
    [[1,1],[-1,1],[1,-1],[-1,-1]].forEach(s => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, midH, 6),
        eiffMat
      );
      leg.position.set(s[0] * 1.8, 8.4 + midH / 2, s[1] * 1.8);
      leg.rotation.z = -s[0] * 0.18;
      leg.rotation.x = s[1] * 0.18;
      g.add(leg);
    });

    // Second platform
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 3.6), mats.cream);
    p2.position.y = 14.5;
    g.add(p2);

    // Top column + spire
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 5, 6), eiffMat);
    top.position.y = 17.2;
    g.add(top);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.2, 2, 8), eiffMat);
    spire.position.y = 20.7;
    g.add(spire);

    // Cross-bracing — diagonal lines as thin boxes
    for (let level = 0; level < 4; level++) {
      const y = 1 + level * 1.6;
      const w = 8 - level * 1.2;
      ['x','z'].forEach(ax => {
        const cross = new THREE.Mesh(new THREE.BoxGeometry(ax==='x'?w:0.1, 0.1, ax==='z'?w:0.1), eiffMat);
        cross.position.y = y;
        g.add(cross);
      });
    }

    return g;
  }

  // Zollverein Doppelbock — two A-frames + winding wheel
  function buildZollverein() {
    const g = new THREE.Group();
    const iron = mats.iron, iron2 = mats.iron2;

    // Concrete base
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 8), mats.cream);
    base.position.y = 0.7;
    g.add(base);

    // Two A-frames
    const aH = 13;
    [-3, 3].forEach(zOff => {
      // legs of A
      [-1, 1].forEach(s => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, aH, 0.5), iron);
        leg.position.set(s * 4, aH / 2 + 0.7, zOff);
        leg.rotation.z = -s * 0.25;
        g.add(leg);
      });
      // top crossbar (peak)
      const peak = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.6), iron);
      peak.position.set(0, aH + 0.5, zOff);
      g.add(peak);
    });

    // Connecting box at top (housing)
    const housing = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 7), iron2);
    housing.position.set(0, aH + 1.8, 0);
    g.add(housing);

    // Roof — angled slabs
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 4), mats.roof);
    roofL.position.set(-0.7, aH + 3.2, 0);
    roofL.rotation.z = 0.35;
    g.add(roofL);
    const roofR = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 4), mats.roof);
    roofR.position.set(0.7, aH + 3.2, 0);
    roofR.rotation.z = -0.35;
    g.add(roofR);

    // Two winding wheels (front/back)
    [-3.5, 3.5].forEach(zOff => {
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.25, 8, 18),
        iron
      );
      wheel.position.set(0, aH + 0.5, zOff);
      g.add(wheel);
      // Spokes
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), iron);
        sp.position.set(0, aH + 0.5, zOff);
        sp.rotation.z = (i / 6) * Math.PI * 2;
        g.add(sp);
      }
      // Hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 12), iron2);
      hub.position.set(0, aH + 0.5, zOff);
      hub.rotation.x = Math.PI / 2;
      g.add(hub);
    });

    // Side cables descending diagonally
    const cable1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 14, 0.12), iron);
    cable1.position.set(-2, 7, 0);
    cable1.rotation.z = 0.6;
    g.add(cable1);

    return g;
  }

  // ---------- Generic flora / props (fill the world) ----------
  function buildPineTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6), mats.palmTrunk);
    trunk.position.y = 0.6;
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 - i * 0.15, 1.2, 7), mats.palmLeaf);
      cone.position.y = 1.2 + i * 0.7;
      g.add(cone);
    }
    return g;
  }
  function buildRock() {
    const g = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.5, 0), mats.mountain);
    g.rotation.set(Math.random(), Math.random(), Math.random());
    return g;
  }
  function buildBush() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + Math.random()*0.3, 0), mats.palmLeaf);
      b.position.set((Math.random()-0.5)*0.6, 0.3, (Math.random()-0.5)*0.6);
      g.add(b);
    }
    return g;
  }

  // ---------- Place landmarks ----------
  const charminar = buildCharminar();
  charminar.position.set(STOPS[2].pos[0] + 8, 0, STOPS[2].pos[2]);
  scene.add(charminar);

  const beach = buildBeach();
  beach.position.set(STOPS[3].pos[0] + 6, 0, STOPS[3].pos[2]);
  scene.add(beach);

  const eiffel = buildAlps();
  eiffel.position.set(STOPS[4].pos[0] + 8, 0, STOPS[4].pos[2] - 4);
  scene.add(eiffel);

  const zollverein = buildZollverein();
  zollverein.position.set(STOPS[5].pos[0] + 8, 0, STOPS[5].pos[2]);
  scene.add(zollverein);

  // Scatter flora across the world
  const flora = new THREE.Group();
  scene.add(flora);
  function scatterFlora() {
    while (flora.children.length) {
      const c = flora.children.pop();
      c.geometry && c.geometry.dispose && c.geometry.dispose();
    }
    const COUNT = 220;
    for (let i = 0; i < COUNT; i++) {
      const z = -440 + Math.random() * 480;
      const x = -100 + Math.random() * 200;
      // Skip near-path
      if (pathDistance(x, z) < 12) continue;
      // Skip near landmarks
      let near = false;
      [charminar, beach, eiffel, zollverein].forEach(lm => {
        const dx = lm.position.x - x, dz = lm.position.z - z;
        if (Math.hypot(dx, dz) < 18) near = true;
      });
      if (near) continue;
      const r = Math.random();
      let prop;
      if (r < 0.55) prop = buildPineTree();
      else if (r < 0.85) prop = buildBush();
      else prop = buildRock();
      prop.position.set(x, 0, z);
      const s = 0.7 + Math.random() * 0.9;
      prop.scale.setScalar(s);
      prop.rotation.y = Math.random() * Math.PI * 2;
      flora.add(prop);
    }
  }

  // Sun "disc" in sky (visible in some palettes)
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(8, 24), new THREE.MeshBasicMaterial({ color: 0xfff5d6, transparent: true, opacity: 0.65 }));
  sunDisc.position.set(60, 38, -380);
  scene.add(sunDisc);

  // ---------- Camera path ----------
  function camPosAt(t) {
    // t in [0,1] across STOPS
    const n = STOPS.length - 1;
    const ft = Math.max(0, Math.min(1, t)) * n;
    const i = Math.floor(ft);
    const f = ft - i;
    const a = STOPS[i].pos;
    const b = STOPS[Math.min(i + 1, n)].pos;
    // Smoothstep
    const e = f * f * (3 - 2 * f);
    return [
      a[0] + (b[0] - a[0]) * e,
      a[1] + (b[1] - a[1]) * e,
      a[2] + (b[2] - a[2]) * e
    ];
  }
  function camLookAt(t) {
    // Always look slightly ahead along path
    const ahead = Math.min(1, t + 0.08);
    const p = camPosAt(ahead);
    return new THREE.Vector3(p[0], 1.2, p[2]);
  }

  // Initial camera position
  const initial = camPosAt(0);
  camera.position.set(initial[0], 4.5, initial[2] + 8);
  camera.lookAt(0, 1.2, initial[2] - 4);

  // ---------- Public scroll API ----------
  window.__scene = {
    setProgress(p) { state.targetProgress = Math.max(0, Math.min(1, p)); },
    setPalette(name) {
      if (!PALETTES[name]) return;
      state.palette = name;
      applyPalette();
    },
    setAltPalette(name) { state.altPalette = name || 'default'; applyPalette(); },
    setFog(v) { state.fogDensity = v; if (scene.fog) scene.fog.density = v; },
    setSpeed(v) { state.cameraSpeed = v; },
    setTerrain(style) { state.terrainStyle = style; makeTerrainStrip(); },
    setLandscapeStyle(style) {
      state.landscapeStyle = style;
      // Toggle wireframe or solid
      Object.values(mats).forEach(m => { if (m.wireframe !== undefined) m.wireframe = (style === 'wireframe'); });
    }
  };

  function applyPalette() {
    const p = PALETTES[state.palette];
    const alt = ALT_PALETTES[state.altPalette] || {};
    scene.background = new THREE.Color(p.sky);
    if (scene.fog) scene.fog.color = new THREE.Color(p.fog);
    ambient.color = new THREE.Color(p.sky);
    ambient.groundColor = new THREE.Color(alt.ground || p.ground);
    sun.color = new THREE.Color(p.sun);
    sunDisc.material.color = new THREE.Color(p.glow);

    // Mountains / ground recolor
    mats.ground.color   = new THREE.Color(alt.ground   || p.ground);
    mats.ground2.color  = new THREE.Color(alt.ground2  || p.ground2);
    mats.mountain.color = new THREE.Color(alt.mtn      || p.mtn);
    mats.mtnFar.color   = new THREE.Color(alt.mtnFar   || p.mtnFar);
  }

  // ---------- Resize ----------
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // ---------- Animate ----------
  let t0 = performance.now();
  function tick() {
    const t = performance.now();
    const dt = Math.min(0.05, (t - t0) / 1000);
    t0 = t;

    // Smoothly interpolate progress (for nicer feel than raw scroll snap)
    state.progress += (state.targetProgress - state.progress) * Math.min(1, dt * 4 * state.cameraSpeed);

    const cp = camPosAt(state.progress);
    // Camera floats just above terrain on the path; add a gentle bob
    const bob = Math.sin(t * 0.0006) * 0.18;
    camera.position.set(cp[0], 4.6 + bob, cp[2] + 6);
    const look = camLookAt(state.progress);
    camera.lookAt(look);

    // Rotate Zollverein wheels gently
    zollverein.children.forEach(c => {
      if (c.geometry && c.geometry.type === 'TorusGeometry') c.rotation.z += dt * 0.4;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  // Build & start
  makeTerrainStrip();
  scatterFlora();
  applyPalette();
  requestAnimationFrame(tick);

  // Hide splash after first frames
  setTimeout(() => {
    const s = document.getElementById('splash');
    if (s) {
      s.classList.add('gone');
      setTimeout(() => s.remove(), 800);
    }
  }, 600);
})();
