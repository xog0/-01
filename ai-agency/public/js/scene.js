// 3D office built with Three.js: open workspace with desks, two glass
// meeting rooms, an executive wing of private offices, decor, and
// animated employee characters.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { MAX_DESKS, OPEN_DESKS } from './data.js';

const DESK_COLS = [-19.5, -15, -10.5, -6, -1.5];
const DESK_ROWS = [-11, -6, -1, 4, 9];
if (DESK_COLS.length * DESK_ROWS.length !== OPEN_DESKS) throw new Error('desk grid does not match OPEN_DESKS');

// Executive wing: two columns of private offices on either side of a hallway
// at x = HALL_X. People reach it from the open area through the gap between
// the meeting rooms (z = 0).
const HALL_X = 31;
const OFFICE_ROWS = [[-15, -8.5], [-7.5, -1], [1, 7.5], [8.5, 15]];
// Seat 25 is the CEO suite at the end of the axis (z = 0), beyond the wing.
const SUITE = { x0: 42, x1: 55, z0: -9.5, z1: 9.5, doorX: 42, inside: 1.5, suite: true };
const OFFICES = [
  SUITE,
  ...OFFICE_ROWS.map(([z0, z1]) => ({ x0: 22, x1: 30, z0, z1, doorX: 30, inside: -1 })),
  ...OFFICE_ROWS.map(([z0, z1]) => ({ x0: 32, x1: 40, z0, z1, doorX: 32, inside: 1 })),
].map((o) => ({ ...o, cx: (o.x0 + o.x1) / 2, cz: (o.z0 + o.z1) / 2, doorZ: o.suite ? 0 : (o.z0 + o.z1) / 2 }));
// Coffee corner at the front of the open area.
const PANTRY = { x: 0.5, z: 14.6, spotZ: 13.4 };
if (OPEN_DESKS + OFFICES.length !== MAX_DESKS) throw new Error('office count does not match MAX_DESKS');

export const ROOMS = {
  a: { name: 'قاعة الإبداع', x0: 7, x1: 20, z0: -14, z1: -2, doorZ: -5, seats: 8 },
  b: { name: 'غرفة التخطيط', x0: 7, x1: 20, z0: 2, z1: 14, doorZ: 5, seats: 6 },
};

const STATUS_COLORS = { idle: 0x4ade80, working: 0xfbbf24, meeting: 0x60a5fa, talking: 0xf472b6 };
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0xffdbac];
const HAIR = [0x2b1b12, 0x3b2314, 0x111111, 0x5a3825];

function deskPos(i) {
  if (i >= OPEN_DESKS) {
    const o = OFFICES[i - OPEN_DESKS];
    return o.suite ? { x: o.cx, z: o.cz - 3 } : { x: o.cx, z: o.cz - 0.8 };
  }
  const col = i % DESK_COLS.length;
  const row = Math.floor(i / DESK_COLS.length);
  return { x: DESK_COLS[col], z: DESK_ROWS[row] };
}
function chairPos(i) {
  const d = deskPos(i);
  return new THREE.Vector3(d.x, 0, d.z + 1.15);
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
}
function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function seatPositions(room) {
  const cx = (room.x0 + room.x1) / 2;
  const cz = (room.z0 + room.z1) / 2;
  const seats = [];
  const perSide = room.seats / 2;
  const span = room.seats === 8 ? 6 : 4.4;
  for (let s = 0; s < perSide; s++) {
    const x = cx - span / 2 + (span / (perSide - 1)) * s;
    seats.push({ pos: new THREE.Vector3(x, 0, cz - 1.9), face: new THREE.Vector3(x, 0, cz) });
    seats.push({ pos: new THREE.Vector3(x, 0, cz + 1.9), face: new THREE.Vector3(x, 0, cz) });
  }
  return { cx, cz, seats };
}

