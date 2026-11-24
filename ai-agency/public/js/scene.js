// 3D office built with Three.js: open workspace with desks, two glass
// meeting rooms, decor, and animated employee characters.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const DESK_COLS = [-18, -12, -6, 0];
const DESK_ROWS = [-10, -4, 2, 8];
export const MAX_DESKS = DESK_COLS.length * DESK_ROWS.length;

export const ROOMS = {
  a: { name: 'قاعة الإبداع', x0: 7, x1: 20, z0: -14, z1: -2, doorZ: -5, seats: 8 },
  b: { name: 'غرفة التخطيط', x0: 7, x1: 20, z0: 2, z1: 14, doorZ: 5, seats: 6 },
};

const STATUS_COLORS = { idle: 0x4ade80, working: 0xfbbf24, meeting: 0x60a5fa, talking: 0xf472b6 };
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0xffdbac];
const HAIR = [0x2b1b12, 0x3b2314, 0x111111, 0x5a3825];

function deskPos(i) {
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
  scene.fog = new THREE.Fog(0x0f1220, 60, 110);

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
  camera.position.set(-6, 30, 32);
  const controls = new OrbitControls(camera, labelRenderer.domElement);
  controls.target.set(-1, 0, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.44;
  controls.minDistance = 8;
  controls.maxDistance = 70;

  // Lights
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x2a2340, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-18, 34, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 25, bottom: -25, near: 1, far: 90 });
  scene.add(sun);
  [[-9, -1], [13, -8], [13, 8]].forEach(([x, z]) => {
    const p = new THREE.PointLight(0xffe2b8, 18, 18, 1.6);
    p.position.set(x, 6, z);
    scene.add(p);
  });

  // Floor & walls
  const floor = box(46, 0.2, 32, std(0xe8e3da, { roughness: 0.9 }));
  floor.position.y = -0.1;
  scene.add(floor);
  const carpet = box(25, 0.02, 25, std(0x3d4a6b, { roughness: 1 }));
  carpet.position.set(-9, 0.01, -0.5);
  scene.add(carpet);
  const wallMat = std(0xf6f2ec);
  const backWall = box(46, 4, 0.3, wallMat);
  backWall.position.set(0, 2, -16);
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
  for (let i = 0; i < MAX_DESKS; i++) {
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

  // Decor: plants, lounge, water cooler
  const plant = (x, z) => {
    const pot = box(0.6, 0.6, 0.6, std(0xf4f4f4));
    pot.position.set(x, 0.3, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), std(0x3f9b4f, { flatShading: true }));
    leaves.position.set(x, 1.25, z);
    leaves.castShadow = true;
    scene.add(pot, leaves);
  };
  [[-22, -15], [5, -15], [-22, 14], [5, 14], [21, -1], [21, 1.2]].forEach(([x, z]) => plant(x + (x < 0 ? 0.8 : -0.8), z + (z < 0 ? 0.8 : -0.8)));
  const sofa = box(4, 0.8, 1.2, std(0x8b5cf6));
  sofa.position.set(-8, 0.4, 14.2);
  const sofaBack = box(4, 1, 0.3, std(0x7c3aed));
  sofaBack.position.set(-8, 1.1, 14.7);
  const coffee = box(2, 0.5, 1, std(0xb98a5b));
  coffee.position.set(-8, 0.25, 12.6);
  scene.add(sofa, sofaBack, coffee);

  // ------------------------------------------------------------------ actors
  const actors = new Map();
  const pickables = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function makeCharacter(emp, idx) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const shirt = std(emp.color);
    const pants = std(0x2a2f45);
    const skin = std(SKIN[idx % SKIN.length]);
    const hairMat = std(HAIR[idx % HAIR.length]);
    const legL = box(0.22, 0.75, 0.22, pants);
    legL.position.set(-0.14, 0.38, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.55, 4, 12), shirt);
    torso.position.y = 1.15;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    hair.position.y = 1.88;
    body.add(legL, legR, torso, head, hair);
    if (emp.gender === 'f') {
      const longHair = box(0.5, 0.55, 0.16, hairMat);
      longHair.position.set(0, 1.66, 0.2);
      body.add(longHair);
    }
    const eyeMat = std(0x111111);
    [-0.09, 0.09].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat);
      eye.position.set(ex, 1.88, -0.25);
      body.add(eye);
    });
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
    labelObj.position.set(0, 2.55, 0);
    g.add(labelObj);

    return { group: g, body, legL, legR, ring, hit, label, nameEl, titleEl, bubble, labelObj };
  }

  function addEmployee(emp, title) {
    const a = makeCharacter(emp, actors.size);
    const seat = chairPos(emp.desk);
    a.group.position.copy(seat);
    a.group.rotation.y = 0;
    a.path = [];
    a.seat = seat;
    a.facing = new THREE.Vector3(seat.x, 0, seat.z - 5);
    a.status = 'idle';
    a.phase = Math.random() * Math.PI * 2;
    a.location = 'desk';
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

  // Waypoints between a desk and a meeting room seat via the corridor at x=4.
  function routeToRoom(a, roomKey, seat) {
    const room = ROOMS[roomKey];
    const p = a.group.position;
    const aisleZ = p.z + 1.4;
    return [
      new THREE.Vector3(p.x, 0, aisleZ),
      new THREE.Vector3(4, 0, aisleZ),
      new THREE.Vector3(4, 0, room.doorZ),
      new THREE.Vector3(room.x0 + 1.5, 0, room.doorZ),
      new THREE.Vector3(seat.pos.x, 0, room.doorZ + (seat.pos.z > room.doorZ ? 0.5 : -0.5)),
      seat.pos.clone(),
    ];
  }

  // Walk along waypoints; if rendering is throttled (background tab, slow GPU)
  // snap to the destination after a few seconds so callers never hang.
  function walk(a, path, face) {
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
        resolve();
      };
      const timer = setTimeout(finish, 9000);
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
      a.location = roomKey;
      return walk(a, routeToRoom(a, roomKey, seats[i]), seats[i].face);
    }));
  }

  function returnToDesks(ids) {
    return Promise.all(ids.map((id) => {
      const a = actors.get(id);
      if (!a || a.location === 'desk') return Promise.resolve();
      const room = ROOMS[a.location];
      const p = a.group.position;
      const aisleZ = a.seat.z + 1.4;
      a.location = 'desk';
      return walk(a, [
        new THREE.Vector3(p.x, 0, room.doorZ + (p.z > room.doorZ ? 0.5 : -0.5)),
        new THREE.Vector3(room.x0 + 1.5, 0, room.doorZ),
        new THREE.Vector3(4, 0, room.doorZ),
        new THREE.Vector3(4, 0, aisleZ),
        new THREE.Vector3(a.seat.x, 0, aisleZ),
        a.seat.clone(),
      ], new THREE.Vector3(a.seat.x, 0, a.seat.z - 5));
    }));
  }

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
      point = new THREE.Vector3(-1, 0, 0);
    }
    const dist = target === 'overview' ? 44 : ROOMS[target] ? 20 : 13;
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
    for (const a of actors.values()) {
      if (a.path.length) {
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
        const swing = Math.sin(t * 12) * 0.5;
        a.legL.rotation.x = swing;
        a.legR.rotation.x = -swing;
        a.body.position.y = Math.abs(Math.sin(t * 12)) * 0.06;
      } else {
        a.legL.rotation.x = a.legR.rotation.x = 0;
        const target = Math.atan2(-(a.facing.x - a.group.position.x), -(a.facing.z - a.group.position.z));
        const diff = Math.atan2(Math.sin(target - a.group.rotation.y), Math.cos(target - a.group.rotation.y));
        a.group.rotation.y += diff * Math.min(1, dt * 6);
        const busy = a.status === 'working' || a.status === 'talking';
        a.body.position.y = busy ? Math.abs(Math.sin(t * 9 + a.phase)) * 0.05 : Math.sin(t * 1.6 + a.phase) * 0.015;
      }
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

  return { addEmployee, updateEmployee, removeEmployee, setStatus, setSelected, sendToMeeting, returnToDesks, focusOn, setCompanyName, setDeskLit };
}
