import * as THREE from 'three';

// ── Shared carbon fiber texture (64x64 woven checkerboard) ──
let _carbonMat: THREE.MeshStandardMaterial | null = null;
function getCarbonFiberMat(): THREE.MeshStandardMaterial {
  if (_carbonMat) return _carbonMat;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);
  const cell = 8;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const odd = ((x / cell) + (y / cell)) % 2 === 0;
      ctx.fillStyle = odd ? '#252525' : '#141414';
      ctx.fillRect(x, y, cell, cell);
      // Weave highlight
      ctx.fillStyle = odd ? '#2e2e2e' : '#0f0f0f';
      ctx.fillRect(x + 1, y + 1, cell - 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  _carbonMat = new THREE.MeshStandardMaterial({
    map: tex,
    metalness: 0.35,
    roughness: 0.55,
  });
  return _carbonMat;
}

export interface KartMeshes {
  group: THREE.Group;
  body: THREE.Mesh;
  wheels: THREE.Mesh[];
  driver: THREE.Group;
  headlightLenses: THREE.Mesh[];
  taillightMat: THREE.MeshStandardMaterial;
}

export function buildKartMesh(color: number): KartMeshes {
  const group = new THREE.Group();
  const col = new THREE.Color(color);
  const darkCol = new THREE.Color(color).multiplyScalar(0.45);
  const accentCol = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45);
  const metallicCol = new THREE.Color(color).multiplyScalar(0.7);
  const carbonMat = getCarbonFiberMat();

  // ── Main body — refined tapered shape ──
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.55, -1.35);
  bodyShape.quadraticCurveTo(-0.1, -1.45, 0.55, -1.35);
  bodyShape.quadraticCurveTo(0.75, -1.0, 0.74, -0.5);
  bodyShape.lineTo(0.70, 0.7);
  bodyShape.quadraticCurveTo(0.68, 1.05, 0.52, 1.18);
  bodyShape.quadraticCurveTo(0.2, 1.28, -0.52, 1.18);
  bodyShape.quadraticCurveTo(-0.68, 1.05, -0.70, 0.7);
  bodyShape.lineTo(-0.74, -0.5);
  bodyShape.quadraticCurveTo(-0.75, -1.0, -0.55, -1.35);

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.38,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 4,
  });
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.translate(0, 0.15, 0);

  // ── Body livery via CanvasTexture ──
  const liveryW = 512, liveryH = 256;
  const liveryCanvas = document.createElement('canvas');
  liveryCanvas.width = liveryW;
  liveryCanvas.height = liveryH;
  const lctx = liveryCanvas.getContext('2d')!;
  // Solid base color
  lctx.fillStyle = '#' + col.getHexString();
  lctx.fillRect(0, 0, liveryW, liveryH);
  // Two racing stripes in accent color
  lctx.fillStyle = '#' + accentCol.getHexString();
  lctx.fillRect(liveryW * 0.35, 0, liveryW * 0.04, liveryH);
  lctx.fillRect(liveryW * 0.61, 0, liveryW * 0.04, liveryH);
  // Triangular accent panel (dark, lower-rear)
  lctx.fillStyle = '#' + darkCol.clone().multiplyScalar(0.6).getHexString();
  lctx.beginPath();
  lctx.moveTo(0, liveryH);
  lctx.lineTo(liveryW * 0.35, liveryH);
  lctx.lineTo(0, liveryH * 0.6);
  lctx.closePath();
  lctx.fill();
  // Sponsor blocks (white rounded rects)
  lctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (const [sx, sy, sw, sh] of [[380, 40, 80, 24], [380, 180, 60, 20], [50, 80, 70, 22]] as const) {
    lctx.beginPath();
    lctx.roundRect(sx, sy, sw, sh, 5);
    lctx.fill();
  }
  // Pinstripe separators
  lctx.strokeStyle = 'rgba(255,255,255,0.18)';
  lctx.lineWidth = 1.5;
  lctx.beginPath();
  lctx.moveTo(0, liveryH * 0.33);
  lctx.lineTo(liveryW, liveryH * 0.33);
  lctx.moveTo(0, liveryH * 0.67);
  lctx.lineTo(liveryW, liveryH * 0.67);
  lctx.stroke();
  const liveryTex = new THREE.CanvasTexture(liveryCanvas);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    color: 0xffffff,
    metalness: 0.4,
    roughness: 0.32,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = 0.32;
  group.add(body);

  // ── Nose / front bumper — layered ──
  const noseGeo = new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  noseGeo.rotateX(Math.PI);
  noseGeo.scale(1, 0.45, 1);
  const noseMat = new THREE.MeshStandardMaterial({ color: accentCol.getHex(), metalness: 0.45, roughness: 0.25 });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.32, -1.38);
  nose.castShadow = true;
  group.add(nose);

  // Front splitter lip
  const splitterGeo = new THREE.BoxGeometry(1.2, 0.03, 0.12);
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.18, -1.35);
  group.add(splitter);

  // ── Rear spoiler — multi-element ──
  const spoilerMat = new THREE.MeshStandardMaterial({ color: darkCol.getHex(), metalness: 0.5, roughness: 0.3 });
  // Posts (curved)
  for (const sx of [-0.42, 0.42]) {
    const postShape = new THREE.Shape();
    postShape.moveTo(-0.025, 0);
    postShape.lineTo(0.025, 0);
    postShape.lineTo(0.02, 0.3);
    postShape.lineTo(-0.02, 0.3);
    const postGeo = new THREE.ExtrudeGeometry(postShape, { depth: 0.04, bevelEnabled: false });
    const post = new THREE.Mesh(postGeo, spoilerMat);
    post.position.set(sx, 0.62, 1.02);
    post.castShadow = true;
    group.add(post);
  }
  // Main wing element
  const wingShape = new THREE.Shape();
  wingShape.moveTo(-0.58, 0);
  wingShape.quadraticCurveTo(0, 0.04, 0.58, 0);
  wingShape.lineTo(0.55, -0.035);
  wingShape.quadraticCurveTo(0, 0.0, -0.55, -0.035);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  wingGeo.rotateX(-Math.PI / 2);
  const wingMat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.25 });
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.position.set(0, 0.92, 0.98);
  wing.rotation.x = -0.12;
  wing.castShadow = true;
  group.add(wing);
  // Gurney flap
  const gurneyGeo = new THREE.BoxGeometry(1.1, 0.04, 0.015);
  const gurney = new THREE.Mesh(gurneyGeo, spoilerMat);
  gurney.position.set(0, 0.93, 1.18);
  group.add(gurney);

  // ── Exhaust pipes — chrome with heat shimmer rings ──
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.85, roughness: 0.15 });
  const exhaustTipMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.2 });
  for (const sx of [-0.25, 0.25]) {
    // Main pipe
    const pipeGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.3, 10);
    const pipe = new THREE.Mesh(pipeGeo, exhaustMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(sx, 0.3, 1.32);
    pipe.castShadow = true;
    group.add(pipe);
    // Tip ring
    const tipGeo = new THREE.TorusGeometry(0.06, 0.012, 6, 12);
    const tip = new THREE.Mesh(tipGeo, exhaustTipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(sx, 0.3, 1.47);
    group.add(tip);
    // Inner bore (dark)
    const boreGeo = new THREE.CircleGeometry(0.04, 10);
    const boreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
    const bore = new THREE.Mesh(boreGeo, boreMat);
    bore.position.set(sx, 0.3, 1.475);
    group.add(bore);
  }


  // ── Headlights — visual lens elements (SpotLights created in Kart.ts) ──
  const headlightLenses: THREE.Mesh[] = [];
  for (const sx of [-0.35, 0.35]) {
    // Housing
    const housingGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.06, 10);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.3 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(sx, 0.38, -1.35);
    group.add(housing);
    // Lens
    const lensGeo = new THREE.SphereGeometry(0.065, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffdd,
      emissive: 0xffffaa,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(sx, 0.38, -1.38);
    group.add(lens);
    headlightLenses.push(lens);

    // Headlight illumination is handled by custom shader (HeadlightEffect.ts)
  }

  // ── Tail lights — LED-style multi-element ──
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff2200,
    emissiveIntensity: 0.6,
  });
  for (const sx of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      const tailGeo = new THREE.BoxGeometry(0.04, 0.04, 0.03);
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(sx * (0.32 + j * 0.06), 0.42, 1.23);
      group.add(tail);
    }
  }

  // ── Cockpit floor & dashboard ──
  const cockpitGeo = new THREE.BoxGeometry(0.7, 0.04, 0.8);
  const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 });
  const cockpitFloor = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpitFloor.position.set(0, 0.36, 0.0);
  group.add(cockpitFloor);

  // Dashboard
  const dashGeo = new THREE.BoxGeometry(0.65, 0.15, 0.06);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const dash = new THREE.Mesh(dashGeo, dashMat);
  dash.position.set(0, 0.48, -0.28);
  dash.rotation.x = 0.3;
  group.add(dash);

  // ── Seat — bucket style with bolsters ──
  const seatBackGeo = new THREE.BoxGeometry(0.44, 0.4, 0.08);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  const seatBack = new THREE.Mesh(seatBackGeo, seatMat);
  seatBack.position.set(0, 0.62, 0.38);
  seatBack.rotation.x = -0.15;
  group.add(seatBack);
  const seatBaseGeo = new THREE.BoxGeometry(0.46, 0.06, 0.38);
  const seatBase = new THREE.Mesh(seatBaseGeo, seatMat);
  seatBase.position.set(0, 0.42, 0.18);
  group.add(seatBase);
  // Bolsters
  for (const sx of [-0.24, 0.24]) {
    const bolsterGeo = new THREE.BoxGeometry(0.06, 0.2, 0.35);
    const bolster = new THREE.Mesh(bolsterGeo, seatMat);
    bolster.position.set(sx, 0.52, 0.18);
    group.add(bolster);
  }
  // Headrest
  const headrestGeo = new THREE.BoxGeometry(0.22, 0.14, 0.06);
  const headrest = new THREE.Mesh(headrestGeo, seatMat);
  headrest.position.set(0, 0.86, 0.38);
  group.add(headrest);

  // ── Steering wheel — detailed with center hub ──
  const steeringGeo = new THREE.TorusGeometry(0.12, 0.018, 10, 20);
  const steeringMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  const steering = new THREE.Mesh(steeringGeo, steeringMat);
  steering.position.set(0, 0.62, -0.12);
  steering.rotation.x = -0.5;
  group.add(steering);
  // Center hub
  const hubCenterGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.015, 10);
  const hubCenterMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.2 });
  const hubCenter = new THREE.Mesh(hubCenterGeo, hubCenterMat);
  hubCenter.position.copy(steering.position);
  hubCenter.rotation.x = steering.rotation.x + Math.PI / 2;
  group.add(hubCenter);
  // Spokes
  for (let s = 0; s < 3; s++) {
    const spokeGeo = new THREE.BoxGeometry(0.015, 0.11, 0.012);
    const spoke = new THREE.Mesh(spokeGeo, steeringMat);
    spoke.position.copy(steering.position);
    spoke.rotation.x = steering.rotation.x;
    spoke.rotation.z = (s / 3) * Math.PI;
    group.add(spoke);
  }
  // Column
  const columnGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8);
  const column = new THREE.Mesh(columnGeo, steeringMat);
  column.position.set(0, 0.54, -0.06);
  column.rotation.x = -0.5;
  group.add(column);

  // ── Side mirrors ──
  const mirrorArmGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6);
  const mirrorGlassGeo = new THREE.BoxGeometry(0.08, 0.06, 0.015);
  const mirrorArmMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 });
  const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0x8888cc, metalness: 0.95, roughness: 0.05 });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(mirrorArmGeo, mirrorArmMat);
    arm.position.set(sx * 0.78, 0.52, -0.5);
    arm.rotation.z = sx * 0.8;
    group.add(arm);
    const glass = new THREE.Mesh(mirrorGlassGeo, mirrorGlassMat);
    glass.position.set(sx * 0.9, 0.58, -0.5);
    glass.rotation.y = sx * 0.3;
    group.add(glass);
  }

  // ── Roll bar / safety hoop ──
  const rollBarMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.3 });
  // Uprights
  for (const sx of [-0.3, 0.3]) {
    const upGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
    const up = new THREE.Mesh(upGeo, rollBarMat);
    up.position.set(sx, 0.72, 0.45);
    group.add(up);
  }
  // Cross bar
  const crossGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
  const cross = new THREE.Mesh(crossGeo, rollBarMat);
  cross.rotation.z = Math.PI / 2;
  cross.position.set(0, 0.95, 0.45);
  group.add(cross);

  // ── Racing number decal (canvas texture) ──
  const numCanvas = document.createElement('canvas');
  numCanvas.width = 64;
  numCanvas.height = 64;
  const nctx = numCanvas.getContext('2d')!;
  nctx.fillStyle = '#ffffff';
  nctx.beginPath();
  nctx.arc(32, 32, 28, 0, Math.PI * 2);
  nctx.fill();
  nctx.fillStyle = '#' + darkCol.getHexString();
  nctx.font = 'bold 36px Arial';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  // Random number 1-99
  const raceNum = Math.floor(col.r * 40 + col.g * 30 + col.b * 20 + 1) % 99 + 1;
  nctx.fillText(String(raceNum), 32, 34);
  const numTex = new THREE.CanvasTexture(numCanvas);
  const numGeo = new THREE.PlaneGeometry(0.3, 0.3);
  const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const numPlane = new THREE.Mesh(numGeo, numMat);
    numPlane.position.set(sx * 0.75, 0.48, 0.1);
    numPlane.rotation.y = sx * Math.PI / 2;
    group.add(numPlane);
  }

  // ── Wheels — ultra-detailed ──
  const wheels: THREE.Mesh[] = [];
  const wheelPositions = [
    [-0.78, 0.0, -0.78],
    [0.78, 0.0, -0.78],
    [-0.84, 0.0, 0.78],
    [0.84, 0.0, 0.78],
  ];
  const wheelRadii = [0.28, 0.28, 0.34, 0.34];
  const wheelWidths = [0.14, 0.14, 0.18, 0.18];

  for (let i = 0; i < 4; i++) {
    const [wx, wy, wz] = wheelPositions[i];
    const r = wheelRadii[i];
    const w = wheelWidths[i];
    const wheelGroup = new THREE.Group();

    // Tire — torus
    const tireGeo = new THREE.TorusGeometry(r, w * 0.65, 12, 24);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    wheelGroup.add(tire);

    // Tire sidewall text band (lighter ring)
    const bandGeo = new THREE.TorusGeometry(r + w * 0.15, 0.012, 8, 24);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    wheelGroup.add(band);

    // Rim — metallic dish
    const rimGeo = new THREE.CylinderGeometry(r * 0.65, r * 0.6, w, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.88, roughness: 0.1 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    // Hubcap centers (both sides)
    const hubGeo = new THREE.CircleGeometry(r * 0.38, 12);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8, roughness: 0.15 });
    for (const dir of [-1, 1]) {
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      hub.position.x = dir * (w * 0.52);
      wheelGroup.add(hub);
    }

    // 5-spoke star pattern
    const spokeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.75, roughness: 0.2 });
    for (let s = 0; s < 5; s++) {
      const spokeGeo = new THREE.BoxGeometry(w * 0.7, r * 0.9, 0.025);
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.rotation.z = (s / 5) * Math.PI;
      wheelGroup.add(spoke);
    }

    // Center nut
    const nutGeo = new THREE.CylinderGeometry(0.03, 0.03, w * 0.8, 6);
    const nutMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.7, roughness: 0.2 });
    const nut = new THREE.Mesh(nutGeo, nutMat);
    nut.rotation.z = Math.PI / 2;
    wheelGroup.add(nut);

    // Brake disc (visible inside spokes)
    const discGeo = new THREE.RingGeometry(r * 0.25, r * 0.55, 20, 1);
    const discMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide });
    for (const dir of [-1, 1]) {
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      disc.position.x = dir * (w * 0.2);
      wheelGroup.add(disc);
    }

    // Brake caliper
    const caliperGeo = new THREE.BoxGeometry(0.04, 0.06, 0.03);
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5 });
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(0, r * 0.45, 0);
    wheelGroup.add(caliper);

    wheelGroup.rotation.y = Math.PI / 2;
    wheelGroup.position.set(wx, wy + r, wz);
    wheels.push(wheelGroup as any);
    group.add(wheelGroup);
  }

  // ── Fenders / wheel arches — curved ──
  const fenderMat = new THREE.MeshStandardMaterial({ color: darkCol.getHex(), roughness: 0.45 });
  const fenderData: [number, number, number, number][] = [
    [-0.7, 0.55, -0.78, 0.28],
    [0.7, 0.55, -0.78, 0.28],
    [-0.76, 0.58, 0.78, 0.34],
    [0.76, 0.58, 0.78, 0.34],
  ];
  for (const [fx, fy, fz, fr] of fenderData) {
    const archGeo = new THREE.TorusGeometry(fr + 0.06, 0.04, 6, 12, Math.PI);
    const arch = new THREE.Mesh(archGeo, fenderMat);
    arch.position.set(fx, fy, fz);
    arch.rotation.y = Math.PI / 2;
    group.add(arch);
  }

  // ── Rear diffuser ──
  const diffuserGeo = new THREE.BoxGeometry(0.9, 0.06, 0.15);
  const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
  diffuser.position.set(0, 0.17, 1.18);
  group.add(diffuser);
  // Diffuser fins
  for (let f = -3; f <= 3; f++) {
    const finGeo = new THREE.BoxGeometry(0.01, 0.05, 0.12);
    const fin = new THREE.Mesh(finGeo, carbonMat);
    fin.position.set(f * 0.11, 0.17, 1.18);
    group.add(fin);
  }

  // ── Number plate (rear) ──
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 128;
  plateCanvas.height = 48;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(0, 0, 128, 48);
  pctx.strokeStyle = '#333333';
  pctx.lineWidth = 3;
  pctx.strokeRect(2, 2, 124, 44);
  pctx.fillStyle = '#222222';
  pctx.font = 'bold 28px Arial';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  pctx.fillText(String(raceNum).padStart(2, '0'), 64, 26);
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  const plateGeo = new THREE.PlaneGeometry(0.38, 0.14);
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTex, side: THREE.DoubleSide });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, 0.32, 1.24);
  group.add(plate);

  // ── Antenna ──
  const antennaGeo = new THREE.CylinderGeometry(0.005, 0.003, 0.5, 4);
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const antenna = new THREE.Mesh(antennaGeo, antennaMat);
  antenna.position.set(0.35, 0.8, 0.9);
  antenna.rotation.z = -0.15;
  group.add(antenna);
  // Antenna ball
  const aBallGeo = new THREE.SphereGeometry(0.02, 6, 6);
  const aBallMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const aBall = new THREE.Mesh(aBallGeo, aBallMat);
  aBall.position.set(0.35 - 0.5 * Math.sin(0.15), 0.8 + 0.5 * Math.cos(0.15), 0.9);
  group.add(aBall);

  // ── Panel lines / body seams ──
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.4, transparent: true, depthWrite: false });
  const seamDefs: [number, number, number, number, number, number, number][] = [
    // [x, y, z, w, h, d, rotY] — thin dark strips on body surface
    [0, 0.53, -0.45, 1.2, 0.005, 0.008, 0],      // hood line (lateral)
    [0.35, 0.45, 0.0, 0.005, 0.008, 1.6, 0],      // right side panel line
    [-0.35, 0.45, 0.0, 0.005, 0.008, 1.6, 0],     // left side panel line
    [0, 0.53, 0.5, 0.9, 0.005, 0.008, 0],          // engine cover line (lateral)
    [0, 0.45, -0.9, 0.005, 0.008, 0.5, 0],         // center hood line (longitudinal)
    [0.55, 0.40, 0.3, 0.005, 0.008, 0.8, 0],       // right lower panel
    [-0.55, 0.40, 0.3, 0.005, 0.008, 0.8, 0],      // left lower panel
  ];
  for (const [sx, sy, sz, sw, sh, sd, ry] of seamDefs) {
    const seamGeo = new THREE.BoxGeometry(sw, sh, sd);
    const seam = new THREE.Mesh(seamGeo, seamMat);
    seam.position.set(sx, sy + 0.32, sz);
    seam.rotation.y = ry;
    seam.renderOrder = 1;
    group.add(seam);
  }

  // ── Windshield / aero screen ──
  const windshieldGeo = new THREE.SphereGeometry(0.4, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.4);
  const windshieldMat = new THREE.MeshStandardMaterial({
    color: 0x88bbff,
    opacity: 0.25,
    transparent: true,
    depthWrite: false,
    metalness: 0.3,
    roughness: 0.1,
    side: THREE.DoubleSide,
  });
  const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
  windshield.position.set(0, 0.58, -0.22);
  windshield.scale.set(1.3, 0.8, 1.0);
  windshield.renderOrder = 2;
  group.add(windshield);

  // ── Front grille / air intake ──
  const grilleDarkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });
  // Dark recessed box
  const grilleBoxGeo = new THREE.BoxGeometry(0.6, 0.12, 0.06);
  const grilleBox = new THREE.Mesh(grilleBoxGeo, grilleDarkMat);
  grilleBox.position.set(0, 0.26, -1.38);
  group.add(grilleBox);
  // Horizontal slats
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.4, roughness: 0.5 });
  for (let s = 0; s < 4; s++) {
    const slotGeo = new THREE.BoxGeometry(0.54, 0.008, 0.04);
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(0, 0.22 + s * 0.025, -1.36);
    group.add(slot);
  }
  // Chrome surround frame
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.85, roughness: 0.1 });
  const frameParts: [number, number, number, number, number, number][] = [
    [0, 0.32, -1.385, 0.64, 0.012, 0.012],  // top
    [0, 0.20, -1.385, 0.64, 0.012, 0.012],  // bottom
    [-0.31, 0.26, -1.385, 0.012, 0.13, 0.012], // left
    [0.31, 0.26, -1.385, 0.012, 0.13, 0.012],  // right
  ];
  for (const [fx, fy, fz, fw, fh, fd] of frameParts) {
    const frameGeo = new THREE.BoxGeometry(fw, fh, fd);
    const frame = new THREE.Mesh(frameGeo, chromeMat);
    frame.position.set(fx, fy, fz);
    group.add(frame);
  }

  // ── DRL (LED) strips ──
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xaaddff,
    emissive: 0xaaddff,
    emissiveIntensity: 1.2,
  });
  for (const sx of [-1, 1]) {
    const drlGeo = new THREE.BoxGeometry(0.06, 0.015, 0.025);
    const drl = new THREE.Mesh(drlGeo, drlMat);
    drl.position.set(sx * 0.48, 0.38, -1.36);
    group.add(drl);
  }

  // ── Wing endplates (carbon fiber) ──
  for (const sx of [-1, 1]) {
    const epGeo = new THREE.BoxGeometry(0.015, 0.18, 0.22);
    const ep = new THREE.Mesh(epGeo, carbonMat);
    ep.position.set(sx * 0.57, 0.90, 1.05);
    group.add(ep);
  }

  // ── Side air intakes ──
  const intakeDarkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });
  for (const sx of [-1, 1]) {
    // Trapezoidal frame (approximated with box)
    const intakeFrameGeo = new THREE.BoxGeometry(0.04, 0.18, 0.28);
    const intakeFrame = new THREE.Mesh(intakeFrameGeo, darkCol.getHex() !== 0 ?
      new THREE.MeshStandardMaterial({ color: metallicCol.getHex(), metalness: 0.5, roughness: 0.4 }) :
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.4 }));
    intakeFrame.position.set(sx * 0.74, 0.42, 0.35);
    group.add(intakeFrame);
    // Dark void
    const intakeVoidGeo = new THREE.BoxGeometry(0.02, 0.13, 0.22);
    const intakeVoid = new THREE.Mesh(intakeVoidGeo, intakeDarkMat);
    intakeVoid.position.set(sx * 0.74, 0.42, 0.35);
    group.add(intakeVoid);
    // Horizontal slat
    const intakeSlotGeo = new THREE.BoxGeometry(0.025, 0.008, 0.2);
    const intakeSlot = new THREE.Mesh(intakeSlotGeo, slotMat);
    intakeSlot.position.set(sx * 0.74, 0.42, 0.35);
    group.add(intakeSlot);
  }

  // ── Suspension A-arms ──
  const rollBarMat2 = rollBarMat; // reuse existing
  for (let i = 0; i < 4; i++) {
    const [wx, , wz] = wheelPositions[i];
    const r = wheelRadii[i];
    const bodyX = Math.sign(wx) * 0.55; // body attachment x
    const bodyZ = wz;
    const bodyY = 0.30;
    const wheelY = r;
    // Upper arm
    const upperLen = Math.sqrt((wx - bodyX) ** 2 + (wheelY + 0.08 - bodyY - 0.05) ** 2);
    const upperArmGeo = new THREE.CylinderGeometry(0.012, 0.012, upperLen, 6);
    const upperArm = new THREE.Mesh(upperArmGeo, rollBarMat2);
    const umx = (bodyX + wx) / 2;
    const umy = (bodyY + 0.05 + wheelY + 0.08) / 2;
    upperArm.position.set(umx, umy, bodyZ);
    upperArm.rotation.z = Math.atan2(wx - bodyX, wheelY + 0.08 - bodyY - 0.05);
    upperArm.castShadow = true;
    group.add(upperArm);
    // Lower arm
    const lowerLen = Math.sqrt((wx - bodyX) ** 2 + (wheelY - 0.06 - bodyY + 0.05) ** 2);
    const lowerArmGeo = new THREE.CylinderGeometry(0.012, 0.012, lowerLen, 6);
    const lowerArm = new THREE.Mesh(lowerArmGeo, rollBarMat2);
    const lmx = (bodyX + wx) / 2;
    const lmy = (bodyY - 0.05 + wheelY - 0.06) / 2;
    lowerArm.position.set(lmx, lmy, bodyZ);
    lowerArm.rotation.z = Math.atan2(wx - bodyX, wheelY - 0.06 - bodyY + 0.05);
    lowerArm.castShadow = true;
    group.add(lowerArm);
  }

  // ── Rear rain light ──
  // Dark housing
  const rainHousingGeo = new THREE.BoxGeometry(0.14, 0.06, 0.04);
  const rainHousingMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const rainHousing = new THREE.Mesh(rainHousingGeo, rainHousingMat);
  rainHousing.position.set(0, 0.28, 1.24);
  group.add(rainHousing);
  // Red emissive lens
  const rainLensGeo = new THREE.BoxGeometry(0.10, 0.04, 0.015);
  const rainLensMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.85,
  });
  const rainLens = new THREE.Mesh(rainLensGeo, rainLensMat);
  rainLens.position.set(0, 0.28, 1.26);
  group.add(rainLens);

  // ══════════════════════════════════
  // ── Driver — ultra-detailed ──
  // ══════════════════════════════════
  const driver = new THREE.Group();
  const suitColor = darkCol.getHex();
  const suitMat = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.7 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.7 });

  // Torso — tapered cylinder with chest shape
  const torsoGeo = new THREE.CylinderGeometry(0.17, 0.21, 0.55, 12);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.y = 0.3;
  torso.castShadow = true;
  driver.add(torso);

  // Collar
  const collarGeo = new THREE.TorusGeometry(0.17, 0.03, 6, 12);
  const collar = new THREE.Mesh(collarGeo, suitMat);
  collar.position.y = 0.56;
  collar.rotation.x = Math.PI / 2;
  driver.add(collar);

  // Shoulders (rounded)
  const shoulderGeo = new THREE.SphereGeometry(0.11, 10, 10);
  for (const sx of [-0.22, 0.22]) {
    const shoulder = new THREE.Mesh(shoulderGeo, suitMat);
    shoulder.position.set(sx, 0.52, 0);
    driver.add(shoulder);
  }

  // Upper arms
  const upperArmGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.25, 8);
  // Forearms
  const forearmGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.22, 8);
  for (const sx of [-1, 1]) {
    // Upper arm
    const upperArm = new THREE.Mesh(upperArmGeo, suitMat);
    upperArm.position.set(sx * 0.28, 0.42, -0.04);
    upperArm.rotation.z = sx * 0.5;
    upperArm.rotation.x = -0.25;
    driver.add(upperArm);
    // Forearm
    const forearm = new THREE.Mesh(forearmGeo, suitMat);
    forearm.position.set(sx * 0.32, 0.3, -0.16);
    forearm.rotation.z = sx * 0.3;
    forearm.rotation.x = -0.6;
    driver.add(forearm);
  }

  // Gloves — detailed with cuff
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    // Hand
    const handGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const hand = new THREE.Mesh(handGeo, gloveMat);
    hand.position.set(sx * 0.33, 0.22, -0.26);
    driver.add(hand);
    // Cuff
    const cuffGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.04, 8);
    const cuff = new THREE.Mesh(cuffGeo, gloveMat);
    cuff.position.set(sx * 0.33, 0.25, -0.22);
    driver.add(cuff);
    // Thumb
    const thumbGeo = new THREE.SphereGeometry(0.02, 6, 6);
    const thumb = new THREE.Mesh(thumbGeo, gloveMat);
    thumb.position.set(sx * 0.3, 0.21, -0.28);
    driver.add(thumb);
  }

  // Head
  const headGeo = new THREE.SphereGeometry(0.19, 16, 16);
  headGeo.scale(1, 1.1, 1);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 0.78;
  head.castShadow = true;
  driver.add(head);

  // Helmet — multi-part
  // Main shell
  const helmetGeo = new THREE.SphereGeometry(0.235, 18, 14);
  const helmetMat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.2 });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.y = 0.82;
  helmet.scale.set(1, 0.96, 1.08);
  helmet.castShadow = true;
  driver.add(helmet);

  // Visor — curved dark glass
  const visorGeo = new THREE.SphereGeometry(0.24, 16, 8, -Math.PI * 0.42, Math.PI * 0.84, 0.28, 0.52);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0a1833,
    metalness: 0.95,
    roughness: 0.05,
    transparent: true,
    opacity: 0.75,
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.y = 0.82;
  visor.scale.set(1, 0.96, 1.08);
  driver.add(visor);

  // Visor frame
  const visorFrameGeo = new THREE.TorusGeometry(0.24, 0.008, 4, 24, Math.PI * 0.84);
  const visorFrameMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
  const visorFrame = new THREE.Mesh(visorFrameGeo, visorFrameMat);
  visorFrame.position.y = 0.82 + 0.24 * Math.cos(0.28) * 0.96;
  visorFrame.rotation.x = -(Math.PI / 2 - 0.28);
  visorFrame.rotation.y = -Math.PI * 0.42;
  driver.add(visorFrame);

  // Helmet vent
  const ventGeo = new THREE.BoxGeometry(0.12, 0.04, 0.06);
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const vent = new THREE.Mesh(ventGeo, ventMat);
  vent.position.set(0, 1.04, -0.12);
  driver.add(vent);

  // HANS device (neck brace look)
  const hansGeo = new THREE.TorusGeometry(0.15, 0.02, 4, 8, Math.PI);
  const hansMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const hans = new THREE.Mesh(hansGeo, hansMat);
  hans.position.set(0, 0.6, 0.02);
  hans.rotation.x = Math.PI / 2;
  hans.rotation.z = Math.PI;
  driver.add(hans);

  driver.position.set(0, 0.45, 0.15);
  group.add(driver);

  return { group, body, wheels, driver, headlightLenses, taillightMat: tailMat };
}
