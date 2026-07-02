import * as THREE from "./vendor/three.module.js";

const canvas = document.querySelector("#world");
const startButton = document.querySelector("#start");
const restartButton = document.querySelector("#restart");
const ending = document.querySelector("#ending");
const eyeCount = document.querySelector("#eye-count");
const gateState = document.querySelector("#gate-state");
const timeState = document.querySelector("#time-state");
const testParams = new URLSearchParams(window.location.search);
const DAY_SECONDS = testParams.has("fastcycle") ? 5 : 120;
const NIGHT_SECONDS = testParams.has("fastcycle") ? 5 : 120;
const CYCLE_SECONDS = DAY_SECONDS + NIGHT_SECONDS;
const TRANSITION_SECONDS = Math.min(6, DAY_SECONDS / 3, NIGHT_SECONDS / 3);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xfad6df, 0.018);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(0, 5.9, 30);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();
const world = new THREE.Group();
const eyes = [];
scene.add(world);

const state = { yaw: 0, pitch: 0, keys: new Set(), leftPunch: 0, rightPunch: 0, leftCooldown: 0, rightCooldown: 0, pressedEyes: 0, gateOpen: false, gatePassed: false, startedAt: null, isNight: false };
const pastelSky = new THREE.Color(0xffd4e5);
const lateSky = new THREE.Color(0xf3b89d);
const nightSky = new THREE.Color(0x11172f);
const dayFogColor = new THREE.Color(0xfad6df);
const nightFogColor = new THREE.Color(0x050814);
const hemi = new THREE.HemisphereLight(0xfff7df, 0x9fbad2, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1be, 3.2);
sun.position.set(-40, 62, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
scene.add(sun);
const moon = new THREE.PointLight(0x9dd3ff, 28, 120);
moon.position.set(34, 22, -52);
scene.add(moon);

function material(color, roughness = 0.78, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
const grassMat = material(0xbdd992);
const pathMat = material(0xf5d5a6);
const darkMat = material(0x231721);
const roofMat = material(0xf07469);
const trimMat = material(0x8bc7b6);
const eyeWhiteMat = material(0xfff8e8, 0.42);
const pupilMat = material(0x161016, 0.3);
const irisMats = [0x78e0d4, 0xf7bd66, 0xb69bff, 0xff83ad, 0x7bd174].map((color) => material(color, 0.5));
const pressedEyeMat = material(0x303039, 0.8);
const gateMat = material(0x34263a, 0.66);
const unlockedGateMat = material(0x84ffc0, 0.4);
const armMat = material(0x33222f, 0.72);
const handMat = material(0x4a313c, 0.82);
const monsterMat = new THREE.MeshStandardMaterial({ color: 0x07070b, roughness: 0.94 });
const monsterEyeMat = new THREE.MeshStandardMaterial({ color: 0xfff1bf, emissive: 0xffb14a, emissiveIntensity: 2.6, roughness: 0.4 });

function terrainHeight(x, z) { return Math.sin(x * 0.09) * 3.2 + Math.cos(z * 0.075) * 2.6 + Math.sin((x + z) * 0.04) * 2.4 - Math.exp(-((x + 7) ** 2 + (z - 10) ** 2) / 360) * 4; }

function makeTerrain() {
  const geometry = new THREE.PlaneGeometry(180, 180, 128, 128);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i); const z = position.getZ(i);
    position.setY(i, terrainHeight(x, z));
  }
  geometry.computeVertexNormals();
  const terrain = new THREE.Mesh(geometry, grassMat);
  terrain.receiveShadow = true;
  world.add(terrain);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(18, 112, 4, 48), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(1.5, terrainHeight(1.5, -7) + 0.06, -7);
  world.add(path);
}