export function createOffice(container, { onSelect } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1220);
  scene.fog = new THREE.Fog(0x0f1220, 80, 170);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(8, 44, 52);
  const controls = new OrbitControls(camera, labelRenderer.domElement);
  controls.target.set(15, 0, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.44;
  controls.minDistance = 8;
  controls.maxDistance = 115;

  // Lights
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x2a2340, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-2, 36, 20);
  sun.target.position.set(16, 0, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 30, bottom: -30, near: 1, far: 110 });
  scene.add(sun);
  [[-9, -1], [13, -8], [13, 8], [26, -6], [36, 6], [48.5, 0]].forEach(([x, z]) => {
    const p = new THREE.PointLight(0xffe2b8, 18, 18, 1.6);
    p.position.set(x, 6, z);
    scene.add(p);
  });

  // Floor & walls
  const floor = box(80, 0.2, 32, std(0xe8e3da, { roughness: 0.9 }));
  floor.position.set(17, -0.1, 0);
  scene.add(floor);
  const carpet = box(23.5, 0.02, 26, std(0x3d4a6b, { roughness: 1 }));
  carpet.position.set(-10.5, 0.01, -0.5);
  scene.add(carpet);
  const wallMat = std(0xf6f2ec);
  const backWall = box(80, 4, 0.3, wallMat);
  backWall.position.set(17, 2, -16);
  scene.add(backWall);
  const sideWall = box(0.3, 4, 32, wallMat);
  sideWall.position.set(-23, 2, 0);
  scene.add(sideWall);

  // Company sign on the back wall
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 160;
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.5), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
  sign.position.set(-8, 2.6, -15.8);
  scene.add(sign);
  function setCompanyName(name) {
    const g = signCanvas.getContext('2d');
    g.clearRect(0, 0, 1024, 160);
    g.fillStyle = '#1e2240';
    g.beginPath();
    g.roundRect(4, 4, 1016, 152, 30);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 72px Tajawal, "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(name, 512, 84, 960);
    signTex.needsUpdate = true;
  }

  // Desks
  const deskTop = std(0xb98a5b);
  const metal = std(0x30343f, { metalness: 0.5, roughness: 0.4 });
  const screenMat = std(0x0b1020, { emissive: 0x2a5cff, emissiveIntensity: 0.6 });
  const chairMat = std(0x22263a);
  const deskScreens = [];
  for (let i = 0; i < OPEN_DESKS; i++) {
    const { x, z } = deskPos(i);
    const g = new THREE.Group();
    const top = box(2.6, 0.1, 1.3, deskTop);
    top.position.y = 1.0;
    g.add(top);
    [[-1.2, -0.55], [1.2, -0.55], [-1.2, 0.55], [1.2, 0.55]].forEach(([lx, lz]) => {
      const leg = box(0.08, 1.0, 0.08, metal);
      leg.position.set(lx, 0.5, lz);
      g.add(leg);
    });
    const mon = box(1.1, 0.65, 0.06, metal);
    mon.position.set(0, 1.5, -0.35);
    g.add(mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.55), screenMat.clone());
    scr.position.set(0, 1.5, -0.315);
    g.add(scr);
    deskScreens.push(scr);
    const stand = box(0.1, 0.3, 0.1, metal);
    stand.position.set(0, 1.18, -0.38);
    g.add(stand);
    const kb = box(0.7, 0.03, 0.22, std(0xdddddd));
    kb.position.set(0, 1.07, 0.15);
    g.add(kb);
    const chair = new THREE.Group();
    const seat = box(0.7, 0.1, 0.7, chairMat);
    seat.position.y = 0.6;
    const back = box(0.7, 0.8, 0.1, chairMat);
    back.position.set(0, 1.05, 0.33);
    const post = box(0.08, 0.55, 0.08, metal);
    post.position.y = 0.3;
    chair.add(seat, back, post);
    chair.position.set(0, 0, 1.25);
    g.add(chair);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  // Meeting rooms
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, side: THREE.DoubleSide });
  const frame = std(0x9aa3b5, { metalness: 0.6, roughness: 0.3 });
  const roomSeats = {};
  for (const [key, room] of Object.entries(ROOMS)) {
    const w = room.x1 - room.x0;
    const d = room.z1 - room.z0;
    const cx = (room.x0 + room.x1) / 2;
    const cz = (room.z0 + room.z1) / 2;
    const rug = box(w - 0.4, 0.03, d - 0.4, std(key === 'a' ? 0x5b3f8c : 0x2f6f73, { roughness: 1 }));
    rug.position.set(cx, 0.02, cz);
    scene.add(rug);
    const pane = (len, horizontal, px, pz) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? len : 0.06, 3.2, horizontal ? 0.06 : len), glass);
      p.position.set(px, 1.6, pz);
      scene.add(p);
      const rail = box(horizontal ? len : 0.1, 0.1, horizontal ? 0.1 : len, frame);
      rail.position.set(px, 3.2, pz);
      scene.add(rail);
    };
    pane(w, true, cx, room.z0);
    pane(w, true, cx, room.z1);
    pane(d, false, room.x1, cz);
    // West wall with a door gap around doorZ
    const gap = 2;
    const southLen = room.doorZ - gap / 2 - room.z0;
    const northLen = room.z1 - (room.doorZ + gap / 2);
    pane(southLen, false, room.x0, room.z0 + southLen / 2);
    pane(northLen, false, room.x0, room.z1 - northLen / 2);

    const { seats } = seatPositions(room);
    roomSeats[key] = seats;
    const tableLen = room.seats === 8 ? 7.4 : 5.6;
    const table = box(tableLen, 0.12, 2.4, std(0x2b2f3a, { roughness: 0.35 }));
    table.position.set(cx, 1.0, cz);
    scene.add(table);
    const base = box(tableLen * 0.6, 0.95, 0.6, metal);
    base.position.set(cx, 0.48, cz);
    scene.add(base);
    seats.forEach((s) => {
      const c = new THREE.Group();
      const seat = box(0.7, 0.1, 0.7, std(key === 'a' ? 0xff8a3d : 0x2ec4b6));
      seat.position.y = 0.6;
      const back = box(0.7, 0.8, 0.1, chairMat);
      back.position.set(0, 1.05, s.pos.z < cz ? -0.33 : 0.33);
      c.add(seat, back);
      c.position.set(s.pos.x, 0, s.pos.z + (s.pos.z < cz ? -0.15 : 0.15));
      scene.add(c);
    });
    // Wall screen
    const tv = box(4, 2.2, 0.1, metal);
    tv.position.set(room.x1 - 0.2, 2.1, cz);
    tv.rotation.y = Math.PI / 2;
    scene.add(tv);
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2), std(0x0b1020, { emissive: key === 'a' ? 0x7c3aed : 0x0ea5a4, emissiveIntensity: 0.5 }));
    tvScreen.position.set(room.x1 - 0.27, 2.1, cz);
    tvScreen.rotation.y = -Math.PI / 2;
    scene.add(tvScreen);

    const tag = document.createElement('div');
    tag.className = 'room-tag';
    tag.textContent = room.name;
    const tagObj = new CSS2DObject(tag);
    tagObj.position.set(cx, 3.8, cz);
    scene.add(tagObj);
  }

  // Executive wing: hallway runner, then one glass office per entry in OFFICES.
  const runner = box(2, 0.02, 30, std(0x6b5b4b, { roughness: 1 }));
  runner.position.set(HALL_X, 0.01, 0);
  scene.add(runner);
  const entry = box(11, 0.02, 2, std(0x6b5b4b, { roughness: 1 }));
  entry.position.set(25.5, 0.01, 0);
  scene.add(entry);
  const execWood = std(0x4a2f22, { roughness: 0.45 });
  const leather = std(0x1b1b22, { roughness: 0.5 });
  const officeTags = [];
  buildSuite(OFFICES[0]);
  OFFICES.forEach((o, k) => {
    if (o.suite) return;
    const w = o.x1 - o.x0;
    const d = o.z1 - o.z0;
    const rug = box(w - 0.6, 0.03, d - 0.6, std(k % 2 ? 0x3b4f6b : 0x4b3b6b, { roughness: 1 }));
    rug.position.set(o.cx, 0.02, o.cz);
    scene.add(rug);
    const pane = (len, horizontal, px, pz) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? len : 0.06, 3, horizontal ? 0.06 : len), glass);
      p.position.set(px, 1.5, pz);
      scene.add(p);
      const rail = box(horizontal ? len : 0.1, 0.1, horizontal ? 0.1 : len, frame);
      rail.position.set(px, 3, pz);
      scene.add(rail);
    };
    pane(w, true, o.cx, o.z0);
    pane(w, true, o.cx, o.z1);
    const farX = o.doorX === o.x1 ? o.x0 : o.x1;
    pane(d, false, farX, o.cz);
    const gap = 1.8;
    const sideLen = (d - gap) / 2;
    pane(sideLen, false, o.doorX, o.z0 + sideLen / 2);
    pane(sideLen, false, o.doorX, o.z1 - sideLen / 2);
    // Executive desk, monitor and high-back chair (same facing as open desks).
    const g = new THREE.Group();
    const top = box(3.2, 0.12, 1.5, execWood);
    top.position.y = 1.0;
    const body = box(3.0, 0.9, 1.3, execWood);
    body.position.set(0, 0.48, -0.05);
    const mon = box(1.2, 0.7, 0.06, metal);
    mon.position.set(0, 1.5, -0.4);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), screenMat.clone());
    scr.position.set(0, 1.5, -0.365);
    deskScreens.push(scr);
    const chair = new THREE.Group();
    const seat = box(0.8, 0.12, 0.8, leather);
    seat.position.y = 0.6;
    const back = box(0.8, 0.75, 0.12, leather);
    back.position.set(0, 1.02, 0.38);
    chair.add(seat, back);
    chair.position.set(0, 0, 1.3);
    g.add(top, body, mon, scr, chair);
    g.position.set(o.cx, 0, o.cz - 0.8);
    scene.add(g);
    const pot = box(0.5, 0.5, 0.5, std(0xf4f4f4));
    const px = farX + (farX > o.cx ? -0.7 : 0.7);
    pot.position.set(px, 0.25, o.z0 + 0.7);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), std(0x3f9b4f, { flatShading: true }));
    leaves.position.set(px, 1.0, o.z0 + 0.7);
    scene.add(pot, leaves);
    const tag = document.createElement('div');
    tag.className = 'room-tag office-tag';
    tag.textContent = 'مكتب شاغر';
    const tagObj = new CSS2DObject(tag);
    tagObj.position.set(o.cx, 3.3, o.z0 + 0.4); // on the back wall, above the desk
    scene.add(tagObj);
    officeTags.push(tag);
  });
  // The CEO suite: larger, with a gold frame, an executive desk, guest chairs,
  // a bookshelf, a sofa corner, a small meeting table and a wall screen.
  function buildSuite(o) {
    const gold = std(0xc9a227, { metalness: 0.7, roughness: 0.3 });
    const w = o.x1 - o.x0;
    const d = o.z1 - o.z0;
    const corridor = box(2, 0.02, 2, std(0x6b5b4b, { roughness: 1 }));
    corridor.position.set(41, 0.01, 0);
    scene.add(corridor);
    const rug = box(w - 0.6, 0.03, d - 0.6, std(0x3a2a20, { roughness: 1 }));
    rug.position.set(o.cx, 0.02, o.cz);
    const inner = box(6, 0.035, 4.5, std(0x7a2f2f, { roughness: 1 }));
    inner.position.set(o.cx, 0.03, o.cz - 3.2);
    scene.add(rug, inner);
    const pane = (len, horizontal, px, pz) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? len : 0.06, 3.4, horizontal ? 0.06 : len), glass);
      p.position.set(px, 1.7, pz);
      scene.add(p);
      const rail = box(horizontal ? len : 0.14, 0.14, horizontal ? 0.14 : len, gold);
      rail.position.set(px, 3.4, pz);
      scene.add(rail);
    };
    pane(w, true, o.cx, o.z0);
    pane(w, true, o.cx, o.z1);
    pane(d, false, o.x1, o.cz);
    const gap = 2.2;
    const sideLen = (d - gap) / 2;
    pane(sideLen, false, o.x0, o.z0 + sideLen / 2);
    pane(sideLen, false, o.x0, o.z1 - sideLen / 2);
    // Executive desk with gold trim, two screens, high-back chair.
    const g = new THREE.Group();
    const top = box(4.4, 0.14, 1.9, execWood);
    top.position.y = 1.02;
    const trim = box(4.42, 0.04, 1.92, gold);
    trim.position.y = 0.94;
    const bodyL = box(1.2, 0.9, 1.7, execWood);
    bodyL.position.set(-1.5, 0.47, 0);
    const bodyR = bodyL.clone();
    bodyR.position.x = 1.5;
    g.add(top, trim, bodyL, bodyR);
    [-0.65, 0.65].forEach((mx, i) => {
      const mon = box(1.2, 0.7, 0.06, metal);
      mon.position.set(mx, 1.55, -0.5);
      mon.rotation.y = mx < 0 ? 0.15 : -0.15;
      g.add(mon);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), screenMat.clone());
      scr.position.set(mx, 1.55, -0.465);
      scr.rotation.y = mon.rotation.y;
      g.add(scr);
      if (i === 0) deskScreens.push(scr); // one screen per seat lights up with its owner
    });
    const chair = new THREE.Group();
    const seat = box(0.9, 0.14, 0.9, leather);
    seat.position.y = 0.6;
    const back = box(0.9, 0.85, 0.14, leather);
    back.position.set(0, 1.08, 0.42);
    chair.add(seat, back);
    chair.position.set(0, 0, 1.3);
    g.add(chair);
    // Guest chairs across the desk, facing the CEO.
    [-0.9, 0.9].forEach((gx) => {
      const gc = new THREE.Group();
      const gs = box(0.7, 0.1, 0.7, std(0x8b6b4a));
      gs.position.y = 0.55;
      const gb = box(0.7, 0.7, 0.1, std(0x8b6b4a));
      gb.position.set(0, 0.95, -0.32);
      gc.add(gs, gb);
      gc.position.set(gx, 0, -1.9);
      g.add(gc);
    });
    g.position.set(o.cx, 0, o.cz - 3);
    scene.add(g);
    // Bookshelf on the back wall.
    const shelf = box(6, 3, 0.5, execWood);
    shelf.position.set(o.cx, 1.5, o.z0 + 0.45);
    scene.add(shelf);
    const bookColors = [0x7a2f2f, 0x1e3a5f, 0xc9a227, 0x2f5a3a, 0x5a3a6b];
    for (let r = 0; r < 3; r++) {
      for (let b = 0; b < 14; b++) {
        const bk = box(0.3, 0.6, 0.35, std(bookColors[(r * 5 + b) % 5]));
        bk.position.set(o.cx - 2.6 + b * 0.4, 0.55 + r * 0.95, o.z0 + 0.5);
        scene.add(bk);
      }
    }
    // Sofa corner near the front.
    const sofaM = std(0x2b2b33, { roughness: 0.6 });
    const sofa = box(3.6, 0.7, 1.1, sofaM);
    sofa.position.set(o.cx - 2.5, 0.35, o.z1 - 1.2);
    const sofaB = box(3.6, 0.9, 0.25, sofaM);
    sofaB.position.set(o.cx - 2.5, 1.0, o.z1 - 0.7);
    const table = box(1.8, 0.4, 0.9, execWood);
    table.position.set(o.cx - 2.5, 0.2, o.z1 - 2.7);
    scene.add(sofa, sofaB, table);
    // Small round meeting table.
    const mt = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 24), execWood);
    mt.position.set(o.cx + 3.6, 1.0, o.cz + 3.2);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 1.0, 12), metal);
    leg.position.set(o.cx + 3.6, 0.5, o.cz + 3.2);
    scene.add(mt, leg);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const c = box(0.55, 0.6, 0.55, leather);
      c.position.set(o.cx + 3.6 + Math.cos(a) * 1.4, 0.3, o.cz + 3.2 + Math.sin(a) * 1.4);
      scene.add(c);
    }
    // Wall screen on the far wall.
    const tv = box(0.1, 2, 3.6, metal);
    tv.position.set(o.x1 - 0.2, 2, o.cz + 3.2);
    const tvs = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), std(0x0b1020, { emissive: 0xc9a227, emissiveIntensity: 0.35 }));
    tvs.rotation.y = -Math.PI / 2;
    tvs.position.set(o.x1 - 0.27, 2, o.cz + 3.2);
    scene.add(tv, tvs);
    [[o.x0 + 0.8, o.z0 + 0.9], [o.x1 - 0.8, o.z0 + 0.9], [o.x1 - 0.8, o.z1 - 0.8]].forEach(([px, pz]) => {
      const pot = box(0.6, 0.6, 0.6, std(0xf4f4f4));
      pot.position.set(px, 0.3, pz);
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), std(0x3f9b4f, { flatShading: true }));
      leaves.position.set(px, 1.25, pz);
      scene.add(pot, leaves);
    });
    const tag = document.createElement('div');
    tag.className = 'room-tag office-tag suite-tag';
    tag.textContent = 'جناح المدير التنفيذي';
    const tagObj = new CSS2DObject(tag);
    tagObj.position.set(o.cx, 3.9, o.z0 + 0.4);
    scene.add(tagObj);
    officeTags.push(tag);
  }

  // Coffee corner: counter, machine and water cooler at the front of the open area.
  const counter = box(3.6, 1.0, 0.8, std(0xd9d4cc));
  counter.position.set(PANTRY.x, 0.5, PANTRY.z + 0.6);
  const counterTop = box(3.7, 0.06, 0.9, std(0x2b2f3a));
  counterTop.position.set(PANTRY.x, 1.03, PANTRY.z + 0.6);
  const machine = box(0.5, 0.6, 0.45, std(0x1b1b22, { metalness: 0.5 }));
  machine.position.set(PANTRY.x - 1, 1.36, PANTRY.z + 0.6);
  const cooler = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16), new THREE.MeshPhysicalMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.6 }));
  cooler.position.set(PANTRY.x + 1.1, 1.31, PANTRY.z + 0.6);
  scene.add(counter, counterTop, machine, cooler);
  const pantryTag = document.createElement('div');
  pantryTag.className = 'room-tag';
  pantryTag.textContent = '☕ ركن القهوة';
  const pantryTagObj = new CSS2DObject(pantryTag);
  pantryTagObj.position.set(PANTRY.x, 2.4, PANTRY.z + 0.6);
  scene.add(pantryTagObj);

  function setOfficeLabel(k, text, occupied) {
    const tag = officeTags[k];
    if (!tag) return;
    tag.textContent = text;
    tag.classList.toggle('vacant', !occupied);
  }

  // Decor: plants, lounge, water cooler
  const plant = (x, z) => {
    const pot = box(0.6, 0.6, 0.6, std(0xf4f4f4));
    pot.position.set(x, 0.3, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), std(0x3f9b4f, { flatShading: true }));
    leaves.position.set(x, 1.25, z);
    leaves.castShadow = true;
    scene.add(pot, leaves);
  };
  [[-22, -15], [5, -15], [-22, 14], [5, 14]].forEach(([x, z]) => plant(x + (x < 0 ? 0.8 : -0.8), z + (z < 0 ? 0.8 : -0.8)));
  const sofa = box(4, 0.8, 1.2, std(0x8b5cf6));
  sofa.position.set(-10.5, 0.4, 14.6);
  const sofaBack = box(4, 1, 0.3, std(0x7c3aed));
  sofaBack.position.set(-10.5, 1.1, 15.1);
  const coffee = box(2, 0.5, 1, std(0xb98a5b));
  coffee.position.set(-10.5, 0.25, 13.3);
  scene.add(sofa, sofaBack, coffee);

  // ------------------------------------------------------------------ actors
  const actors = new Map();
  const pickables = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // A jointed figure: legs bend at hip and knee so people can sit, arms bend
  // at shoulder and elbow so they can type and gesture. Looks come from
  // emp.look (hair style, hijab, beard, glasses, clothes by rank, height).
  const HAIR_COLORS = [0x2b1b12, 0x3b2314, 0x111111, 0x6b4a2f];
  const SKIN_TONES = [0xf3d2b3, 0xe0ac69, 0xc68642, 0xf1c9a5];
  const limb = (r, len, mat) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
    m.castShadow = true;
    return m;
  };

  function makeCharacter(emp) {
    const look = emp.look || {};
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(look.height || 1);
    g.add(body);

    const skin = std(SKIN_TONES[look.skin ?? 0], { roughness: 0.6 });
    const hairMat = std(HAIR_COLORS[look.hairColor ?? 0], { roughness: 0.9 });
    const dept = emp.color;
    const outfit = look.outfit || 'casual';
    const jacket = outfit === 'suit' ? std(0x1f2433, { roughness: 0.55 }) : std(dept, { roughness: 0.7 });
    const shirtFront = std(outfit === 'suit' ? 0xf4f4f6 : dept);
    const pantsMat = std(outfit === 'casual' ? 0x3b4a6b : 0x23262f);
    const shoeMat = std(outfit === 'casual' ? 0xe8e8ec : 0x15110e, { roughness: 0.4 });

    // Legs: hip pivot -> thigh -> knee pivot -> shin -> shoe (front is -z).
    const makeLeg = (x) => {
      const hip = new THREE.Group();
      hip.position.set(x, 0.95, 0);
      const thigh = limb(0.1, 0.3, pantsMat);
      thigh.position.y = -0.22;
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      const shin = limb(0.085, 0.3, pantsMat);
      shin.position.y = -0.2;
      const shoe = box(0.17, 0.09, 0.3, shoeMat);
      shoe.position.set(0, -0.44, -0.05);
      knee.add(shin, shoe);
      hip.add(thigh, knee);
      body.add(hip);
      return { hip, knee };
    };
    const legL = makeLeg(-0.12);
    const legR = makeLeg(0.12);

    // Torso and neck.
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.4, 4, 14), jacket);
    torso.scale.set(1.2, 1, 0.78);
    torso.position.y = 1.3;
    torso.castShadow = true;
    const hipsBlock = box(0.5, 0.16, 0.3, pantsMat);
    hipsBlock.position.y = 0.98;
    body.add(torso, hipsBlock);
    if (outfit === 'suit' || outfit === 'tie') {
      const shirtV = box(0.16, 0.34, 0.02, shirtFront);
      shirtV.position.set(0, 1.42, -0.2);
      const tie = box(0.06, 0.3, 0.02, std(outfit === 'suit' ? dept : 0x1f2433));
      tie.position.set(0, 1.39, -0.215);
      body.add(shirtV, tie);
    } else if (outfit === 'shirt') {
      const collar = box(0.26, 0.05, 0.05, std(0xf4f4f6));
      collar.position.set(0, 1.63, -0.14);
      body.add(collar);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.12, 10), skin);
    neck.position.y = 1.68;
    body.add(neck);

    // Head with face details.
    const headPivot = new THREE.Group();
    headPivot.position.y = 1.74;
    body.add(headPivot);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), skin);
    head.scale.set(1, 1.12, 1.02);
    head.position.y = 0.18;
    head.castShadow = true;
    headPivot.add(head);
    const dark = std(0x1a1410);
    [-0.07, 0.07].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), dark);
      eye.position.set(ex, 0.21, -0.175);
      const brow = box(0.07, 0.014, 0.02, hairMat);
      brow.position.set(ex, 0.265, -0.172);
      headPivot.add(eye, brow);
    });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 8), skin);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.16, -0.2);
    const mouth = box(0.07, 0.012, 0.01, std(0x8a3b3b));
    mouth.position.set(0, 0.095, -0.185);
    headPivot.add(nose, mouth);

    // Hair styles.
    const cap = (r, thetaLen) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, thetaLen), hairMat);
    if (look.hair === 'hijab') {
      const hijabMat = std(look.hijab ?? 0x1e2a4a, { roughness: 0.8 });
      // A hood open at the face (front is -z, phi = 3pi/2), and a drape over neck and shoulders.
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.215, 28, 18, -Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.8), hijabMat);
      hood.scale.set(1, 1.12, 1.04);
      hood.position.y = 0.18;
      const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.212, 24, 8, 0, Math.PI * 2, 0, 0.5), hijabMat);
      forehead.scale.set(1, 1.12, 1.04);
      forehead.position.y = 0.19;
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.33, 0.32, 24, 1, true), hijabMat);
      drape.position.y = -0.06;
      headPivot.add(hood, forehead, drape);
    } else {
      const top = cap(look.hair === 'buzz' ? 0.195 : 0.205, look.hair === 'buzz' ? 1.2 : 1.45);
      top.scale.set(1, 1.12, 1.04);
      top.position.set(0, look.hair === 'buzz' ? 0.185 : 0.19, 0.01);
      headPivot.add(top);
      if (look.hair === 'curly') {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const curl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hairMat);
          curl.position.set(Math.cos(a) * 0.15, 0.36 + (i % 2) * 0.02, Math.sin(a) * 0.15 + 0.03);
          headPivot.add(curl);
        }
      } else if (look.hair === 'long') {
        const back = box(0.36, 0.5, 0.12, hairMat);
        back.position.set(0, 0.02, 0.15);
        headPivot.add(back);
      } else if (look.hair === 'bun') {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), hairMat);
        bun.position.set(0, 0.36, 0.14);
        headPivot.add(bun);
      }
    }
    if (look.beard && look.hair !== 'hijab') {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.198, 20, 10, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.55, Math.PI * 0.4), hairMat);
      beard.rotation.y = Math.PI; // the half facing -z
      beard.scale.set(1, 1.12, 1.04);
      beard.position.y = 0.18;
      headPivot.add(beard);
    }
    if (look.glasses) {
      const frameMat = std(0x111111, { metalness: 0.4 });
      [-0.07, 0.07].forEach((ex) => {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 6, 16), frameMat);
        lens.position.set(ex, 0.21, -0.19);
        headPivot.add(lens);
      });
      const bridge = box(0.05, 0.01, 0.01, frameMat);
      bridge.position.set(0, 0.215, -0.195);
      headPivot.add(bridge);
    }

    // Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm -> hand.
    const sleeve = outfit === 'casual' ? skin : jacket;
    const makeArm = (x) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(x, 1.56, 0);
      const upper = limb(0.065, 0.24, jacket);
      upper.position.y = -0.17;
      const elbow = new THREE.Group();
      elbow.position.y = -0.34;
      const fore = limb(0.055, 0.22, sleeve);
      fore.position.y = -0.15;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin);
      hand.position.y = -0.32;
      elbow.add(fore, hand);
      shoulder.add(upper, elbow);
      shoulder.rotation.z = x < 0 ? 0.08 : -0.08;
      body.add(shoulder);
      return { shoulder, elbow };
    };
    const armL = makeArm(-0.33);
    const armR = makeArm(0.33);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: STATUS_COLORS.idle }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    g.add(ring);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.3, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.15;
    hit.userData.empId = emp.id;
    g.add(hit);
    pickables.push(hit);

    const label = document.createElement('div');
    label.className = 'emp-label';
    const nameEl = document.createElement('strong');
    const titleEl = document.createElement('span');
    const bubble = document.createElement('em');
    bubble.className = 'bubble';
    label.append(bubble, nameEl, titleEl);
    label.addEventListener('click', () => onSelect?.(emp.id));
    const labelObj = new CSS2DObject(label);
    labelObj.position.set(0, 2.45, 0);
    g.add(labelObj);

    return { group: g, body, legL, legR, armL, armR, headPivot, torso, ring, hit, label, nameEl, titleEl, bubble, labelObj, scale: look.height || 1 };
  }

  function addEmployee(emp, title) {
    const a = makeCharacter(emp);
    const seat = chairPos(emp.desk);
    a.group.position.copy(seat);
    a.group.rotation.y = 0;
    a.path = [];
    a.seat = seat;
    a.deskIndex = emp.desk;
    a.facing = new THREE.Vector3(seat.x, 0, seat.z - 5);
    a.status = 'idle';
    a.phase = Math.random() * Math.PI * 2;
    a.location = 'desk';
    a.sitting = true;
    scene.add(a.group);
    actors.set(emp.id, a);
    updateEmployee(emp, title);
    deskScreens[emp.desk].material.emissiveIntensity = 1.1;
  }

  function updateEmployee(emp, title) {
    const a = actors.get(emp.id);
    if (!a) return;
    a.nameEl.textContent = emp.name;
    a.titleEl.textContent = title;
  }

  function removeEmployee(id) {
    const a = actors.get(id);
    if (!a) return;
    scene.remove(a.group);
    a.group.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); });
    pickables.splice(pickables.indexOf(a.hit), 1);
    actors.delete(id);
  }

  function setDeskLit(desk, lit) {
    deskScreens[desk].material.emissiveIntensity = lit ? 1.1 : 0.6;
  }

  function setStatus(id, status, bubbleText = '') {
    const a = actors.get(id);
    if (!a) return;
    a.status = status;
    a.ring.material.color.setHex(STATUS_COLORS[status] ?? STATUS_COLORS.idle);
    a.bubble.textContent = bubbleText;
    a.label.classList.toggle('has-bubble', Boolean(bubbleText));
  }

  function setSelected(id) {
    for (const [eid, a] of actors) a.label.classList.toggle('selected', eid === id);
  }

  // From someone's own seat to the corridor at x=4: along the aisle behind an
  // open desk, or out of a private office, down the hallway and through the
  // gap between the meeting rooms.
  function exitPath(a) {
    if (a.deskIndex >= OPEN_DESKS) {
      const o = OFFICES[a.deskIndex - OPEN_DESKS];
      return [
        new THREE.Vector3(o.doorX + o.inside, 0, o.doorZ),
        new THREE.Vector3(HALL_X, 0, o.doorZ),
        new THREE.Vector3(HALL_X, 0, 0),
        new THREE.Vector3(4, 0, 0),
      ];
    }
    const aisleZ = a.seat.z + 1.4;
    return [new THREE.Vector3(a.seat.x, 0, aisleZ), new THREE.Vector3(4, 0, aisleZ)];
  }

  const seatFace = (a) => new THREE.Vector3(a.seat.x, 0, a.seat.z - 5);

  // From wherever someone is (own seat or the coffee corner) to the corridor.
  function toCorridor(a) {
    if (a.location === 'break') return [new THREE.Vector3(4, 0, PANTRY.spotZ)];
    return exitPath(a);
  }

  // Waypoints between a seat and a meeting room seat via the corridor at x=4.
  function routeToRoom(a, roomKey, seat) {
    const room = ROOMS[roomKey];
    return [
      ...toCorridor(a),
      new THREE.Vector3(4, 0, room.doorZ),
      new THREE.Vector3(room.x0 + 1.5, 0, room.doorZ),
      new THREE.Vector3(seat.pos.x, 0, room.doorZ + (seat.pos.z > room.doorZ ? 0.5 : -0.5)),
      seat.pos.clone(),
    ];
  }

  // Walk along waypoints; if rendering is throttled (background tab, slow GPU)
  // snap to the destination after a few seconds so callers never hang.
  function walk(a, path, face, { sit = false } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        a.group.position.copy(path.at(-1));
        a.path = [];
        a.onArrive = null;
        a.facing = face;
        a.sitting = sit;
        resolve();
      };
      let length = 0;
      path.reduce((from, p) => { length += from.distanceTo(p); return p; }, a.group.position);
      a.sitting = false;
      const timer = setTimeout(finish, Math.max(9000, (length / SPEED) * 1000 * 2.5));
      a.cancelWalk?.(); // a newer walk replaces any walk still in progress
      a.cancelWalk = () => { done = true; clearTimeout(timer); resolve(); };
      a.path = path.slice();
      a.onArrive = finish;
    });
  }

  function sendToMeeting(ids, roomKey) {
    const seats = roomSeats[roomKey];
    return Promise.all(ids.map((id, i) => {
      const a = actors.get(id);
      if (!a || !seats[i]) return Promise.resolve();
      const path = routeToRoom(a, roomKey, seats[i]);
      a.location = roomKey;
      a.holding = false;
      return walk(a, path, seats[i].face, { sit: true });
    }));
  }

  function returnToDesks(ids) {
    return Promise.all(ids.map((id) => {
      const a = actors.get(id);
      if (!a || a.location === 'desk') return Promise.resolve();
      const room = ROOMS[a.location];
      const p = a.group.position;
      a.location = 'desk';
      return walk(a, [
        new THREE.Vector3(p.x, 0, room.doorZ + (p.z > room.doorZ ? 0.5 : -0.5)),
        new THREE.Vector3(room.x0 + 1.5, 0, room.doorZ),
        new THREE.Vector3(4, 0, room.doorZ),
        ...exitPath(a).reverse(),
        a.seat.clone(),
      ], seatFace(a), { sit: true });
    }));
  }

  // A short break at the coffee corner; they come back on their own.
  function takeBreak(id, ms = 8000) {
    const a = actors.get(id);
    if (!a || a.location !== 'desk' || a.path.length) return false;
    const spot = new THREE.Vector3(PANTRY.x + (Math.random() * 2.6 - 1.3), 0, PANTRY.spotZ);
    const path = [...exitPath(a), new THREE.Vector3(4, 0, PANTRY.spotZ), spot];
    a.location = 'break';
    walk(a, path, new THREE.Vector3(spot.x, 0, PANTRY.z + 5)).then(() => {
      setTimeout(() => { if (a.location === 'break') recall(id); }, ms);
    });
    return true;
  }

  // Walk someone to stand beside another person's seat (to hand over work).
  function visit(id, targetId) {
    const a = actors.get(id);
    const m = actors.get(targetId);
    if (!a || !m || a.location !== 'desk' || m.location !== 'desk' || m.path.length) return Promise.resolve(false);
    let stand;
    if (m.deskIndex === OPEN_DESKS) stand = new THREE.Vector3(m.seat.x - 1.3, 0, m.seat.z + 0.3);
    else if (m.deskIndex > OPEN_DESKS) stand = new THREE.Vector3(m.seat.x + 1.0, 0, m.seat.z + 0.3);
    else stand = new THREE.Vector3(m.seat.x + 0.95, 0, m.seat.z + 0.15);
    const there = [...exitPath(a), ...exitPath(m).reverse(), stand];
    a.backPath = [...there.slice(0, -1).reverse(), a.seat.clone()];
    a.location = 'visit';
    a.holding = true;
    a.visiting = m;
    return walk(a, there, m.group.position.clone()).then(() => {
      if (a.location === 'visit' && !m.path.length && m.location === 'desk') m.facing = a.group.position.clone();
      return true;
    });
  }

  // Back to one's own seat from the coffee corner or a visit.
  function recall(id) {
    const a = actors.get(id);
    if (!a) return Promise.resolve();
    a.holding = false;
    if (a.visiting) {
      if (a.visiting.location === 'desk' && !a.visiting.path.length) a.visiting.facing = seatFace(a.visiting);
      a.visiting = null;
    }
    if (a.location === 'break') {
      a.location = 'desk';
      return walk(a, [new THREE.Vector3(4, 0, PANTRY.spotZ), ...exitPath(a).reverse(), a.seat.clone()], seatFace(a), { sit: true });
    }
    if (a.location === 'visit') {
      a.location = 'desk';
      return walk(a, a.backPath, seatFace(a), { sit: true });
    }
    return Promise.resolve();
  }

  const whereIs = (id) => actors.get(id)?.location;

  // Smooth camera focus
  let focusAnim = null;
  function focusOn(target) {
    let point;
    if (typeof target === 'string' && ROOMS[target]) {
      const r = ROOMS[target];
      point = new THREE.Vector3((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    } else if (actors.has(target)) {
      point = actors.get(target).group.position.clone();
    } else {
      point = new THREE.Vector3(15, 0, 0);
    }
    const dist = target === 'overview' ? 64 : ROOMS[target] ? 20 : 13;
    const dir = camera.position.clone().sub(controls.target).normalize();
    focusAnim = {
      fromT: controls.target.clone(), toT: point,
      fromC: camera.position.clone(), toC: point.clone().add(dir.multiplyScalar(dist)),
      t: 0,
    };
  }

  // Picking
  let downAt = null;
  labelRenderer.domElement.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  labelRenderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit) onSelect?.(hit.object.userData.empId);
  });

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const SPEED = 4.2;
  renderer.setAnimationLoop(() => {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const moveDt = Math.min(rawDt, 0.5);
    const t = clock.elapsedTime;
    const k = Math.min(1, dt * 8);
    const ease = (obj, axis, target) => { obj.rotation[axis] += (target - obj.rotation[axis]) * k; };
    for (const a of actors.values()) {
      const walking = a.path.length > 0;
      const sitting = !walking && a.sitting;
      const busy = a.status === 'working';
      const talking = a.status === 'talking';
      if (walking) {
        const next = a.path[0];
        tmp.copy(next).sub(a.group.position);
        const dist = tmp.length();
        if (dist < 0.05) {
          a.group.position.copy(next);
          a.path.shift();
          if (!a.path.length) a.onArrive?.();
        } else {
          a.group.position.add(tmp.multiplyScalar(Math.min(1, (SPEED * moveDt) / dist)));
          a.group.rotation.y = Math.atan2(-(next.x - a.group.position.x), -(next.z - a.group.position.z));
        }
      } else {
        const target = Math.atan2(-(a.facing.x - a.group.position.x), -(a.facing.z - a.group.position.z));
        const diff = Math.atan2(Math.sin(target - a.group.rotation.y), Math.cos(target - a.group.rotation.y));
        a.group.rotation.y += diff * Math.min(1, dt * 6);
      }

      // Pose targets.
      const stride = Math.sin(t * 9 + a.phase);
      let hipL = 0; let hipR = 0; let kneeL = 0; let kneeR = 0;
      let shL = 0; let shR = 0; let elL = 0.15; let elR = 0.15;
      let headX = 0; let headY = 0; let lean = 0;
      let bodyY = 0;
      if (walking) {
        hipL = stride * 0.55; hipR = -stride * 0.55;
        kneeL = -Math.max(0, -stride) * 0.9; kneeR = -Math.max(0, stride) * 0.9;
        shL = -stride * 0.45; shR = stride * 0.45; elL = elR = 0.35;
        bodyY = Math.abs(Math.cos(t * 9 + a.phase)) * 0.04;
      } else if (sitting) {
        hipL = hipR = 1.5; kneeL = kneeR = -1.45;
        bodyY = 0.64 - 0.95 * a.scale;
        if (busy) {
          // Typing: forearms forward over the keyboard, hands tapping in turn.
          shL = 0.6 + Math.sin(t * 14 + a.phase) * 0.06; shR = 0.6 + Math.sin(t * 14 + a.phase + 1.6) * 0.06;
          elL = elR = 0.95; headX = 0.18; lean = 0.08;
        } else if (talking) {
          shL = 0.35; elL = 0.8;
          shR = 0.9 + Math.sin(t * 4 + a.phase) * 0.25; elR = 1.1 + Math.sin(t * 6) * 0.2;
          headX = Math.sin(t * 5) * 0.06; headY = Math.sin(t * 0.8 + a.phase) * 0.25;
        } else {
          // Resting: hands on the desk, now and then looking around.
          shL = shR = 0.4; elL = elR = 0.75;
          headY = Math.sin(t * 0.35 + a.phase) > 0.75 ? Math.sin(t * 0.9 + a.phase) * 0.55 : 0;
          lean = 0.03;
        }
      } else {
        // Standing.
        shL = Math.sin(t * 1.2 + a.phase) * 0.03; shR = -shL;
        if (talking) { shR = 0.8 + Math.sin(t * 4) * 0.3; elR = 1.0; headX = Math.sin(t * 5) * 0.06; }
        if (a.holding) { shL = shR = 0.7; elL = elR = 0.9; }
        bodyY = Math.sin(t * 1.6 + a.phase) * 0.01;
      }
      ease(a.legL.hip, 'x', hipL); ease(a.legR.hip, 'x', hipR);
      ease(a.legL.knee, 'x', kneeL); ease(a.legR.knee, 'x', kneeR);
      ease(a.armL.shoulder, 'x', shL); ease(a.armR.shoulder, 'x', shR);
      ease(a.armL.elbow, 'x', elL); ease(a.armR.elbow, 'x', elR);
      ease(a.headPivot, 'x', headX); ease(a.headPivot, 'y', headY);
      ease(a.body, 'x', lean);
      a.body.position.y += (bodyY - a.body.position.y) * k;
      a.ring.scale.setScalar(a.status === 'idle' ? 1 : 1 + Math.sin(t * 5) * 0.08);
    }
    if (focusAnim) {
      focusAnim.t = Math.min(1, focusAnim.t + dt * 1.4);
      const k = 1 - Math.pow(1 - focusAnim.t, 3);
      controls.target.lerpVectors(focusAnim.fromT, focusAnim.toT, k);
      camera.position.lerpVectors(focusAnim.fromC, focusAnim.toC, k);
      if (focusAnim.t >= 1) focusAnim = null;
    }
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });

  return {
    addEmployee, updateEmployee, removeEmployee, setStatus, setSelected, sendToMeeting, returnToDesks,
    focusOn, setCompanyName, setDeskLit, setOfficeLabel, takeBreak, visit, recall, whereIs,
  };
}