function addHouse(x, z, scale, bodyColor = 0xfff2d0) {
  const y = terrainHeight(x, z);
  const house = new THREE.Group();
  house.position.set(x, y + 1.4 * scale, z);
  house.rotation.y = Math.sin(x * 0.2 + z * 0.08) * 0.28;
  const body = new THREE.Mesh(new THREE.BoxGeometry(6 * scale, 4 * scale, 5 * scale), material(bodyColor));
  body.castShadow = true; body.receiveShadow = true; house.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8 * scale, 2.8 * scale, 4), roofMat);
  roof.rotation.y = Math.PI * 0.25; roof.position.y = 3.2 * scale; roof.castShadow = true; house.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.3 * scale, 2.2 * scale, 0.08), darkMat);
  door.position.set(-1.1 * scale, -0.9 * scale, 2.54 * scale); house.add(door);
  for (const side of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1 * scale, 0.9 * scale, 0.08), trimMat); w.position.set(side * 1.55 * scale, 0.35 * scale, 2.55 * scale); house.add(w); }
  world.add(house);
}

function addCloud(x, y, z, s) {
  const cloud = new THREE.Group(); cloud.position.set(x, y, z);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.8, transparent: true, opacity: 0.82 });
  for (let i = 0; i < 6; i += 1) { const puff = new THREE.Mesh(new THREE.SphereGeometry(s * (0.8 + Math.sin(i) * 0.18), 18, 12), cloudMat); puff.position.set((i - 2.5) * s * 0.75, Math.sin(i * 1.7) * s * 0.18, Math.cos(i) * s * 0.18); cloud.add(puff); }
  world.add(cloud); return cloud;
}

function addEyeSwitch(x, z, index) {
  const y = terrainHeight(x, z) + 2.7;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData = { baseY: y, index, pressed: false, radius: 4.6 };
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 10), darkMat);
  stalk.position.y = -1.4; stalk.castShadow = true; group.add(stalk);
  const white = new THREE.Mesh(new THREE.SphereGeometry(1.28, 32, 18), eyeWhiteMat);
  white.scale.set(1.55, 0.72, 0.32); white.castShadow = true; group.add(white);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 12), irisMats[index]);
  iris.position.z = 0.36; iris.scale.set(1, 1, 0.25); group.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8), pupilMat);
  pupil.position.z = 0.48; pupil.scale.z = 0.22; group.add(pupil);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.045, 8, 46), material(0xffcc8d, 0.35));
  ring.rotation.z = Math.PI * 0.5; ring.scale.x = 0.48; ring.position.z = 0.49; group.add(ring);
  Object.assign(group.userData, { white, iris, pupil, ring });
  world.add(group); eyes.push(group);
}

function addGate() {
  const gate = new THREE.Group(); gate.position.set(0, terrainHeight(0, -49), -54);
  for (const x of [-4.4, 4.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.2, 0.8), gateMat); post.position.set(x, 4.1, 0); post.castShadow = true; gate.add(post); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(10, 0.65, 0.8), gateMat); lintel.position.set(0, 7.9, 0); lintel.castShadow = true; gate.add(lintel);
  const leftDoor = new THREE.Group(); const rightDoor = new THREE.Group();
  for (const [door, side] of [[leftDoor, -1], [rightDoor, 1]]) {
    door.position.set(side * 4.05, 3.4, 0.18);
    for (let i = 0; i < 4; i += 1) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 6.8, 0.34), gateMat); bar.position.x = side * -(0.55 + i * 0.82); bar.castShadow = true; door.add(bar); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.28, 0.38), gateMat); rail.position.y = 1.5; door.add(rail); const railLow = rail.clone(); railLow.position.y = -1.7; door.add(railLow); gate.add(door);
  }
  const eyeLock = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 14), eyeWhiteMat); eyeLock.scale.set(1.45, 0.72, 0.26); eyeLock.position.set(0, 4.25, 0.62); gate.add(eyeLock);
  gate.userData = { leftDoor, rightDoor, eyeLock }; world.add(gate); return gate;
}

function addMonster() {
  const monster = new THREE.Group();
  monster.visible = false;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 5.6, 10, 20), monsterMat);
  body.position.y = 4;
  body.scale.set(0.85, 1.12, 0.7);
  body.castShadow = true;
  monster.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1.22, 24, 14), monsterMat);
  head.position.y = 7.25;
  head.scale.set(0.9, 1.05, 0.78);
  head.castShadow = true;
  monster.add(head);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 12), monsterEyeMat);
  eye.position.set(0, 7.38, -0.85);
  eye.scale.set(1.45, 0.72, 0.34);
  monster.add(eye);

  const glow = new THREE.PointLight(0xffa04f, 26, 26);
  glow.position.set(0, 7.45, -1.35);
  monster.add(glow);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 5.2, 7, 14), monsterMat);
    arm.position.set(side * 1.55, 3.2, 0.05);
    arm.rotation.z = side * -0.26;
    arm.rotation.x = 0.18;
    arm.castShadow = true;
    monster.add(arm);
  }

  monster.userData = { body, head, eye, glow };
  world.add(monster);
  return monster;
}

function makeArm(side) {
  const arm = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 2.1, 7, 16), armMat); upper.rotation.x = Math.PI * 0.52; upper.position.set(side * 1.05, -0.55, -1.08); upper.castShadow = true; arm.add(upper);
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.75, 7, 16), armMat); forearm.rotation.x = Math.PI * 0.57; forearm.position.set(side * 1.12, -1.3, -2.1); forearm.castShadow = true; arm.add(forearm);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.55, 22, 14), handMat); hand.scale.set(1.15, 0.72, 0.86); hand.position.set(side * 1.16, -1.65, -2.98); hand.castShadow = true; arm.add(hand);
  camera.add(arm); return arm;
}

const leftArm = makeArm(-1);
const rightArm = makeArm(1);
scene.add(camera);
makeTerrain();
[[-23,-25,1.2,0xffefd6],[20,-31,1.0,0xe4fbff],[-35,2,.82,0xfff4c8],[29,9,1.15,0xf4e9ff],[-15,36,.9,0xeef7d0],[38,35,.78,0xffdfd7],[5,-4,1.35,0xfff2de]].forEach(([x,z,s,c]) => addHouse(x,z,s,c));
const clouds = [addCloud(-32,35,-36,3.8), addCloud(25,29,-18,3.1), addCloud(-8,42,30,4.6), addCloud(48,36,18,3.5)];
[[-27,-17],[27,-23],[-34,14],[28,28],[-3,42]].forEach(([x,z], index) => addEyeSwitch(x,z,index));
const gate = addGate();
const monster = addMonster();

function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
function onNightChanged(isNight) { state.isNight = isNight; updateHud(); }
function startGame() { ending.hidden = true; startButton.hidden = true; if (state.startedAt === null) state.startedAt = clock.elapsedTime; canvas.requestPointerLock?.(); }
function updateHud() { eyeCount.textContent = state.pressedEyes + "/5"; gateState.textContent = state.gateOpen ? "Gate open" : "Gate sealed"; gateState.classList.toggle("open", state.gateOpen); timeState.textContent = state.isNight ? "Night" : "Day"; timeState.classList.toggle("night", state.isNight); }
function resetGame() { state.pressedEyes = 0; state.gateOpen = false; state.gatePassed = false; state.startedAt = clock.elapsedTime; onNightChanged(false); camera.position.set(0, 5.9, 30); state.yaw = 0; state.pitch = 0; for (const eye of eyes) { eye.userData.pressed = false; eye.userData.white.material = eyeWhiteMat; eye.userData.iris.visible = true; eye.userData.pupil.visible = true; eye.userData.ring.visible = true; eye.scale.set(1,1,1); } gate.userData.leftDoor.rotation.y = 0; gate.userData.rightDoor.rotation.y = 0; gate.userData.eyeLock.material = eyeWhiteMat; updateHud(); startGame(); }
function pressNearbyEye(side) { let best = null; let bestDistance = Infinity; for (const eye of eyes) { if (eye.userData.pressed) continue; const distance = camera.position.distanceTo(eye.position); if (distance < eye.userData.radius && distance < bestDistance) { best = eye; bestDistance = distance; } } if (!best) return; best.userData.pressed = true; best.userData.white.material = pressedEyeMat; best.userData.iris.visible = false; best.userData.pupil.visible = false; best.userData.ring.visible = false; best.scale.set(1.08, 0.62, 1.08); best.rotation.z += side === "left" ? -0.12 : 0.12; state.pressedEyes += 1; if (state.pressedEyes === eyes.length) { state.gateOpen = true; gate.userData.eyeLock.material = unlockedGateMat; } updateHud(); }
function punch(side) { if (side === "left" && state.leftCooldown <= 0) { state.leftPunch = 1; state.leftCooldown = .35; pressNearbyEye("left"); } if (side === "right" && state.rightCooldown <= 0) { state.rightPunch = 1; state.rightCooldown = .35; pressNearbyEye("right"); } }
function handleMouseMove(event) { if (document.pointerLockElement !== canvas) return; state.yaw -= event.movementX * .0022; state.pitch -= event.movementY * .002; state.pitch = THREE.MathUtils.clamp(state.pitch, -1.12, 1.08); }
function movePlayer(delta) { const speed = state.keys.has("ShiftLeft") || state.keys.has("ShiftRight") ? 17 : 10.5; const forward = new THREE.Vector3(Math.sin(state.yaw), 0, Math.cos(state.yaw) * -1); const right = new THREE.Vector3(Math.cos(state.yaw), 0, Math.sin(state.yaw)); const move = new THREE.Vector3(); if (state.keys.has("KeyW") || state.keys.has("ArrowUp")) move.add(forward); if (state.keys.has("KeyS") || state.keys.has("ArrowDown")) move.sub(forward); if (state.keys.has("KeyD") || state.keys.has("ArrowRight")) move.add(right); if (state.keys.has("KeyA") || state.keys.has("ArrowLeft")) move.sub(right); if (move.lengthSq() > 0) { move.normalize().multiplyScalar(speed * delta); camera.position.add(move); camera.position.x = THREE.MathUtils.clamp(camera.position.x, -78, 78); camera.position.z = THREE.MathUtils.clamp(camera.position.z, -74, 78); } const ground = terrainHeight(camera.position.x, camera.position.z); const bob = Math.sin(clock.elapsedTime * 8) * (move.lengthSq() > 0 ? .08 : .02); camera.position.y = THREE.MathUtils.lerp(camera.position.y, ground + 5.5 + bob, .16); camera.rotation.order = "YXZ"; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch; }
function updateArms(delta) { state.leftCooldown = Math.max(0, state.leftCooldown - delta); state.rightCooldown = Math.max(0, state.rightCooldown - delta); state.leftPunch = Math.max(0, state.leftPunch - delta * 3.8); state.rightPunch = Math.max(0, state.rightPunch - delta * 3.8); const l = Math.sin(state.leftPunch * Math.PI); const r = Math.sin(state.rightPunch * Math.PI); leftArm.position.set(-.08, -.06 - l * .08, -l * 1.4); leftArm.rotation.set(l * -.7, .14 + l * -.28, -.2 - l * .18); rightArm.position.set(.08, -.06 - r * .08, -r * 1.4); rightArm.rotation.set(r * -.7, -.14 + r * .28, .2 + r * .18); }
function getCycle(elapsed) { const played = state.startedAt === null ? 0 : elapsed - state.startedAt; const phase = ((played % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS; const isNight = phase >= DAY_SECONDS; let nightBlend = 0; if (isNight) nightBlend = phase < DAY_SECONDS + TRANSITION_SECONDS ? (phase - DAY_SECONDS) / TRANSITION_SECONDS : 1; else if (played >= CYCLE_SECONDS && phase < TRANSITION_SECONDS) nightBlend = 1 - phase / TRANSITION_SECONDS; return { phase, isNight, nightBlend: THREE.MathUtils.clamp(nightBlend, 0, 1) }; }
function updateMonster(elapsed, cycle) {
  monster.visible = cycle.isNight;
  if (!cycle.isNight) return;
  const nightAge = cycle.phase - DAY_SECONDS;
  const spawn = THREE.MathUtils.clamp(nightAge / 2.5, 0, 1);
  const x = Math.sin(elapsed * 0.18) * 5 + 7;
  const z = -28 + Math.cos(elapsed * 0.14) * 4;
  monster.position.set(x, terrainHeight(x, z), z);
  monster.scale.setScalar(THREE.MathUtils.lerp(0.12, 1, spawn));
  monster.lookAt(camera.position.x, monster.position.y + 4.2, camera.position.z);
  monster.userData.head.position.y = 7.25 + Math.sin(elapsed * 2.1) * 0.16;
  monster.userData.eye.scale.y = 0.72 * (Math.sin(elapsed * 4.6) > 0.86 ? 0.14 : 1);
  monster.userData.glow.intensity = 16 + Math.sin(elapsed * 3.4) * 10;
}
function updateDreamObjects(elapsed) {
  const cycle = getCycle(elapsed);
  if (cycle.isNight !== state.isNight) onNightChanged(cycle.isNight);

  const daySky = pastelSky.clone().lerp(lateSky, (Math.sin(elapsed * .06) + 1) * .5);
  scene.background = daySky.lerp(nightSky, cycle.nightBlend);
  scene.fog.color = dayFogColor.clone().lerp(nightFogColor, cycle.nightBlend);
  scene.fog.density = THREE.MathUtils.lerp(0.018, 0.034, cycle.nightBlend);
  sun.intensity = THREE.MathUtils.lerp(3.2, 0.12, cycle.nightBlend);
  moon.intensity = THREE.MathUtils.lerp(18, 54, cycle.nightBlend);
  hemi.intensity = THREE.MathUtils.lerp(1.35, 0.42, cycle.nightBlend);

  clouds.forEach((cloud, i) => { cloud.position.x += Math.sin(elapsed * .12 + i) * .003; cloud.rotation.y = Math.sin(elapsed * .08 + i) * .08; });
  for (const eye of eyes) { eye.lookAt(camera.position.x, eye.position.y, camera.position.z); eye.position.y = eye.userData.baseY + Math.sin(elapsed * 1.6 + eye.userData.index) * .16; if (!eye.userData.pressed) { const blink = Math.sin(elapsed * 2.2 + eye.userData.index * 1.8) > .94 ? .16 : 1; eye.userData.white.scale.y = .72 * blink; eye.userData.iris.scale.y = blink; eye.userData.pupil.scale.y = blink; } }
  updateMonster(elapsed, cycle);
  if (state.gateOpen) { gate.userData.leftDoor.rotation.y = THREE.MathUtils.lerp(gate.userData.leftDoor.rotation.y, -1.22, .035); gate.userData.rightDoor.rotation.y = THREE.MathUtils.lerp(gate.userData.rightDoor.rotation.y, 1.22, .035); gate.userData.eyeLock.rotation.z += .025; }
}
function checkGate() { if (!state.gateOpen || state.gatePassed) return; if (camera.position.z < -58 && Math.abs(camera.position.x) < 6) { state.gatePassed = true; ending.hidden = false; document.exitPointerLock?.(); } }
function animate() { const delta = Math.min(clock.getDelta(), .05); const elapsed = clock.elapsedTime; movePlayer(delta); updateArms(delta); updateDreamObjects(elapsed); checkGate(); renderer.render(scene, camera); requestAnimationFrame(animate); }
window.addEventListener("resize", onResize);
window.addEventListener("mousemove", handleMouseMove);
window.addEventListener("keydown", (event) => state.keys.add(event.code));
window.addEventListener("keyup", (event) => state.keys.delete(event.code));
window.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("mousedown", (event) => { if (document.pointerLockElement !== canvas) { startGame(); return; } if (event.button === 0) punch("left"); if (event.button === 2) punch("right"); });
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", resetGame);
updateHud(); animate();
