import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js';
import {
  colorLettersWithColors,
  hideSchoolPicker,
  prefersReducedMotion,
  setAudioToggleState,
  setCongratsMessage,
  setStatusMessage,
  showSchoolPicker,
  syncCongratsOverlayLayout,
} from './shared-ui.js';
import {
  CAKE_SCHOOLS,
  DEFAULT_SCHOOL_KEY,
  SELECTABLE_SCHOOLS,
  SITE_CONFIG,
} from './site-config.js';

const reducedMotion = prefersReducedMotion;
const phase1ConfettiCount = reducedMotion ? 160 : 400;
const phase2ConfettiCount = reducedMotion ? 160 : 400;
const explosionParticleCount = reducedMotion ? 120 : 300;
const balloonCount = reducedMotion ? 20 : 50;
const maxShakeAmplitude = reducedMotion ? 0 : 0.4;

// ── Scene setup ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f0eb);
scene.fog = new THREE.FogExp2(0xf5f0eb, 0.008);

// ── Viewport-aware camera setup ──
// We keep the same hero angle, but compute the camera distance from the
// actual platter/cake bounds so short or oddly shaped viewports still fit.
function getViewportAspect() {
  return window.innerWidth / Math.max(window.innerHeight, 1);
}

function getViewportFov(aspect = getViewportAspect()) {
  if (aspect >= 1.4) return 36;
  if (aspect >= 1) return 38;
  if (aspect >= 0.6) return 44;
  return 50;
}

const DEFAULT_PHASE1_TARGET = new THREE.Vector3(0, 2.0, 0);
const DEFAULT_PHASE1_VIEW_DIRECTION = new THREE.Vector3(0, 0.78, 1).normalize();
const PHASE1_CAMERA_FIT_PADDING = 0.98;
const PHASE1_MIN_CAMERA_DISTANCE = 9.2;
const phase1ViewportBounds = new THREE.Box3();
const phase1ViewportBoundsCenter = new THREE.Vector3();
const phase1ViewportFitRight = new THREE.Vector3();
const phase1ViewportFitUp = new THREE.Vector3();
const phase1ViewportFitTarget = new THREE.Vector3();
const phase1ViewportFitPosition = new THREE.Vector3();
const phase1ViewportFitCorner = new THREE.Vector3();
let phase1ViewportFitObjects = null;
let lastViewportCameraFit = null;

const initialAspect = getViewportAspect();
const initialFov = getViewportFov(initialAspect);
const camera = new THREE.PerspectiveCamera(initialFov, initialAspect, 0.1, 100);
camera.position.copy(DEFAULT_PHASE1_TARGET).addScaledVector(DEFAULT_PHASE1_VIEW_DIRECTION, 10);

function createRenderer() {
  const rendererOptions = [
    { antialias: true, alpha: false, powerPreference: 'high-performance' },
    { antialias: false, alpha: false, powerPreference: 'default' },
  ];
  let lastError = null;

  for (const options of rendererOptions) {
    try {
      return new THREE.WebGLRenderer(options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to create a WebGL renderer.');
}

const renderer = createRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const experienceHost = document.getElementById('experience-host') || document.body;
experienceHost.appendChild(renderer.domElement);

function createStudioEnvironmentMap() {
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  const ctx = envCanvas.getContext('2d');

  if (!ctx) return null;

  const { width, height } = envCanvas;

  const verticalGradient = ctx.createLinearGradient(0, 0, 0, height);
  verticalGradient.addColorStop(0, '#fffdf8');
  verticalGradient.addColorStop(0.18, '#f7efe3');
  verticalGradient.addColorStop(0.45, '#e7e1de');
  verticalGradient.addColorStop(0.75, '#d4d0cf');
  verticalGradient.addColorStop(1, '#bdbabc');
  ctx.fillStyle = verticalGradient;
  ctx.fillRect(0, 0, width, height);

  const bandGradient = ctx.createLinearGradient(0, 0, width, 0);
  bandGradient.addColorStop(0, 'rgba(255,255,255,0)');
  bandGradient.addColorStop(0.18, 'rgba(255,255,255,0.88)');
  bandGradient.addColorStop(0.3, 'rgba(255,248,238,0.25)');
  bandGradient.addColorStop(0.5, 'rgba(255,255,255,0)');
  bandGradient.addColorStop(0.7, 'rgba(255,250,244,0.22)');
  bandGradient.addColorStop(0.82, 'rgba(255,255,255,0.72)');
  bandGradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = bandGradient;
  ctx.fillRect(0, 0, width, height);

  const topGlow = ctx.createRadialGradient(width * 0.5, height * 0.08, 0, width * 0.5, height * 0.08, width * 0.42);
  topGlow.addColorStop(0, 'rgba(255,255,255,0.85)');
  topGlow.addColorStop(0.45, 'rgba(255,248,238,0.2)');
  topGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height * 0.5);

  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRenderTarget = pmremGenerator.fromEquirectangular(envTexture);
  const environmentMap = envRenderTarget.texture;

  envTexture.dispose();
  pmremGenerator.dispose();

  return environmentMap;
}

const studioEnvironmentMap = createStudioEnvironmentMap();
if (studioEnvironmentMap) {
  scene.environment = studioEnvironmentMap;
}

// ── Controls ──
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !reducedMotion;
controls.dampingFactor = reducedMotion ? 0 : 0.05;
controls.minDistance = 4;
controls.maxDistance = 32;
controls.target.copy(DEFAULT_PHASE1_TARGET);

const isiOsTouchDevice = /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
const pinchZoomFallbackState = {
  active: false,
  distance: 0,
  cameraDistance: 0,
  panWasEnabled: controls.enablePan,
};

function getTouchDistance(touches) {
  if (touches.length < 2) return 0;
  const [firstTouch, secondTouch] = touches;
  return Math.hypot(
    firstTouch.clientX - secondTouch.clientX,
    firstTouch.clientY - secondTouch.clientY
  );
}

function applyPinchZoomDistance(nextDistance) {
  const offset = camera.position.clone().sub(controls.target);
  const clampedDistance = THREE.MathUtils.clamp(nextDistance, controls.minDistance, controls.maxDistance);

  if (offset.lengthSq() === 0) {
    offset.copy(DEFAULT_PHASE1_VIEW_DIRECTION);
  }

  offset.setLength(clampedDistance);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

if (isiOsTouchDevice) {
  // Mobile Safari can miss OrbitControls' pointer-based pinch zoom on canvas.
  controls.touches.TWO = THREE.TOUCH.PAN;

  const resetPinchZoomFallback = () => {
    pinchZoomFallbackState.active = false;
    pinchZoomFallbackState.distance = 0;
    pinchZoomFallbackState.cameraDistance = 0;
    controls.enablePan = pinchZoomFallbackState.panWasEnabled;
  };

  renderer.domElement.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 2) return;

    pinchZoomFallbackState.active = true;
    pinchZoomFallbackState.distance = getTouchDistance(event.touches);
    pinchZoomFallbackState.cameraDistance = camera.position.distanceTo(controls.target);
    pinchZoomFallbackState.panWasEnabled = controls.enablePan;
    controls.enablePan = false;
  }, { passive: true });

  renderer.domElement.addEventListener('touchmove', (event) => {
    if (!pinchZoomFallbackState.active || event.touches.length !== 2) return;

    const currentDistance = getTouchDistance(event.touches);
    if (currentDistance <= 0 || pinchZoomFallbackState.distance <= 0) return;

    event.preventDefault();
    applyPinchZoomDistance(
      pinchZoomFallbackState.cameraDistance * (pinchZoomFallbackState.distance / currentDistance)
    );
  }, { passive: false });

  renderer.domElement.addEventListener('touchend', () => {
    if (pinchZoomFallbackState.active) {
      resetPinchZoomFallback();
    }
  }, { passive: true });

  renderer.domElement.addEventListener('touchcancel', resetPinchZoomFallback, { passive: true });
}

function cloneViewportCameraFit(fit) {
  return {
    fov: fit.fov,
    position: fit.position.clone(),
    target: fit.target.clone(),
  };
}

function refreshPhase1ViewportBounds() {
  if (!phase1ViewportFitObjects?.length) return false;

  scene.updateMatrixWorld(true);
  phase1ViewportBounds.makeEmpty();
  phase1ViewportFitObjects.forEach((object) => phase1ViewportBounds.expandByObject(object));

  if (phase1ViewportBounds.isEmpty()) return false;

  phase1ViewportBounds.getCenter(phase1ViewportBoundsCenter);
  return true;
}

function buildViewportCameraFit() {
  const aspect = getViewportAspect();
  const fov = getViewportFov(aspect);

  if (!refreshPhase1ViewportBounds()) {
    return {
      fov,
      position: DEFAULT_PHASE1_TARGET.clone().addScaledVector(DEFAULT_PHASE1_VIEW_DIRECTION, 10),
      target: DEFAULT_PHASE1_TARGET.clone(),
    };
  }

  const tanHalfVerticalFov = Math.tan(THREE.MathUtils.degToRad(fov) * 0.5);
  const tanHalfHorizontalFov = Math.max(tanHalfVerticalFov * aspect, 0.01);

  phase1ViewportFitRight.crossVectors(new THREE.Vector3(0, 1, 0), DEFAULT_PHASE1_VIEW_DIRECTION).normalize();
  phase1ViewportFitUp.crossVectors(DEFAULT_PHASE1_VIEW_DIRECTION, phase1ViewportFitRight).normalize();
  phase1ViewportFitTarget.set(0, phase1ViewportBoundsCenter.y, 0);

  let requiredDistance = 0;
  const { min, max } = phase1ViewportBounds;
  const xs = [min.x, max.x];
  const ys = [min.y, max.y];
  const zs = [min.z, max.z];

  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        phase1ViewportFitCorner.set(x, y, z).sub(phase1ViewportFitTarget);
        const horizontalOffset = Math.abs(phase1ViewportFitCorner.dot(phase1ViewportFitRight));
        const verticalOffset = Math.abs(phase1ViewportFitCorner.dot(phase1ViewportFitUp));
        const forwardOffset = phase1ViewportFitCorner.dot(DEFAULT_PHASE1_VIEW_DIRECTION);

        requiredDistance = Math.max(
          requiredDistance,
          forwardOffset + horizontalOffset / tanHalfHorizontalFov,
          forwardOffset + verticalOffset / tanHalfVerticalFov
        );
      }
    }
  }

  const distance = Math.max(requiredDistance * PHASE1_CAMERA_FIT_PADDING, PHASE1_MIN_CAMERA_DISTANCE);
  phase1ViewportFitPosition.copy(phase1ViewportFitTarget).addScaledVector(DEFAULT_PHASE1_VIEW_DIRECTION, distance);

  return {
    fov,
    position: phase1ViewportFitPosition.clone(),
    target: phase1ViewportFitTarget.clone(),
  };
}

function applyViewportCameraFit(fit) {
  camera.fov = fit.fov;
  camera.position.copy(fit.position);
  controls.target.copy(fit.target);
  controls.maxDistance = Math.max(32, fit.position.distanceTo(fit.target) * 1.35);
  camera.updateProjectionMatrix();
  controls.update();
}

function cameraIsNearViewportFit(fit) {
  if (!fit) return false;
  return camera.position.distanceTo(fit.position) < 0.75 &&
    controls.target.distanceTo(fit.target) < 0.35;
}

// ── Lighting ──
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.0);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xe6f0ff, 0.3);
fillLight.position.set(-5, 5, -5);
scene.add(fillLight);

// ── Materials ──
const CAKE_FROSTING_COLOR = 0xfff2f7;
const CAKE_SIDE_COLOR = 0xffd9c7;
const CAKE_REVEAL_COLOR = 0xffeef6;
const CAKE_TOP_SURFACE_COLOR = 0xfff8fc;

const frostingMaterial = new THREE.MeshStandardMaterial({
  color: CAKE_FROSTING_COLOR,
  roughness: 0.26,
  metalness: 0.0,
});

const cakeSideMaterial = new THREE.MeshStandardMaterial({
  color: CAKE_SIDE_COLOR,
  roughness: 0.48,
  metalness: 0.0,
});

// ── Platform / Table ──
// ── Silver platter ──
const silverMat = new THREE.MeshStandardMaterial({
  color: 0xcfd6e0,
  roughness: 0.12,
  metalness: 0.84,
  envMapIntensity: 2.05,
});

// Main platter surface
const tableGeo = new THREE.CylinderGeometry(6, 6, 0.15, 64);
const table = new THREE.Mesh(tableGeo, silverMat);
table.position.y = -0.075;
table.receiveShadow = true;
scene.add(table);

// Raised ridge around the edge (outer rim)
const ridgeOuterGeo = new THREE.TorusGeometry(6.0, 0.1, 12, 64);
const ridgeOuter = new THREE.Mesh(ridgeOuterGeo, silverMat);
ridgeOuter.position.y = 0.0;
ridgeOuter.rotation.x = Math.PI / 2;
scene.add(ridgeOuter);

// Inner decorative ridge
const ridgeInnerGeo = new THREE.TorusGeometry(5.7, 0.05, 10, 64);
const ridgeInnerMat = new THREE.MeshStandardMaterial({
  color: 0xe7edf5,
  roughness: 0.05,
  metalness: 0.9,
  envMapIntensity: 2.3,
});
const ridgeInner = new THREE.Mesh(ridgeInnerGeo, ridgeInnerMat);
ridgeInner.position.y = 0.02;
ridgeInner.rotation.x = Math.PI / 2;
scene.add(ridgeInner);

// Cake plate (sits on top of platter)
const plateGeo = new THREE.CylinderGeometry(3.8, 4, 0.15, 64);
const plateMat = new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.2, metalness: 0.08 });
const plate = new THREE.Mesh(plateGeo, plateMat);
plate.position.y = 0.08;
scene.add(plate);

// ── Tray decorations: Graduation caps + Diploma scrolls ──
const trayDecoGroup = new THREE.Group();
scene.add(trayDecoGroup);

// Materials for grad caps
const capBlackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
const capBoardMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
const tasselGoldMat = new THREE.MeshStandardMaterial({ color: 0xd4a843, roughness: 0.3, metalness: 0.6 });

// Build a graduation cap (scaled up ~2x)
function createGradCap() {
  const capGroup = new THREE.Group();

  // Cap body (short cylinder)
  const bodyGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.2, 16);
  const body = new THREE.Mesh(bodyGeo, capBlackMat);
  body.position.y = 0.1;
  capGroup.add(body);

  // Mortarboard (flat square on top)
  const boardGeo = new THREE.BoxGeometry(0.75, 0.04, 0.75);
  const board = new THREE.Mesh(boardGeo, capBoardMat);
  board.position.y = 0.22;
  capGroup.add(board);

  // Button on top center
  const buttonGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const button = new THREE.Mesh(buttonGeo, tasselGoldMat);
  button.position.y = 0.26;
  capGroup.add(button);

  // Tassel string (thin cylinder hanging from button)
  const tasselStringGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6);
  const tasselString = new THREE.Mesh(tasselStringGeo, tasselGoldMat);
  tasselString.position.set(0.2, 0.16, 0.2);
  tasselString.rotation.z = 0.6;
  capGroup.add(tasselString);

  // Tassel end (small cylinder)
  const tasselEndGeo = new THREE.CylinderGeometry(0.035, 0.025, 0.1, 6);
  const tasselEnd = new THREE.Mesh(tasselEndGeo, tasselGoldMat);
  tasselEnd.position.set(0.32, 0.05, 0.32);
  capGroup.add(tasselEnd);

  return capGroup;
}

// Place 10 graduation caps around the tray
const capPositions = [
  { angle: 0.2, radius: 4.6, tilt: 0.15, spin: 0.5 },
  { angle: 0.9, radius: 5.3, tilt: -0.1, spin: 1.2 },
  { angle: 1.4, radius: 4.4, tilt: 0.2, spin: 1.8 },
  { angle: 2.1, radius: 5.1, tilt: -0.15, spin: 2.7 },
  { angle: 2.7, radius: 4.8, tilt: 0.1, spin: 3.3 },
  { angle: 3.4, radius: 5.4, tilt: -0.2, spin: 4.0 },
  { angle: 4.0, radius: 4.5, tilt: 0.18, spin: 4.8 },
  { angle: 4.7, radius: 5.2, tilt: -0.12, spin: 5.5 },
  { angle: 5.3, radius: 4.7, tilt: 0.1, spin: 0.3 },
  { angle: 5.9, radius: 5.0, tilt: -0.18, spin: 1.0 },
];

capPositions.forEach(({ angle, radius, tilt, spin }) => {
  const cap = createGradCap();
  cap.position.set(
    Math.cos(angle) * radius,
    0.02,
    Math.sin(angle) * radius
  );
  cap.rotation.x = tilt;
  cap.rotation.y = spin;
  cap.castShadow = true;
  trayDecoGroup.add(cap);
});

// Materials for diploma scrolls
const paperMat = new THREE.MeshStandardMaterial({ color: 0xfff8e7, roughness: 0.6 });
const ribbonRedMat = new THREE.MeshStandardMaterial({ color: 0xcc2233, roughness: 0.4, metalness: 0.2 });

// Build a diploma scroll (scaled up ~1.8x)
function createDiplomaScroll() {
  const scrollGroup = new THREE.Group();

  // Rolled paper (cylinder)
  const rollGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12);
  const roll = new THREE.Mesh(rollGeo, paperMat);
  roll.rotation.z = Math.PI / 2;
  roll.position.y = 0.1;
  scrollGroup.add(roll);

  // Ribbon band around middle
  const ribbonGeo = new THREE.TorusGeometry(0.11, 0.025, 8, 16);
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonRedMat);
  ribbon.position.y = 0.1;
  ribbon.rotation.y = Math.PI / 2;
  scrollGroup.add(ribbon);

  // Small ribbon bow (two elongated spheres)
  const bowGeo = new THREE.SphereGeometry(0.04, 6, 6);
  bowGeo.scale(1.5, 0.8, 1);
  const bow1 = new THREE.Mesh(bowGeo, ribbonRedMat);
  bow1.position.set(0, 0.21, 0.02);
  scrollGroup.add(bow1);
  const bow2 = new THREE.Mesh(bowGeo.clone(), ribbonRedMat);
  bow2.position.set(0, 0.21, -0.02);
  bow2.rotation.y = Math.PI / 3;
  scrollGroup.add(bow2);

  return scrollGroup;
}

// Place 8 diploma scrolls around the tray
const scrollPositions = [
  { angle: 0.5, radius: 5.0, spin: 0.3 },
  { angle: 1.1, radius: 4.5, spin: 1.1 },
  { angle: 1.8, radius: 5.3, spin: 1.9 },
  { angle: 2.4, radius: 4.7, spin: 2.6 },
  { angle: 3.3, radius: 5.1, spin: 3.5 },
  { angle: 4.1, radius: 4.6, spin: 4.3 },
  { angle: 4.9, radius: 5.2, spin: 5.1 },
  { angle: 5.6, radius: 4.8, spin: 5.8 },
];

scrollPositions.forEach(({ angle, radius, spin }) => {
  const scroll = createDiplomaScroll();
  scroll.position.set(
    Math.cos(angle) * radius,
    0.0,
    Math.sin(angle) * radius
  );
  scroll.rotation.y = spin;
  scroll.castShadow = true;
  trayDecoGroup.add(scroll);
});

// ── Champagne flutes on the platter ──
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  roughness: 0.05,
  metalness: 0.0,
  transmission: 0.85,
  thickness: 0.3,
  ior: 1.5,
});
const goldStemMat = new THREE.MeshStandardMaterial({
  color: 0xd4a843,
  roughness: 0.2,
  metalness: 0.7,
});

function createChampagneFlute() {
  const fluteGroup = new THREE.Group();

  // Base (flat disc)
  const baseGeo = new THREE.CylinderGeometry(0.15, 0.16, 0.03, 16);
  const base = new THREE.Mesh(baseGeo, goldStemMat);
  base.position.y = 0.015;
  fluteGroup.add(base);

  // Stem (thin cylinder)
  const stemGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8);
  const stem = new THREE.Mesh(stemGeo, goldStemMat);
  stem.position.y = 0.255;
  fluteGroup.add(stem);

  // Bowl (tapered cylinder, wider at top)
  const bowlGeo = new THREE.CylinderGeometry(0.12, 0.06, 0.35, 16, 1, true);
  const bowl = new THREE.Mesh(bowlGeo, glassMat);
  bowl.position.y = 0.655;
  fluteGroup.add(bowl);

  // Champagne liquid inside (slightly smaller, golden)
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0xf5d678,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.7,
  });
  const liquidGeo = new THREE.CylinderGeometry(0.1, 0.05, 0.25, 16);
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  liquid.position.y = 0.61;
  fluteGroup.add(liquid);

  return fluteGroup;
}

// Place 6 champagne flutes evenly around the platter
for (let i = 0; i < 6; i++) {
  const angle = (i / 6) * Math.PI * 2 + 0.15; // offset slightly from caps
  const radius = 5.5;
  const flute = createChampagneFlute();
  flute.position.set(
    Math.cos(angle) * radius,
    0.0,
    Math.sin(angle) * radius
  );
  flute.rotation.y = angle + Math.PI; // face inward toward cake
  flute.castShadow = true;
  trayDecoGroup.add(flute);
}

// ── Ivy / greenery garlands on the platter ──
const ivyLeafMat = new THREE.MeshStandardMaterial({
  color: 0x2d5a27,
  roughness: 0.6,
  metalness: 0.0,
  side: THREE.DoubleSide,
});
const ivyDarkMat = new THREE.MeshStandardMaterial({
  color: 0x1e4220,
  roughness: 0.7,
  metalness: 0.0,
  side: THREE.DoubleSide,
});
const vineMat = new THREE.MeshStandardMaterial({
  color: 0x3a6b35,
  roughness: 0.8,
});

// Create ivy vine segments around the cake base
for (let i = 0; i < 24; i++) {
  const angle = (i / 24) * Math.PI * 2;
  const radius = 4.2 + Math.sin(i * 2.7) * 0.3; // wavy path

  // Vine segment (thin cylinder along the surface)
  const vineGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6);
  const vine = new THREE.Mesh(vineGeo, vineMat);
  vine.position.set(
    Math.cos(angle) * radius,
    0.04,
    Math.sin(angle) * radius
  );
  vine.rotation.y = -angle;
  vine.rotation.z = Math.PI / 2;
  trayDecoGroup.add(vine);

  // Ivy leaves (small diamond-shaped planes) branching off the vine
  const numLeaves = 2 + Math.floor(Math.random() * 2);
  for (let j = 0; j < numLeaves; j++) {
    const leafAngle = angle + (Math.random() - 0.5) * 0.3;
    const leafRadius = radius + (Math.random() - 0.5) * 0.4;
    const leafSize = 0.12 + Math.random() * 0.08;
    const leafGeo = new THREE.CircleGeometry(leafSize, 5);
    const mat = Math.random() > 0.4 ? ivyLeafMat : ivyDarkMat;
    const leaf = new THREE.Mesh(leafGeo, mat);
    leaf.position.set(
      Math.cos(leafAngle) * leafRadius,
      0.05 + Math.random() * 0.03,
      Math.sin(leafAngle) * leafRadius
    );
    leaf.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    leaf.rotation.z = Math.random() * Math.PI;
    trayDecoGroup.add(leaf);
  }
}

// Add some trailing ivy tendrils spreading outward
for (let i = 0; i < 16; i++) {
  const angle = (i / 16) * Math.PI * 2 + 0.2;
  for (let j = 0; j < 4; j++) {
    const radius = 4.5 + j * 0.35;
    const leafSize = 0.1 + Math.random() * 0.06;
    const leafGeo = new THREE.CircleGeometry(leafSize, 5);
    const mat = Math.random() > 0.5 ? ivyLeafMat : ivyDarkMat;
    const leaf = new THREE.Mesh(leafGeo, mat);
    const jitter = (Math.random() - 0.5) * 0.2;
    leaf.position.set(
      Math.cos(angle + jitter) * radius,
      0.04,
      Math.sin(angle + jitter) * radius
    );
    leaf.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    leaf.rotation.z = Math.random() * Math.PI;
    trayDecoGroup.add(leaf);
  }
}

// ── Cake layers ──
const cakeGroup = new THREE.Group();
scene.add(cakeGroup);

// Bottom layer
const bottomCakeGeo = new THREE.CylinderGeometry(3.2, 3.4, 1.8, 64);
const bottomCake = new THREE.Mesh(bottomCakeGeo, cakeSideMaterial);
bottomCake.position.y = 1.05;
bottomCake.castShadow = true;
cakeGroup.add(bottomCake);

// Bottom frosting rim
const bottomRimGeo = new THREE.TorusGeometry(3.3, 0.12, 12, 64);
const bottomRim = new THREE.Mesh(bottomRimGeo, frostingMaterial);
bottomRim.position.y = 1.95;
bottomRim.rotation.x = Math.PI / 2;
cakeGroup.add(bottomRim);

// Hidden reveal layer (sits on top of bottom cake, below top cake)
const revealGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.05, 64);
const revealMat = new THREE.MeshStandardMaterial({ color: CAKE_REVEAL_COLOR, roughness: 0.35 });
const revealLayer = new THREE.Mesh(revealGeo, revealMat);
revealLayer.position.y = 1.98;
cakeGroup.add(revealLayer);

// Top layer (will burn away)
const topCakeGeo = new THREE.CylinderGeometry(2.6, 2.8, 1.4, 64);

// Custom burn shader material for top cake
const burnUniforms = {
  burnProgress: { value: 0.0 },
  baseColor: { value: new THREE.Color(CAKE_SIDE_COLOR) },
  time: { value: 0.0 },
};

const burnVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const burnFragmentShader = `
  uniform float burnProgress;
  uniform vec3 baseColor;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vPosition;

  // Simple noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    // Radial distance from center (xz plane)
    float dist = length(vPosition.xz) / 2.8;

    // For wall fragments (high radial distance), blend in vertical burn:
    // top of wall burns first, bottom burns last
    float wallness = smoothstep(0.75, 0.95, dist); // 0=inner surface, 1=wall
    float normalizedY = (vPosition.y + 0.7) / 1.4;  // 0=bottom, 1=top of cylinder
    // Wall effective distance: top=0.82, bottom=1.12 (burns top-down)
    float wallDist = 0.82 + (1.0 - normalizedY) * 0.3;
    float effectiveDist = mix(dist, wallDist, wallness);

    // Add noise for organic burn edge
    float n = noise(vPosition.xz * 3.0 + time * 0.5) * 0.15;
    float burnEdge = burnProgress * 1.2;
    float burnDist = effectiveDist + n;

    // Ember glow at the burn edge
    float edgeWidth = 0.08;
    float emberGlow = smoothstep(burnEdge - edgeWidth, burnEdge, burnDist) *
                      (1.0 - smoothstep(burnEdge, burnEdge + edgeWidth, burnDist));

    // Discard burnt area
    if (burnDist < burnEdge - edgeWidth && burnProgress > 0.01) {
      discard;
    }

    vec3 color = baseColor;

    // Add ember orange/red at edge — only when burn edge is actually nearby
    vec3 emberColor = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.0), noise(vPosition.xz * 8.0 + time));
    color = mix(color, emberColor, emberGlow * 2.0);

    // Darken near burn edge — only in a narrow band around the edge, not everywhere
    float charBand = smoothstep(burnEdge - edgeWidth * 3.0, burnEdge - edgeWidth, burnDist) *
                     (1.0 - smoothstep(burnEdge - edgeWidth, burnEdge + edgeWidth * 2.0, burnDist));
    color = mix(color, vec3(0.15, 0.08, 0.02), charBand * 0.6 * step(0.01, burnProgress));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const burnMaterial = new THREE.ShaderMaterial({
  uniforms: burnUniforms,
  vertexShader: burnVertexShader,
  fragmentShader: burnFragmentShader,
  side: THREE.DoubleSide,
});

const topCake = new THREE.Mesh(topCakeGeo, burnMaterial);
topCake.position.y = 2.65;
topCake.castShadow = true;
cakeGroup.add(topCake);

// Top frosting rim
const topRimGeo = new THREE.TorusGeometry(2.7, 0.1, 12, 64);
const topRim = new THREE.Mesh(topRimGeo, frostingMaterial.clone());
topRim.position.y = 3.35;
topRim.rotation.x = Math.PI / 2;
cakeGroup.add(topRim);

// Top surface disc — uses a burn shader so it burns in sync with the cake
const topSurfaceGeo = new THREE.CircleGeometry(2.6, 64);
const topSurfaceBurnShader = `
  uniform float burnProgress;
  uniform vec3 baseColor;
  uniform float time;
  varying vec2 vUv;
  varying vec3 vPosition;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    // CircleGeometry is in XY plane, rotated to XZ in world
    float dist = length(vPosition.xy) / 2.6;
    float n = noise(vPosition.xy * 3.0 + time * 0.5) * 0.15;
    float burnEdge = burnProgress * 1.2;
    float burnDist = dist + n;
    float edgeWidth = 0.08;

    if (burnDist < burnEdge - edgeWidth && burnProgress > 0.01) {
      discard;
    }

    vec3 color = baseColor;

    // Ember glow at edge
    vec3 emberColor = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.0), noise(vPosition.xy * 8.0 + time));
    float emberGlow = smoothstep(burnEdge - edgeWidth, burnEdge, burnDist) *
                      (1.0 - smoothstep(burnEdge, burnEdge + edgeWidth, burnDist));
    color = mix(color, emberColor, emberGlow * 2.0);

    // Char darkening near edge — only in a narrow band, not across entire surface
    float charBand = smoothstep(burnEdge - edgeWidth * 3.0, burnEdge - edgeWidth, burnDist) *
                     (1.0 - smoothstep(burnEdge - edgeWidth, burnEdge + edgeWidth * 2.0, burnDist));
    color = mix(color, vec3(0.15, 0.08, 0.02), charBand * 0.5 * step(0.01, burnProgress));

    gl_FragColor = vec4(color, 1.0);
  }
`;
const topSurfaceUniforms = {
  burnProgress: burnUniforms.burnProgress,
  baseColor: { value: new THREE.Color(CAKE_TOP_SURFACE_COLOR) },
  time: burnUniforms.time,
};
const topSurfaceMat = new THREE.ShaderMaterial({
  uniforms: topSurfaceUniforms,
  vertexShader: burnVertexShader,
  fragmentShader: topSurfaceBurnShader,
  side: THREE.DoubleSide,
});
const topSurface = new THREE.Mesh(topSurfaceGeo, topSurfaceMat);
topSurface.position.y = 3.36;
topSurface.rotation.x = -Math.PI / 2;
cakeGroup.add(topSurface);

// ── Logo Burn Shader (burns logos piece-by-piece matching the cake burn) ──
const logoBurnVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Top logo burn shader — logos lie flat on top, burn radially from center using world XZ
const topLogoBurnFragmentShader = `
  uniform float burnProgress;
  uniform float time;
  uniform sampler2D logoMap;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec4 texColor = texture2D(logoMap, vUv);
    if (texColor.a < 0.01) discard;

    float dist = length(vWorldPos.xz) / 2.8;
    float n = noise(vWorldPos.xz * 3.0 + time * 0.5) * 0.15;
    float burnEdge = burnProgress * 1.2;
    float burnDist = dist + n;
    float edgeWidth = 0.08;

    // Discard burnt area
    if (burnDist < burnEdge - edgeWidth && burnProgress > 0.01) {
      discard;
    }

    vec3 color = texColor.rgb;

    // Ember glow at burn edge
    float emberGlow = smoothstep(burnEdge - edgeWidth, burnEdge, burnDist) *
                      (1.0 - smoothstep(burnEdge, burnEdge + edgeWidth, burnDist));
    vec3 emberColor = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.0), noise(vWorldPos.xz * 8.0 + time));
    color = mix(color, emberColor, emberGlow * 2.0);

    // Char darkening in narrow band
    float charBand = smoothstep(burnEdge - edgeWidth * 3.0, burnEdge - edgeWidth, burnDist) *
                     (1.0 - smoothstep(burnEdge - edgeWidth, burnEdge + edgeWidth * 2.0, burnDist));
    color = mix(color, vec3(0.15, 0.08, 0.02), charBand * 0.5 * step(0.01, burnProgress));

    gl_FragColor = vec4(color, texColor.a);
  }
`;

// Wall logo burn shader — logos on cake side, burn based on distance from center axis
const wallLogoBurnFragmentShader = `
  uniform float burnProgress;
  uniform float time;
  uniform sampler2D logoMap;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec4 texColor = texture2D(logoMap, vUv);
    if (texColor.a < 0.01) discard;

    // Wall logos: burn top-down matching the cake wall burn
    // World Y: top of cake wall ~3.35, bottom ~1.95 → normalize to 0..1
    float normalizedY = clamp((vWorldPos.y - 1.95) / 1.4, 0.0, 1.0);
    // Top of wall burns first (0.82), bottom burns last (1.12)
    float effectiveDist = 0.82 + (1.0 - normalizedY) * 0.3;
    float n = noise(vWorldPos.xz * 3.0 + time * 0.5) * 0.15;
    float burnEdge = burnProgress * 1.2;
    float burnDist = effectiveDist + n;
    float edgeWidth = 0.08;

    // Discard burnt area
    if (burnDist < burnEdge - edgeWidth && burnProgress > 0.01) {
      discard;
    }

    vec3 color = texColor.rgb;

    // Ember glow at burn edge
    float emberGlow = smoothstep(burnEdge - edgeWidth, burnEdge, burnDist) *
                      (1.0 - smoothstep(burnEdge, burnEdge + edgeWidth, burnDist));
    vec3 emberColor = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.0), noise(vWorldPos.xz * 8.0 + time));
    color = mix(color, emberColor, emberGlow * 2.0);

    // Char darkening in narrow band
    float charBand = smoothstep(burnEdge - edgeWidth * 3.0, burnEdge - edgeWidth, burnDist) *
                     (1.0 - smoothstep(burnEdge - edgeWidth, burnEdge + edgeWidth * 2.0, burnDist));
    color = mix(color, vec3(0.15, 0.08, 0.02), charBand * 0.5 * step(0.01, burnProgress));

    gl_FragColor = vec4(color, texColor.a);
  }
`;

// ── University Logos ──
const textureLoader = new THREE.TextureLoader();
const texturePromiseCache = new Map();
const logoGroup = new THREE.Group();
cakeGroup.add(logoGroup);

const schools = CAKE_SCHOOLS;

function loadTextureCached(src) {
  if (!texturePromiseCache.has(src)) {
    texturePromiseCache.set(src, new Promise((resolve, reject) => {
      textureLoader.load(
        src,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        reject
      );
    }));
  }

  return texturePromiseCache.get(src);
}

const logoMeshes = [];

schools.forEach((school, i) => {
  const angle = (i / schools.length) * Math.PI * 2 - Math.PI / 2;
  const radius = 1.7;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  // Size logos proportionally with per-school scale
  const baseHeight = 0.55;
  const s = school.scale || 1.0;
  const topScale = school.topScale || s;
  const ar = Math.min(school.aspect, 2.0); // tighter cap for wide logos
  const topHeight = baseHeight * topScale;
  const topWidth = topHeight * ar;
  const logoGeo = new THREE.PlaneGeometry(topWidth, topHeight);

  // Create a canvas-based fallback texture
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Draw colored circle background
  ctx.fillStyle = school.fallbackColor;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();

  // Draw school name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = school.name.split(' ');
  if (words.length > 1) {
    ctx.font = 'bold 30px Georgia';
    ctx.fillText(words[0], 128, 110);
    ctx.fillText(words.slice(1).join(' '), 128, 150);
  } else {
    ctx.fillText(school.name, 128, 128);
  }

  const fallbackTexture = new THREE.CanvasTexture(canvas);

  // Top logo — uses burn shader for piece-by-piece burning
  const topLogoMat = new THREE.ShaderMaterial({
    uniforms: {
      burnProgress: burnUniforms.burnProgress,
      time: burnUniforms.time,
      logoMap: { value: fallbackTexture },
    },
    vertexShader: logoBurnVertexShader,
    fragmentShader: topLogoBurnFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  // Try to load actual logo image
  loadTextureCached(school.logo)
    .then((texture) => {
      topLogoMat.uniforms.logoMap.value = texture;
    })
    .catch(() => {});

  // Logo on top surface
  const logoMesh = new THREE.Mesh(logoGeo, topLogoMat);
  logoMesh.position.set(x, 3.38, z);
  logoMesh.rotation.x = -Math.PI / 2;
  logoGroup.add(logoMesh);
  logoMeshes.push(logoMesh);

  // Logo on the outside wall of the top cake layer
  const wallBaseHeight = 0.54;
  const wallAr = Math.min(school.aspect, 2.0);
  const wallHeight = wallBaseHeight * s;
  const wallWidth = wallHeight * wallAr;
  const wallLogoGeo = new THREE.PlaneGeometry(wallWidth, wallHeight);

  // Wall logo — uses burn shader for piece-by-piece burning
  const wallLogoMat = new THREE.ShaderMaterial({
    uniforms: {
      burnProgress: burnUniforms.burnProgress,
      time: burnUniforms.time,
      logoMap: { value: fallbackTexture },
    },
    vertexShader: logoBurnVertexShader,
    fragmentShader: wallLogoBurnFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const wallLogoMesh = new THREE.Mesh(wallLogoGeo, wallLogoMat);
  const wallRadius = 2.75; // slightly proud of the surface
  const wallX = Math.cos(angle) * wallRadius;
  const wallZ = Math.sin(angle) * wallRadius;
  wallLogoMesh.position.set(wallX, 2.65, wallZ); // centered vertically on the cake wall
  wallLogoMesh.rotation.y = -angle + Math.PI / 2; // face outward
  logoGroup.add(wallLogoMesh);
  logoMeshes.push(wallLogoMesh);

  // Load actual texture into wall logo
  loadTextureCached(school.logo)
    .then((texture) => {
      wallLogoMat.uniforms.logoMap.value = texture;
    })
    .catch(() => {});
});

// ── Reveal blur shader (progressive blur-to-focus during burn) ──
const revealBlurVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const revealBlurFragmentShader = `
  uniform sampler2D map;
  uniform float blurAmount;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    // 9-tap gaussian blur
    float b = blurAmount * 0.012; // pixel spread
    vec4 color = vec4(0.0);
    color += texture2D(map, vUv + vec2(-b, -b)) * 0.0625;
    color += texture2D(map, vUv + vec2( 0.0, -b)) * 0.125;
    color += texture2D(map, vUv + vec2( b, -b)) * 0.0625;
    color += texture2D(map, vUv + vec2(-b,  0.0)) * 0.125;
    color += texture2D(map, vUv)                   * 0.25;
    color += texture2D(map, vUv + vec2( b,  0.0)) * 0.125;
    color += texture2D(map, vUv + vec2(-b,  b)) * 0.0625;
    color += texture2D(map, vUv + vec2( 0.0,  b)) * 0.125;
    color += texture2D(map, vUv + vec2( b,  b)) * 0.0625;

    gl_FragColor = vec4(color.rgb, color.a * opacity);
  }
`;

// ── Reveal layer: logos + labels + circular text ──
const revealLogoMeshes = [];

// Create a single canvas for the entire reveal surface
const revealCanvas = document.createElement('canvas');
revealCanvas.width = 1024;
revealCanvas.height = 1024;
const rCtx = revealCanvas.getContext('2d');

// Draw circular text "It is now down to two"
function drawCircularText(ctx, text, cx, cy, radius, startAngle) {
  ctx.save();
  ctx.font = 'bold 42px Georgia';
  ctx.fillStyle = '#C0392B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = text.split('');
  // Measure total arc length needed
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const totalWidth = charWidths.reduce((a, b) => a + b, 0);
  const totalAngle = totalWidth / radius;

  let angle = startAngle - totalAngle / 2;
  for (let i = 0; i < chars.length; i++) {
    const charAngle = charWidths[i] / radius;
    angle += charAngle / 2;
    ctx.save();
    ctx.translate(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius
    );
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    angle += charAngle / 2;
  }
  ctx.restore();
}

const revealSchoolKeys = SITE_CONFIG.event.revealSelectableKeys;
const revealPositiveSchool = SELECTABLE_SCHOOLS[revealSchoolKeys[0]];
const revealNegativeSchool = SELECTABLE_SCHOOLS[revealSchoolKeys[1]];

// Draw circular text along top arc
drawCircularText(rCtx, SITE_CONFIG.event.revealTopText, 512, 512, 420, -Math.PI / 2);
// Draw it again along bottom arc for full circle feel
drawCircularText(rCtx, SITE_CONFIG.event.revealBottomText, 512, 512, 420, Math.PI / 2);

// Draw the selectable school labels underneath the reveal logos
rCtx.fillStyle = revealPositiveSchool.primaryCSS;
rCtx.font = 'bold 48px Georgia';
rCtx.textAlign = 'center';
rCtx.textBaseline = 'top';
rCtx.fillText(revealPositiveSchool.name, revealPositiveSchool.revealLabelX, 630);

rCtx.fillStyle = revealNegativeSchool.primaryCSS;
rCtx.font = 'bold 48px Georgia';
rCtx.fillText(revealNegativeSchool.name, revealNegativeSchool.revealLabelX, 630);

const revealSurfaceTexture = new THREE.CanvasTexture(revealCanvas);

// Reveal surface plane with text — blur shader for progressive reveal
const revealTextGeo = new THREE.PlaneGeometry(5.2, 5.2);
const revealTextMat = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: revealSurfaceTexture },
    blurAmount: { value: 1.0 },
    opacity: { value: 0.0 },
  },
  vertexShader: revealBlurVertexShader,
  fragmentShader: revealBlurFragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
});
const revealText = new THREE.Mesh(revealTextGeo, revealTextMat);
revealText.position.y = 2.06;
revealText.rotation.x = -Math.PI / 2;
cakeGroup.add(revealText);
revealLogoMeshes.push(revealText);

function createRevealLogoMesh(school) {
  const maxSize = 1.5 * (school.revealScale || 1.0);
  const aspect = school.aspect || 1.0;
  const width = aspect >= 1 ? maxSize : maxSize * aspect;
  const height = aspect >= 1 ? maxSize / aspect : maxSize;
  const revealGeo = new THREE.PlaneGeometry(width, height);
  const revealMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      blurAmount: { value: 1.0 },
      opacity: { value: 0.0 },
    },
    vertexShader: revealBlurVertexShader,
    fragmentShader: revealBlurFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });
  loadTextureCached(school.logo).then((tex) => {
    revealMat.uniforms.map.value = tex;
  }).catch(() => {});
  const revealMesh = new THREE.Mesh(revealGeo, revealMat);
  revealMesh.position.set(
    school.revealPlanePosition.x,
    school.revealPlanePosition.y,
    school.revealPlanePosition.z
  );
  revealMesh.rotation.x = -Math.PI / 2;
  cakeGroup.add(revealMesh);
  revealLogoMeshes.push(revealMesh);
  return revealMesh;
}

const positiveReveal = createRevealLogoMesh(revealPositiveSchool);
const negativeReveal = createRevealLogoMesh(revealNegativeSchool);

// ── Candle ──
const candleGroup = new THREE.Group();
candleGroup.position.y = 3.36;
cakeGroup.add(candleGroup);

// Candle body
const candleGeo = new THREE.CylinderGeometry(0.08, 0.1, 1.0, 16);
const candleMat = new THREE.MeshStandardMaterial({ color: 0xff6b9d, roughness: 0.6 });
const candle = new THREE.Mesh(candleGeo, candleMat);
candle.position.y = 0.5;
candle.castShadow = true;
candleGroup.add(candle);

// Invisible hitbox (larger cylinder for easier clicking)
const hitboxGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.4, 16);
const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
const candleHitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
candleHitbox.position.y = 0.6;
candleGroup.add(candleHitbox);

// Wick
const wickGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
const wickMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const wick = new THREE.Mesh(wickGeo, wickMat);
wick.position.y = 1.075;
candleGroup.add(wick);

// Flame (hidden initially)
const flameGroup = new THREE.Group();
flameGroup.visible = false;
flameGroup.position.y = 1.25;
candleGroup.add(flameGroup);

// Outer flame (darker orange-red tone)
const outerFlameGeo = new THREE.SphereGeometry(0.05, 16, 16);
outerFlameGeo.scale(1, 2.5, 1);
const outerFlameMat = new THREE.MeshBasicMaterial({
  color: 0xe85500,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});
const outerFlame = new THREE.Mesh(outerFlameGeo, outerFlameMat);
flameGroup.add(outerFlame);

// Inner flame (lighter yellow tone)
const innerFlameGeo = new THREE.SphereGeometry(0.025, 16, 16);
innerFlameGeo.scale(1, 2.2, 1);
const innerFlameMat = new THREE.MeshBasicMaterial({
  color: 0xffdd33,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});
const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
innerFlame.position.y = -0.01;
flameGroup.add(innerFlame);

// Flame light
const flameLight = new THREE.PointLight(0xff8800, 0, 8);
flameLight.position.copy(flameGroup.position);
flameLight.position.y += candleGroup.position.y;
cakeGroup.add(flameLight);

phase1ViewportFitObjects = [table, ridgeOuter, ridgeInner, plate, trayDecoGroup, cakeGroup];
const initialViewportFit = buildViewportCameraFit();
applyViewportCameraFit(initialViewportFit);
lastViewportCameraFit = cloneViewportCameraFit(initialViewportFit);

// ── Interaction ──
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isBurning = false;
let burnStartTime = 0;
const burnDuration = 7.0; // seconds

// Track mouse to distinguish click from drag
let mouseDownPos = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => {
  mouseDownPos.x = e.clientX;
  mouseDownPos.y = e.clientY;
});

renderer.domElement.addEventListener('pointerup', (event) => {
  // Ignore if mouse moved (was a drag/rotate)
  const dx = event.clientX - mouseDownPos.x;
  const dy = event.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 5) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects([candle, wick, candleHitbox]);

  if (hits.length > 0 && !isBurning) {
    startBurn();
  }
});

window.startBurn = startBurn;
window.lightTheFuse = () => startWickBurn();

// ── Procedural fire/crackle audio ──
let fireAudioCtx = null;
let fireGain = null;
let fireNoiseSource = null;
let crackleInterval = null;
let fireMasterVolume = 0;

function startFireAudio() {
  try {
    fireAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (fireAudioCtx.state === 'suspended') fireAudioCtx.resume();

    // Quiet low rumble base (very subtle, not hissy)
    const bufferSize = fireAudioCtx.sampleRate * 2;
    const noiseBuffer = fireAudioCtx.createBuffer(1, bufferSize, fireAudioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    fireNoiseSource = fireAudioCtx.createBufferSource();
    fireNoiseSource.buffer = noiseBuffer;
    fireNoiseSource.loop = true;

    // Lowpass to make it a warm rumble, not a hiss
    const lowpass = fireAudioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 300;
    lowpass.Q.value = 1.0;

    fireGain = fireAudioCtx.createGain();
    fireGain.gain.value = 0;

    fireNoiseSource.connect(lowpass);
    lowpass.connect(fireGain);
    fireGain.connect(fireAudioCtx.destination);
    fireNoiseSource.start();

    // Crackle pops - the main fire sound
    crackleInterval = setInterval(() => {
      if (!fireAudioCtx || fireMasterVolume < 0.01) return;
      // More frequent crackles (70% chance per tick)
      if (Math.random() > 0.7) return;
      const numPops = Math.floor(Math.random() * 4) + 1;
      for (let i = 0; i < numPops; i++) {
        setTimeout(() => {
          if (!fireAudioCtx) return;
          // Short noise burst for crackle (not oscillator - noise sounds more natural)
          const crackleLen = 0.01 + Math.random() * 0.03;
          const crackleFrames = Math.floor(fireAudioCtx.sampleRate * crackleLen);
          const crackBuf = fireAudioCtx.createBuffer(1, crackleFrames, fireAudioCtx.sampleRate);
          const crackData = crackBuf.getChannelData(0);
          // Shaped noise burst - sharp attack, fast decay
          for (let j = 0; j < crackleFrames; j++) {
            const env = Math.exp(-j / (crackleFrames * 0.15));
            crackData[j] = (Math.random() * 2 - 1) * env;
          }
          const crackSrc = fireAudioCtx.createBufferSource();
          crackSrc.buffer = crackBuf;

          // Bandpass to give it a woody snap character
          const bp = fireAudioCtx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 2000 + Math.random() * 4000;
          bp.Q.value = 1 + Math.random() * 3;

          const crackGain = fireAudioCtx.createGain();
          crackGain.gain.value = fireMasterVolume * (0.4 + Math.random() * 0.6);

          crackSrc.connect(bp);
          bp.connect(crackGain);
          crackGain.connect(fireAudioCtx.destination);
          crackSrc.start();
        }, Math.random() * 60);
      }
    }, 50);
  } catch(e) { /* no audio support */ }
}

function setFireVolume(v) {
  fireMasterVolume = Math.max(0, Math.min(1, v));
  if (fireGain && fireAudioCtx) {
    // Base rumble is quiet relative to crackles
    fireGain.gain.setTargetAtTime(fireMasterVolume * 0.15, fireAudioCtx.currentTime, 0.05);
  }
}

function stopFireAudio() {
  fireMasterVolume = 0;
  if (crackleInterval) { clearInterval(crackleInterval); crackleInterval = null; }
  if (fireGain && fireAudioCtx) {
    fireGain.gain.setTargetAtTime(0, fireAudioCtx.currentTime, 0.1);
  }
  setTimeout(() => {
    if (fireNoiseSource) { try { fireNoiseSource.stop(); } catch(e) {} fireNoiseSource = null; }
    if (fireAudioCtx) { fireAudioCtx.close().catch(() => {}); fireAudioCtx = null; }
    fireGain = null;
  }, 500);
}

async function playExplosionBoom() {
  try {
    const hadSharedContext = Boolean(phase2AudioContext);
    let ctx = ensurePhase2AudioContext();
    let ownsContext = false;

    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ownsContext = true;
    } else if (!hadSharedContext && ctx !== phase2AudioContext) {
      ownsContext = true;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (resumeError) {
        if (ownsContext) ctx.close().catch(() => {});
        return;
      }
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(1.05, now + 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.22);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -26;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.18;

    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(185, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(65, now + 0.55);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.75, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    const tailOsc = ctx.createOscillator();
    tailOsc.type = 'sine';
    tailOsc.frequency.setValueAtTime(120, now);
    tailOsc.frequency.exponentialRampToValueAtTime(58, now + 0.9);
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0.45, now + 0.02);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

    const crackDuration = 0.18;
    const crackFrames = Math.max(1, Math.floor(ctx.sampleRate * crackDuration));
    const crackBuffer = ctx.createBuffer(1, crackFrames, ctx.sampleRate);
    const crackData = crackBuffer.getChannelData(0);
    for (let i = 0; i < crackFrames; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t * 24);
      crackData[i] = (Math.random() * 2 - 1) * env;
    }

    const crackSource = ctx.createBufferSource();
    crackSource.buffer = crackBuffer;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 1200;
    crackFilter.Q.value = 0.7;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.9, now);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + crackDuration);

    bodyOsc.connect(bodyGain);
    tailOsc.connect(tailGain);
    crackSource.connect(crackFilter);
    crackFilter.connect(crackGain);

    bodyGain.connect(masterGain);
    tailGain.connect(masterGain);
    crackGain.connect(masterGain);
    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    bodyOsc.start(now);
    tailOsc.start(now);
    crackSource.start(now);

    bodyOsc.stop(now + 0.9);
    tailOsc.stop(now + 1.1);
    crackSource.stop(now + crackDuration);

    if (ownsContext) {
      tailOsc.onended = () => ctx.close().catch(() => {});
    }
  } catch (e) {}
}

function startBurn() {
  isBurning = true;
  burnStartTime = performance.now() / 1000;
  setStatusMessage('The cake is burning down. When the reveal finishes, choose a school on the cake or use the buttons below.');

  // Show flame
  flameGroup.visible = true;
  flameLight.intensity = 2.0;

  // Start fire crackling sound
  startFireAudio();

  // Kick fight song loading early (user gesture context helps on mobile)
  if (fightSong && !fightSongLoaded) fightSong.load();

  // Hide the light button
  document.getElementById('light-btn').style.display = 'none';

  // After phase 1, prompt user to click a school logo
  setTimeout(() => {
    showLogoSelectPrompt();
  }, burnDuration * 1000 + 2000);
}

window.resetCake = function() {
  // Full page reload for clean restart (handles both Phase 1 and Phase 2)
  location.reload();
};

// ── Gold ribbon band on bottom cake ──
const ribbonGeo = new THREE.TorusGeometry(3.35, 0.08, 12, 64);
const ribbonMat = new THREE.MeshStandardMaterial({
  color: 0xd4a843,
  roughness: 0.25,
  metalness: 0.7,
});
const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
ribbon.position.y = 1.05;
ribbon.rotation.x = Math.PI / 2;
cakeGroup.add(ribbon);

// Thin edge highlights above and below ribbon
const ribbonEdgeGeo = new THREE.TorusGeometry(3.36, 0.025, 8, 64);
const ribbonEdgeMat = new THREE.MeshStandardMaterial({
  color: 0xf0d060,
  roughness: 0.2,
  metalness: 0.8,
});
const ribbonEdgeTop = new THREE.Mesh(ribbonEdgeGeo, ribbonEdgeMat);
ribbonEdgeTop.position.y = 1.14;
ribbonEdgeTop.rotation.x = Math.PI / 2;
cakeGroup.add(ribbonEdgeTop);

const ribbonEdgeBottom = new THREE.Mesh(ribbonEdgeGeo, ribbonEdgeMat);
ribbonEdgeBottom.position.y = 0.96;
ribbonEdgeBottom.rotation.x = Math.PI / 2;
cakeGroup.add(ribbonEdgeBottom);

// ── Confetti sprinkles on bottom cake side ──
const confettiColors = [0xff4081, 0x7c4dff, 0x00bcd4, 0xffab00, 0x76ff03, 0xff6e40, 0x536dfe];
for (let i = 0; i < 150; i++) {
  const angle = Math.random() * Math.PI * 2;
  // Random y between bottom and top of cake, avoiding the ribbon band zone
  let y;
  if (Math.random() < 0.5) {
    y = 0.25 + Math.random() * 0.6; // below ribbon
  } else {
    y = 1.25 + Math.random() * 0.6; // above ribbon
  }
  // Interpolate radius at this height (tapers from 3.4 at bottom to 3.2 at top)
  const t = (y - 0.15) / 1.8;
  const radius = 3.4 - t * 0.2 + 0.02; // slightly proud of surface

  const confettiGeo = new THREE.CircleGeometry(0.04 + Math.random() * 0.03, 6);
  const confettiMat = new THREE.MeshStandardMaterial({
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    roughness: 0.4,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const confetti = new THREE.Mesh(confettiGeo, confettiMat);
  confetti.position.set(
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius
  );
  // Face outward and add slight random tilt
  confetti.rotation.y = -angle + Math.PI / 2;
  confetti.rotation.x = (Math.random() - 0.5) * 0.5;
  confetti.rotation.z = Math.random() * Math.PI; // random spin
  cakeGroup.add(confetti);
}

// ── Frosting decorations (small dots around rim) ──
for (let i = 0; i < 32; i++) {
  const angle = (i / 32) * Math.PI * 2;
  const dotGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const dot = new THREE.Mesh(dotGeo, frostingMaterial);
  dot.position.set(
    Math.cos(angle) * 3.3,
    1.95,
    Math.sin(angle) * 3.3
  );
  cakeGroup.add(dot);
}

const topDots = [];
for (let i = 0; i < 24; i++) {
  const angle = (i / 24) * Math.PI * 2;
  const dotGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const dot = new THREE.Mesh(dotGeo, frostingMaterial.clone());
  dot.position.set(
    Math.cos(angle) * 2.7,
    3.35,
    Math.sin(angle) * 2.7
  );
  cakeGroup.add(dot);
  topDots.push(dot);
}

// ── 3D Confetti system (iMessage-style, lands on cake/tray) ──
const celebrationColors = [
  0xFF3B30, 0xFF9500, 0xFFCC00, 0x34C759, 0x007AFF,
  0x5856D6, 0xAF52DE, 0xFF2D55, 0x00C7BE, 0xFFD700,
  0xE21833, 0x00274C, // Maryland red, Michigan blue
];
const confetti3D = [];
let confettiTriggered = false;
const confettiGroup = new THREE.Group();
scene.add(confettiGroup);

function launchConfetti() {
  // Spawn 400 small confetti pieces falling across the entire scene
  for (let i = 0; i < phase1ConfettiCount; i++) {
    // Random shape: rectangle or square confetti
    const w = 0.06 + Math.random() * 0.1;
    const h = 0.04 + Math.random() * 0.08;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({
      color: celebrationColors[Math.floor(Math.random() * celebrationColors.length)],
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Start position: spread across the entire scene
    const spread = 16;
    mesh.position.set(
      (Math.random() - 0.5) * spread,
      8 + Math.random() * 8, // start 8-16 units above
      (Math.random() - 0.5) * spread
    );

    // Random initial rotation
    mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    confettiGroup.add(mesh);

    // Landing surface: determine where this piece lands
    // Cake top surface is at y ≈ 2.06, radius ≈ 2.6
    // Platter surface is at y ≈ 0.15, radius ≈ 6
    const xz = Math.sqrt(mesh.position.x * mesh.position.x + mesh.position.z * mesh.position.z);
    let landY;
    let surface;
    if (xz < 2.5) {
      landY = 2.1 + Math.random() * 0.05; // land on cake top
      surface = 'cake';
    } else if (xz < 5.8) {
      landY = 0.15 + Math.random() * 0.05; // land on platter
      surface = 'ground';
    } else {
      landY = 0.1 + Math.random() * 0.05; // land on platter edge
      surface = 'ground';
    }

    confetti3D.push({
      mesh,
      vy: -(1.5 + Math.random() * 1.0), // fall speed (straight down, fast)
      vx: (Math.random() - 0.5) * 0.15,  // very slight horizontal drift
      vz: (Math.random() - 0.5) * 0.15,
      rotSpeed: {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 1,
      },
      landed: false,
      landY,
      surface,
      delay: Math.random() * 1.5, // stagger the start (0-1.5 seconds)
      started: false,
    });
  }
}

function updateConfetti3D(dt, elapsed) {
  for (const p of confetti3D) {
    if (p.landed) continue;

    // Stagger start
    if (!p.started) {
      p.delay -= dt;
      if (p.delay > 0) {
        p.mesh.visible = false;
        continue;
      }
      p.started = true;
      p.mesh.visible = true;
    }

    // Gravity
    p.vy -= 2.5 * dt; // gravity acceleration

    // Update position — mostly straight down
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;

    // Gentle tumble rotation while falling
    p.mesh.rotation.x += p.rotSpeed.x * dt;
    p.mesh.rotation.y += p.rotSpeed.y * dt;
    p.mesh.rotation.z += p.rotSpeed.z * dt;

    // Land on surface
    if (p.mesh.position.y <= p.landY) {
      p.mesh.position.y = p.landY;
      p.landed = true;
      // Flatten rotation to lie on surface
      p.mesh.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      p.mesh.rotation.z = Math.random() * Math.PI * 2;
    }
  }
}

function disposeConfettiPiece(p) {
  confettiGroup.remove(p.mesh);
  p.mesh.geometry.dispose();
  p.mesh.material.dispose();
}

function settleGroundConfetti() {
  const grounded = [];
  for (const p of confetti3D) {
    if (p.surface === 'cake') {
      disposeConfettiPiece(p);
      continue;
    }
    p.started = true;
    p.landed = true;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.mesh.visible = true;
    p.mesh.position.y = p.landY;
    p.mesh.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    p.mesh.rotation.z = Math.random() * Math.PI * 2;
    grounded.push(p);
  }
  confetti3D.length = 0;
  confetti3D.push(...grounded);
}

function clearConfetti3D() {
  for (const p of confetti3D) {
    disposeConfettiPiece(p);
  }
  confetti3D.length = 0;
  confettiTriggered = false;
}

// ===== PHASE 2: TNT WICK + EXPLOSION + MICHIGAN CELEBRATION =====

// ── Phase 2 State ──
let phase2State = 'idle'; // idle | wickReady | wickBurning | slowMo | exploding | blackout | revealing | celebrating
let phase2StartTime = 0;
let wickBurnStart = 0;
const wickBurnDuration = 4.0;
let slowMoStart = 0;
let explosionStart = 0;
let blackoutStart = 0;
let revealStart = 0;
let cameraStartPos = null;
let cameraStartTarget = null;
let wickReadyTime = 0;
let phase2AudioContext = null;
let wickFuseNoiseSource = null;
let wickFuseGain = null;
let wickFuseLfo = null;
let wickFuseLfoGain = null;
let wickFuseCrackleInterval = null;
let wickFuseActive = false;
let fightSongPrimed = false;

// ── Audio: Preload fight song ──
let fightSong = null;
let fightSongLoaded = false;

function createFightSongAudio(src) {
  try {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.addEventListener('canplaythrough', () => {
      if (fightSong === audio) fightSongLoaded = true;
    });
    audio.addEventListener('canplay', () => {
      if (fightSong === audio) fightSongLoaded = true;
    });
    audio.load();
    return audio;
  } catch (e) {
    return null;
  }
}

const preloadedFightSongs = Object.fromEntries(
  Object.entries(SELECTABLE_SCHOOLS).map(([key, school]) => [key, createFightSongAudio(school.celebration?.fightSong ?? school.audio)])
);

fightSong = preloadedFightSongs[DEFAULT_SCHOOL_KEY];
if (fightSong && fightSong.readyState >= 2) fightSongLoaded = true;

function ensurePhase2AudioContext() {
  try {
    if (!phase2AudioContext) {
      phase2AudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (phase2AudioContext.state === 'suspended') phase2AudioContext.resume();
    return phase2AudioContext;
  } catch (e) {
    return null;
  }
}

function primeFightSongPlayback() {
  if (!fightSong || fightSongPrimed) return;
  try {
    const primedSong = fightSong;
    primedSong.muted = true;
    primedSong.volume = 0;
    const resetPrimedSong = () => {
      if (fightSong !== primedSong) return;
      if (phase2State === 'idle' || phase2State === 'wickReady') {
        primedSong.pause();
        primedSong.currentTime = 0;
      }
      primedSong.muted = false;
      primedSong.volume = 1;
      fightSongPrimed = true;
    };
    const playPromise = primedSong.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        resetPrimedSong();
      }).catch(() => {
        if (fightSong !== primedSong) return;
        primedSong.muted = false;
        primedSong.volume = 1;
      });
    } else {
      resetPrimedSong();
    }
  } catch (e) {
    try {
      if (fightSong) {
        fightSong.muted = false;
        fightSong.volume = 1;
      }
    } catch (inner) {}
  }
}

function startFightSongPlayback() {
  if (!fightSong) return;
  try {
    fightSongLoaded = true;
    fightSong.muted = false;
    fightSong.volume = 1;
    fightSong.currentTime = 0;
    const playSong = () => {
      fightSong.play().catch(() => {});
    };
    if (fightSong.readyState >= 2) {
      playSong();
    } else {
      fightSong.addEventListener('canplay', playSong, { once: true });
      fightSong.load();
    }
    const audioToggle = document.getElementById('audio-toggle');
    audioToggle.style.display = 'flex';
    setAudioToggleState(true);
  } catch (e) {}
}

function startWickFuseAudio() {
  const ctx = ensurePhase2AudioContext();
  if (!ctx || wickFuseActive) return;

  wickFuseActive = true;

  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  wickFuseNoiseSource = ctx.createBufferSource();
  wickFuseNoiseSource.buffer = noiseBuffer;
  wickFuseNoiseSource.loop = true;

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 900;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 2200;
  bandpass.Q.value = 1.1;

  wickFuseGain = ctx.createGain();
  wickFuseGain.gain.value = 0.0001;

  wickFuseNoiseSource.connect(highpass);
  highpass.connect(bandpass);
  bandpass.connect(wickFuseGain);
  wickFuseGain.connect(ctx.destination);

  wickFuseLfo = ctx.createOscillator();
  wickFuseLfo.type = 'triangle';
  wickFuseLfo.frequency.value = 7;
  wickFuseLfoGain = ctx.createGain();
  wickFuseLfoGain.gain.value = 260;
  wickFuseLfo.connect(wickFuseLfoGain);
  wickFuseLfoGain.connect(bandpass.frequency);

  const now = ctx.currentTime;
  wickFuseGain.gain.exponentialRampToValueAtTime(0.05, now + 0.04);
  wickFuseNoiseSource.start();
  wickFuseLfo.start();

  wickFuseCrackleInterval = setInterval(() => {
    if (!wickFuseActive || !phase2AudioContext) return;
    if (Math.random() > 0.55) return;

    const burstLen = 0.008 + Math.random() * 0.018;
    const burstFrames = Math.max(1, Math.floor(phase2AudioContext.sampleRate * burstLen));
    const burstBuffer = phase2AudioContext.createBuffer(1, burstFrames, phase2AudioContext.sampleRate);
    const burstData = burstBuffer.getChannelData(0);
    for (let i = 0; i < burstFrames; i++) {
      const env = Math.exp(-i / (burstFrames * 0.12));
      burstData[i] = (Math.random() * 2 - 1) * env;
    }

    const burstSource = phase2AudioContext.createBufferSource();
    burstSource.buffer = burstBuffer;

    const burstFilter = phase2AudioContext.createBiquadFilter();
    burstFilter.type = 'bandpass';
    burstFilter.frequency.value = 2600 + Math.random() * 2200;
    burstFilter.Q.value = 2.5;

    const burstGain = phase2AudioContext.createGain();
    burstGain.gain.value = 0.02 + Math.random() * 0.03;

    burstSource.connect(burstFilter);
    burstFilter.connect(burstGain);
    burstGain.connect(phase2AudioContext.destination);
    burstSource.start();
  }, 45);
}

function stopWickFuseAudio() {
  if (wickFuseCrackleInterval) {
    clearInterval(wickFuseCrackleInterval);
    wickFuseCrackleInterval = null;
  }
  if (!wickFuseActive) return;

  wickFuseActive = false;

  const ctx = phase2AudioContext;
  if (ctx && wickFuseGain) {
    const now = ctx.currentTime;
    try {
      wickFuseGain.gain.cancelScheduledValues(now);
      wickFuseGain.gain.setValueAtTime(Math.max(wickFuseGain.gain.value, 0.0001), now);
      wickFuseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    } catch (e) {}
  }

  setTimeout(() => {
    if (wickFuseNoiseSource) {
      try { wickFuseNoiseSource.stop(); } catch (e) {}
      wickFuseNoiseSource = null;
    }
    if (wickFuseLfo) {
      try { wickFuseLfo.stop(); } catch (e) {}
      wickFuseLfo = null;
    }
    wickFuseLfoGain = null;
    wickFuseGain = null;
  }, 180);
}

window.toggleFightSong = function() {
  if (!fightSong) return;
  if (fireAudioCtx && fireAudioCtx.state === 'suspended') fireAudioCtx.resume();
  if (phase2AudioContext && phase2AudioContext.state === 'suspended') phase2AudioContext.resume();
  if (fightSong.paused) {
    fightSong.play().catch(() => {});
    setAudioToggleState(true);
  } else {
    fightSong.pause();
    setAudioToggleState(false);
  }
};

// ── TNT Block ──
const tntGroup = new THREE.Group();
tntGroup.visible = false;
scene.add(tntGroup);

// TNT box
const tntBoxGeo = new THREE.BoxGeometry(0.6, 0.5, 0.4);
const tntMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
const tntBox = new THREE.Mesh(tntBoxGeo, tntMat);
tntBox.position.y = 0.25;
tntBox.castShadow = true;
tntGroup.add(tntBox);

// TNT label (canvas texture)
const tntCanvas = document.createElement('canvas');
tntCanvas.width = 128; tntCanvas.height = 64;
const tntCtx = tntCanvas.getContext('2d');
tntCtx.fillStyle = '#cc2222';
tntCtx.fillRect(0, 0, 128, 64);
tntCtx.fillStyle = '#ffffff';
tntCtx.font = 'bold 40px Georgia';
tntCtx.textAlign = 'center';
tntCtx.textBaseline = 'middle';
tntCtx.fillText('TNT', 64, 32);
const tntTexture = new THREE.CanvasTexture(tntCanvas);
const tntLabelGeo = new THREE.PlaneGeometry(0.5, 0.25);
const tntLabelMat = new THREE.MeshBasicMaterial({ map: tntTexture, transparent: true });
const tntLabel = new THREE.Mesh(tntLabelGeo, tntLabelMat);
tntLabel.position.set(0, 0.25, 0.21);
tntGroup.add(tntLabel);
// Back label
const tntLabel2 = tntLabel.clone();
tntLabel2.position.z = -0.21;
tntLabel2.rotation.y = Math.PI;
tntGroup.add(tntLabel2);

// Position TNT at ~5 o'clock on platter (top-down view)
const tntAngle = (5 / 12) * Math.PI * 2 - Math.PI / 2; // 5 o'clock
const tntRadius = 4.0;
tntGroup.position.set(Math.cos(tntAngle) * tntRadius, 0.0, Math.sin(tntAngle) * tntRadius);
tntGroup.rotation.y = -tntAngle + Math.PI / 2;

// ── Wick (TubeGeometry spiraling around cake) ──
// Curve goes from tap-point (front/6 o'clock, t=0) → spirals around → TNT (5 o'clock, t=1)
// Burn shader burns from t=0 toward t=1, so fire travels from tap toward TNT
const wickCurvePoints = [];
const wickSpirals = 1.8;
const wickSegments = 80;
const wickTapAngle = Math.PI / 2; // 6 o'clock = directly in front of default camera
for (let i = 0; i <= wickSegments; i++) {
  const t = i / wickSegments;
  // Spiral from tap point toward TNT
  const angle = wickTapAngle + t * wickSpirals * Math.PI * 2;
  const r = 3.45 + Math.sin(t * Math.PI * 4) * 0.1;
  const y = 0.8 - t * 0.5; // starts partway up cake, ends near platter at TNT
  wickCurvePoints.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
}
// Add final point going into the TNT box
wickCurvePoints.push(new THREE.Vector3(
  Math.cos(tntAngle) * (tntRadius - 0.2), 0.25, Math.sin(tntAngle) * (tntRadius - 0.2)
));
const wickCurve = new THREE.CatmullRomCurve3(wickCurvePoints);
const wickTubeGeo = new THREE.TubeGeometry(wickCurve, wickSegments, 0.035, 8, false);

// Wick burn shader
const wickBurnVertexShader = `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const wickBurnFragmentShader = `
  uniform float uBurnProgress;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    float t = vUv.x; // along the tube length
    float burnFront = uBurnProgress;
    float edgeW = 0.02;

    // Behind burn front: discard (consumed)
    if (t < burnFront - edgeW && uBurnProgress > 0.0) {
      discard;
    }

    // Base wick color (dark brown)
    vec3 color = vec3(0.25, 0.15, 0.08);

    // Ember glow at burn front
    float ember = smoothstep(burnFront - edgeW, burnFront, t) *
                  (1.0 - smoothstep(burnFront, burnFront + edgeW, t));
    vec3 emberColor = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 1.0, 0.3), sin(uTime * 15.0) * 0.5 + 0.5);
    color = mix(color, emberColor, ember * 3.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;
const wickBurnUniforms = {
  uBurnProgress: { value: 0.0 },
  uTime: { value: 0.0 },
};
const wickTubeMat = new THREE.ShaderMaterial({
  uniforms: wickBurnUniforms,
  vertexShader: wickBurnVertexShader,
  fragmentShader: wickBurnFragmentShader,
  side: THREE.DoubleSide,
});
const wickTube = new THREE.Mesh(wickTubeGeo, wickTubeMat);
wickTube.visible = false;
scene.add(wickTube);

// Invisible hitbox at wick start (end of curve = tap point)
const wickEndPt = wickCurve.getPointAt(0.0); // tap point is at start of curve (front of viewer)
const wickHitGeo = new THREE.SphereGeometry(0.5, 8, 8);
const wickHitMat = new THREE.MeshBasicMaterial({ visible: false });
const wickHitbox = new THREE.Mesh(wickHitGeo, wickHitMat);
wickHitbox.position.copy(wickEndPt);
wickHitbox.visible = false;
scene.add(wickHitbox);

// Wick-end glow indicator
const wickGlowGeo = new THREE.SphereGeometry(0.12, 12, 12);
const wickGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 });
const wickGlow = new THREE.Mesh(wickGlowGeo, wickGlowMat);
wickGlow.position.copy(wickEndPt);
wickGlow.visible = false;
scene.add(wickGlow);

// ── Spark particles for wick burn ──
const sparkGroup = new THREE.Group();
scene.add(sparkGroup);
const sparks = [];

function spawnSpark(pos) {
  const geo = new THREE.SphereGeometry(0.03, 4, 4);
  const mat = new THREE.MeshBasicMaterial({
    color: Math.random() > 0.5 ? 0xff8800 : 0xffcc00,
    transparent: true,
    opacity: 1.0,
  });
  const spark = new THREE.Mesh(geo, mat);
  spark.position.copy(pos);
  spark.position.x += (Math.random() - 0.5) * 0.1;
  spark.position.y += Math.random() * 0.1;
  spark.position.z += (Math.random() - 0.5) * 0.1;
  sparkGroup.add(spark);
  sparks.push({
    mesh: spark,
    vy: 1.0 + Math.random() * 2.0,
    vx: (Math.random() - 0.5) * 1.5,
    vz: (Math.random() - 0.5) * 1.5,
    life: 0.4 + Math.random() * 0.3,
    age: 0,
  });
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.age += dt;
    if (s.age > s.life) {
      sparkGroup.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
      sparks.splice(i, 1);
      continue;
    }
    s.vy -= 5.0 * dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.mesh.position.z += s.vz * dt;
    s.mesh.material.opacity = 1.0 - (s.age / s.life);
  }
}

function clearSparks() {
  for (const s of sparks) {
    sparkGroup.remove(s.mesh);
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
  }
  sparks.length = 0;
}

// ── Explosion particles ──
const explosionParticles = [];
const explosionGroup = new THREE.Group();
scene.add(explosionGroup);

function triggerExplosion() {
  const colors = [0xfff8f0, 0xffffff, 0xff6600, 0xff3300, 0xffcc00, 0xff9900];
  for (let i = 0; i < explosionParticleCount; i++) {
    const size = 0.05 + Math.random() * 0.1;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      roughness: 0.5,
      transparent: true,
      opacity: 1.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random() - 0.5) * 2,
      1.0 + Math.random() * 1.5,
      (Math.random() - 0.5) * 2
    );
    explosionGroup.add(mesh);
    // Spherical burst velocity
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 5 + Math.random() * 10;
    explosionParticles.push({
      mesh,
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.cos(phi) * speed * 0.8 + 3, // bias upward
      vz: Math.sin(phi) * Math.sin(theta) * speed,
      rotX: (Math.random() - 0.5) * 8,
      rotY: (Math.random() - 0.5) * 8,
      age: 0,
      life: 1.0 + Math.random() * 0.8,
    });
  }
}

function updateExplosionParticles(dt) {
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
    const p = explosionParticles[i];
    p.age += dt;
    if (p.age > p.life) {
      explosionGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      explosionParticles.splice(i, 1);
      continue;
    }
    p.vy -= 9.8 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += p.rotX * dt;
    p.mesh.rotation.y += p.rotY * dt;
    p.mesh.material.opacity = Math.max(0, 1.0 - (p.age / p.life));
  }
}

function clearExplosionParticles() {
  for (const p of explosionParticles) {
    explosionGroup.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  explosionParticles.length = 0;
}

// ── Screen shake state ──
let shakeAmplitude = 0;
let shakeDecay = 0;
let shakeTime = 0;

// ── Michigan Cube (Endover Cube) ──
// The iconic sculpture on U-M campus: a dark steel cube balanced on one vertex, rotating
// Structure: monumentGroup (translate) → cubeSpinGroup (spins around world Y)
//            → cubeTiltGroup (static tilt to balance on vertex)
const CENTERPIECE_START_Y = -5;
const DEFAULT_CENTERPIECE_SPIN_SPEED = 0.4;
const celebrationCenterpieces = new Map();
let activeCenterpiece = null;
const monumentGroup = new THREE.Group();
monumentGroup.visible = false;
monumentGroup.position.y = CENTERPIECE_START_Y; // starts below scene
scene.add(monumentGroup);

// Spin group: rotates around world Y axis (OUTER group, so Y = world vertical)
// Bottom vertex stays fixed while the cube spins horizontally
const cubeSpinGroup = new THREE.Group();
monumentGroup.add(cubeSpinGroup);

// Tilt group: rotates so one vertex points straight down (INNER group)
// Quaternion aligns body diagonal (1,1,1) with vertical (0,1,0)
const cubeTiltGroup = new THREE.Group();
cubeTiltGroup.quaternion.setFromUnitVectors(
  new THREE.Vector3(1, 1, 1).normalize(),
  new THREE.Vector3(0, 1, 0)
);
cubeSpinGroup.add(cubeTiltGroup);

const cubeSize = 2.4;

// Dark weathered steel material — reads black under the reveal spotlight
const cubeMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  roughness: 0.68,
  metalness: 0.82,
  emissive: new THREE.Color(0x080808),
});
// Channel/gap material between panels (dark recessed grooves)
const channelMat = new THREE.MeshStandardMaterial({
  color: 0x030303,
  roughness: 0.95,
  metalness: 0.3,
  emissive: new THREE.Color(0x010101),
});

// Build the cube from 8 individual panels per face (2x2 grid with gaps)
// This matches the real Endover Cube's appearance
const panelSize = cubeSize / 2 - 0.04; // each panel slightly smaller than half
const gapWidth = 0.06; // channel between panels
const panelDepth = 0.08; // panels are slightly recessed from edges

function buildCubeFace(group, faceAxis, faceSign) {
  // Each face has a 2x2 grid of panels
  const offsets = [-cubeSize / 4, cubeSize / 4]; // center positions of each panel

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      let geo, mesh;
      const p = panelSize;

      if (faceAxis === 'z') {
        geo = new THREE.BoxGeometry(p, p, panelDepth);
        mesh = new THREE.Mesh(geo, cubeMat);
        mesh.position.set(offsets[c], offsets[r], faceSign * (cubeSize / 2 - panelDepth / 2));
      } else if (faceAxis === 'x') {
        geo = new THREE.BoxGeometry(panelDepth, p, p);
        mesh = new THREE.Mesh(geo, cubeMat);
        mesh.position.set(faceSign * (cubeSize / 2 - panelDepth / 2), offsets[r], offsets[c]);
      } else {
        geo = new THREE.BoxGeometry(p, panelDepth, p);
        mesh = new THREE.Mesh(geo, cubeMat);
        mesh.position.set(offsets[c], faceSign * (cubeSize / 2 - panelDepth / 2), offsets[r]);
      }
      mesh.castShadow = true;
      group.add(mesh);
    }
  }
}

// Inner cube body (slightly smaller, visible through gaps as the dark channel)
const innerCubeGeo = new THREE.BoxGeometry(cubeSize - 0.12, cubeSize - 0.12, cubeSize - 0.12);
const innerCube = new THREE.Mesh(innerCubeGeo, channelMat);
cubeTiltGroup.add(innerCube);

// Build all 6 faces with paneled surface
buildCubeFace(cubeTiltGroup, 'z', 1);   // front
buildCubeFace(cubeTiltGroup, 'z', -1);  // back
buildCubeFace(cubeTiltGroup, 'x', 1);   // right
buildCubeFace(cubeTiltGroup, 'x', -1);  // left
buildCubeFace(cubeTiltGroup, 'y', 1);   // top
buildCubeFace(cubeTiltGroup, 'y', -1);  // bottom

// Edge frame pieces (the raised edges between faces)
const edgeLen = cubeSize;
const edgeThick = 0.06;
const edgePositions = [
  // 12 edges of a cube
  { pos: [0, cubeSize/2, cubeSize/2], size: [edgeLen, edgeThick, edgeThick] },
  { pos: [0, -cubeSize/2, cubeSize/2], size: [edgeLen, edgeThick, edgeThick] },
  { pos: [0, cubeSize/2, -cubeSize/2], size: [edgeLen, edgeThick, edgeThick] },
  { pos: [0, -cubeSize/2, -cubeSize/2], size: [edgeLen, edgeThick, edgeThick] },
  { pos: [cubeSize/2, 0, cubeSize/2], size: [edgeThick, edgeLen, edgeThick] },
  { pos: [-cubeSize/2, 0, cubeSize/2], size: [edgeThick, edgeLen, edgeThick] },
  { pos: [cubeSize/2, 0, -cubeSize/2], size: [edgeThick, edgeLen, edgeThick] },
  { pos: [-cubeSize/2, 0, -cubeSize/2], size: [edgeThick, edgeLen, edgeThick] },
  { pos: [cubeSize/2, cubeSize/2, 0], size: [edgeThick, edgeThick, edgeLen] },
  { pos: [-cubeSize/2, cubeSize/2, 0], size: [edgeThick, edgeThick, edgeLen] },
  { pos: [cubeSize/2, -cubeSize/2, 0], size: [edgeThick, edgeThick, edgeLen] },
  { pos: [-cubeSize/2, -cubeSize/2, 0], size: [edgeThick, edgeThick, edgeLen] },
];
edgePositions.forEach(({ pos, size }) => {
  const geo = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geo, cubeMat);
  mesh.position.set(...pos);
  cubeTiltGroup.add(mesh);
});

// The bottom vertex when balanced is at y = -cubeSize * sqrt(3)/2 ≈ -2.08
const cubeVertexOffset = cubeSize * Math.sqrt(3) / 2;

// Subtle ground shadow disc (attached to tilt group so it stays under the vertex)
const shadowGeo = new THREE.CircleGeometry(0.4, 16);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
shadowDisc.rotation.x = -Math.PI / 2;
shadowDisc.position.y = -cubeVertexOffset;
monumentGroup.add(shadowDisc); // on monumentGroup so it doesn't spin

// ── Maryland 3D "M" Letter ──
// Upright M that spins horizontally on the ground (not tilted like the cube)
// Own spin group directly under monumentGroup, bypassing cubeTiltGroup
const mLetterSpinGroup = new THREE.Group();
mLetterSpinGroup.visible = false;
monumentGroup.add(mLetterSpinGroup);

const mLetterGroup = new THREE.Group();
// Position M so its feet sit at the same ground level as the cube's bottom vertex
// M total height = legH + 2*serfH = 3.2, center at 0, bottom at -1.6
// Monument final y = cubeVertexOffset ≈ 2.08, ground at -cubeVertexOffset from monument origin
// Shift: -(cubeVertexOffset - 1.6) to align feet with ground
mLetterGroup.position.y = -(cubeSize * Math.sqrt(3) / 2 - 1.6);
mLetterSpinGroup.add(mLetterGroup);

(function buildMarylandM() {
  // Block "M" built from 5 boxes (two legs, two diagonals, and a base connector)
  // This avoids ExtrudeGeometry triangulation issues with complex shapes
  const mRed = new THREE.MeshStandardMaterial({
    color: 0xCE1126,
    roughness: 0.4,
    metalness: 0.3,
    emissive: new THREE.Color(0xCE1126).multiplyScalar(0.15),
  });
  const mGold = new THREE.MeshStandardMaterial({
    color: 0xFCD116,
    roughness: 0.35,
    metalness: 0.5,
    emissive: new THREE.Color(0xFCD116).multiplyScalar(0.1),
  });

  const s = 1.0; // overall scale
  const depth = 0.5 * s;
  const legW = 0.5 * s;   // width of each vertical leg
  const legH = 2.4 * s;   // height of each leg
  const totalW = 2.4 * s;  // total M width
  const serfH = 0.4 * s;  // serif/base height

  // Left vertical leg
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, depth), mRed);
  leftLeg.position.set(-totalW/2 + legW/2, 0, 0);
  leftLeg.castShadow = true;
  mLetterGroup.add(leftLeg);

  // Right vertical leg
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, depth), mRed);
  rightLeg.position.set(totalW/2 - legW/2, 0, 0);
  rightLeg.castShadow = true;
  mLetterGroup.add(rightLeg);

  // Left diagonal (angled from top-left to center-bottom)
  const diagLen = Math.sqrt((totalW/2 - legW/2) ** 2 + (legH * 0.65) ** 2);
  const diagAngle = Math.atan2(legH * 0.65, totalW/2 - legW/2);
  const leftDiag = new THREE.Mesh(new THREE.BoxGeometry(diagLen, legW * 0.7, depth), mRed);
  leftDiag.position.set(-totalW/4 + legW/4, legH * 0.15, 0);
  leftDiag.rotation.z = -diagAngle;
  leftDiag.castShadow = true;
  mLetterGroup.add(leftDiag);

  // Right diagonal (angled from top-right to center-bottom)
  const rightDiag = new THREE.Mesh(new THREE.BoxGeometry(diagLen, legW * 0.7, depth), mRed);
  rightDiag.position.set(totalW/4 - legW/4, legH * 0.15, 0);
  rightDiag.rotation.z = diagAngle;
  rightDiag.castShadow = true;
  mLetterGroup.add(rightDiag);

  // Top serifs (left and right)
  const serifW = legW * 1.4;
  const leftSerif = new THREE.Mesh(new THREE.BoxGeometry(serifW, serfH, depth), mGold);
  leftSerif.position.set(-totalW/2 + legW/2, legH/2 + serfH/2, 0);
  leftSerif.castShadow = true;
  mLetterGroup.add(leftSerif);

  const rightSerif = new THREE.Mesh(new THREE.BoxGeometry(serifW, serfH, depth), mGold);
  rightSerif.position.set(totalW/2 - legW/2, legH/2 + serfH/2, 0);
  rightSerif.castShadow = true;
  mLetterGroup.add(rightSerif);

  // Bottom serifs
  const leftBaseSerif = new THREE.Mesh(new THREE.BoxGeometry(serifW, serfH, depth), mGold);
  leftBaseSerif.position.set(-totalW/2 + legW/2, -legH/2 - serfH/2, 0);
  leftBaseSerif.castShadow = true;
  mLetterGroup.add(leftBaseSerif);

  const rightBaseSerif = new THREE.Mesh(new THREE.BoxGeometry(serifW, serfH, depth), mGold);
  rightBaseSerif.position.set(totalW/2 - legW/2, -legH/2 - serfH/2, 0);
  rightBaseSerif.castShadow = true;
  mLetterGroup.add(rightBaseSerif);
})();

function registerCelebrationCenterpiece(key, options) {
  const centerpiece = {
    spinSpeed: DEFAULT_CENTERPIECE_SPIN_SPEED,
    ...options,
  };
  celebrationCenterpieces.set(key, centerpiece);
  return centerpiece;
}

function setActiveCelebrationCenterpiece(key) {
  activeCenterpiece = celebrationCenterpieces.get(key) || null;
  celebrationCenterpieces.forEach(({ root }) => {
    if (root) root.visible = false;
  });
  if (activeCenterpiece?.root) {
    activeCenterpiece.root.visible = true;
  }
}

function getActiveCelebrationCenterpiece() {
  return activeCenterpiece;
}

function getActiveCenterpieceRiseTargetY() {
  return getActiveCelebrationCenterpiece()?.riseTargetY ?? cubeVertexOffset;
}

function getActiveCenterpieceLookAtY() {
  return getActiveCelebrationCenterpiece()?.lookAtY ?? cubeVertexOffset;
}

function updateActiveCelebrationCenterpiece(dt) {
  const centerpiece = getActiveCelebrationCenterpiece();
  if (!centerpiece?.spinGroup) return;
  centerpiece.spinGroup.rotation.y += centerpiece.spinSpeed * dt;
}

function resetCelebrationCenterpieces() {
  celebrationCenterpieces.forEach((centerpiece) => {
    if (centerpiece.root) centerpiece.root.visible = false;
    if (centerpiece.spinGroup) centerpiece.spinGroup.rotation.set(0, 0, 0);
    centerpiece.reset?.();
  });
}

registerCelebrationCenterpiece('cube', {
  root: cubeSpinGroup,
  spinGroup: cubeSpinGroup,
  riseTargetY: cubeVertexOffset,
  lookAtY: cubeVertexOffset,
});

registerCelebrationCenterpiece('mLetter', {
  root: mLetterSpinGroup,
  spinGroup: mLetterSpinGroup,
  riseTargetY: cubeVertexOffset,
  lookAtY: cubeVertexOffset,
});

const defaultCelebrationSchool = SELECTABLE_SCHOOLS[DEFAULT_SCHOOL_KEY];
setActiveCelebrationCenterpiece(defaultCelebrationSchool?.celebration?.centerpieceKey ?? defaultCelebrationSchool?.monument);

// ── Balloons ──
const balloonGroup = new THREE.Group();
scene.add(balloonGroup);
const balloons = [];
const defaultSchoolTheme = SELECTABLE_SCHOOLS[DEFAULT_SCHOOL_KEY];
const defaultPrimaryColor = defaultSchoolTheme.primary;
const defaultSecondaryColor = defaultSchoolTheme.secondary;

function spawnBalloons() {
  const c1 = activeSchool ? activeSchool.primary : defaultPrimaryColor;
  const c2 = activeSchool ? activeSchool.secondary : defaultSecondaryColor;
  for (let i = 0; i < balloonCount; i++) {
    const color = i % 2 === 0 ? c1 : c2;
    const bGroup = new THREE.Group();

    // Balloon body (elongated sphere)
    const bGeo = new THREE.SphereGeometry(0.25, 12, 12);
    const bMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.1,
      emissive: new THREE.Color(color).multiplyScalar(0.3), // glow so dark blue is visible
    });
    const balloon = new THREE.Mesh(bGeo, bMat);
    balloon.scale.set(1, 1.3, 1);
    bGroup.add(balloon);

    // Knot at bottom
    const knotGeo = new THREE.ConeGeometry(0.04, 0.08, 6);
    const knot = new THREE.Mesh(knotGeo, bMat);
    knot.position.y = -0.33;
    knot.rotation.x = Math.PI;
    bGroup.add(knot);

    // String
    const stringGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.0, 4);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.y = -0.83;
    bGroup.add(string);

    // Start position below scene
    const spread = 8;
    bGroup.position.set(
      (Math.random() - 0.5) * spread,
      -5 - Math.random() * 5,
      (Math.random() - 0.5) * spread
    );

    balloonGroup.add(bGroup);
    balloons.push({
      mesh: bGroup,
      vy: 2.0 + Math.random() * 2.0,
      drift: Math.random() * Math.PI * 2, // phase offset for sine drift
      driftSpeed: 0.5 + Math.random() * 0.5,
      driftAmp: 0.3 + Math.random() * 0.3,
      bobPhase: Math.random() * Math.PI * 2,
      delay: Math.random() * 2.0, // stagger spawn
      started: false,
    });
  }
}

function updateBalloons(dt, elapsed) {
  for (let i = balloons.length - 1; i >= 0; i--) {
    const b = balloons[i];
    if (!b.started) {
      b.delay -= dt;
      if (b.delay > 0) continue;
      b.started = true;
    }
    b.mesh.position.y += b.vy * dt;
    // Gentle horizontal drift
    b.mesh.position.x += Math.sin(elapsed * b.driftSpeed + b.drift) * b.driftAmp * dt;
    // Slight bobbing
    b.mesh.position.y += Math.sin(elapsed * 2 + b.bobPhase) * 0.1 * dt;

    // Remove if way above camera
    if (b.mesh.position.y > 25) {
      balloonGroup.remove(b.mesh);
      b.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
      balloons.splice(i, 1);
    }
  }
}

function clearBalloons() {
  for (const b of balloons) {
    balloonGroup.remove(b.mesh);
    b.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
  }
  balloons.length = 0;
}

// ── School configurations ──
let activeSchool = null; // set by logo click
let awaitingLogoClick = false; // true after phase 1 burn, before logo selection

const schoolConfig = SELECTABLE_SCHOOLS;

function showLogoSelectPrompt() {
  awaitingLogoClick = true;
  showSchoolPicker();
  setStatusMessage('Choose a school!');
}

function selectSchool(config) {
  awaitingLogoClick = false;
  activeSchool = config;
  applySchoolTheme();
  hideSchoolPicker();
  setStatusMessage(`${config.name} selected. Starting the celebration.`);

  ensurePhase2AudioContext();
  primeFightSongPlayback();

  enterPhase2();
  // Auto-light the fuse after 1 second (no manual tap needed)
  setTimeout(() => { startWickBurn(); }, 1000);
}

window.selectSchoolByKey = function(key) {
  if (!awaitingLogoClick) return false;
  const config = schoolConfig[key];
  if (!config) return false;
  selectSchool(config);
  return true;
};

function applySchoolTheme() {
  const s = activeSchool;
  const celebration = s.celebration || {};
  setCongratsMessage(celebration.headline ?? SITE_CONFIG.event.congratsHeadline, s.secondaryCSS, s.primaryCSS);
  colorLettersWithColors(celebration.cheerText ?? s.goText, 'goblue-text', s.secondaryCSS, s.primaryCSS);
  document.getElementById('congrats-logo-left').src = s.logo;
  document.getElementById('congrats-logo-right').src = s.logo;
  setActiveCelebrationCenterpiece(celebration.centerpieceKey ?? s.monument);
  requestAnimationFrame(syncCongratsOverlayLayout);
  // Swap audio
  try {
    if (fightSong) {
      fightSong.pause();
      fightSong.currentTime = 0;
    }
    fightSong = preloadedFightSongs[s.audioKey || s.key] || createFightSongAudio(celebration.fightSong ?? s.audio);
    fightSongLoaded = false;
    fightSongPrimed = false;
    if (fightSong) {
      fightSong.currentTime = 0;
      fightSongLoaded = fightSong.readyState >= 2;
      if (!fightSongLoaded) fightSong.load();
    }
  } catch(e) {}
}

// ── Clickable hitbox planes for logo selection ──
// Larger invisible planes behind each logo for easier click detection
const positiveSchoolHitbox = new THREE.Mesh(
  new THREE.PlaneGeometry(2.0, 2.0),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
);
positiveSchoolHitbox.position.copy(positiveReveal.position);
positiveSchoolHitbox.position.y += 0.01; // slightly above to catch rays
positiveSchoolHitbox.rotation.x = -Math.PI / 2;
cakeGroup.add(positiveSchoolHitbox);

const negativeSchoolHitbox = new THREE.Mesh(
  new THREE.PlaneGeometry(2.0, 2.0),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
);
negativeSchoolHitbox.position.copy(negativeReveal.position);
negativeSchoolHitbox.position.y += 0.01;
negativeSchoolHitbox.rotation.x = -Math.PI / 2;
cakeGroup.add(negativeSchoolHitbox);

// ── Logo click handler (added to existing pointerup) ──
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!awaitingLogoClick) return;
  const dx = event.clientX - mouseDownPos.x;
  const dy = event.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 5) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const positiveSchoolHits = raycaster.intersectObjects([positiveReveal, positiveSchoolHitbox]);
  if (positiveSchoolHits.length > 0) { selectSchool(schoolConfig[revealPositiveSchool.key]); return; }

  const negativeSchoolHits = raycaster.intersectObjects([negativeReveal, negativeSchoolHitbox]);
  if (negativeSchoolHits.length > 0) { selectSchool(schoolConfig[revealNegativeSchool.key]); return; }
});

// ── Phase 2 Michigan confetti ──
const phase2Confetti = [];
const phase2ConfettiGroup = new THREE.Group();
scene.add(phase2ConfettiGroup);

function launchPhase2Confetti() {
  const c1 = activeSchool ? activeSchool.primary : defaultPrimaryColor;
  const c2 = activeSchool ? activeSchool.secondary : defaultSecondaryColor;
  const colors = [c1, c2];
  for (let i = 0; i < phase2ConfettiCount; i++) {
    const w = 0.06 + Math.random() * 0.1;
    const h = 0.04 + Math.random() * 0.08;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const spread = 14;
    mesh.position.set(
      (Math.random() - 0.5) * spread,
      10 + Math.random() * 8,
      (Math.random() - 0.5) * spread
    );
    mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    phase2ConfettiGroup.add(mesh);
    const landY = 0.12 + Math.random() * 0.08;
    phase2Confetti.push({
      mesh,
      vy: -(1.5 + Math.random() * 1.0),
      vx: (Math.random() - 0.5) * 0.15,
      vz: (Math.random() - 0.5) * 0.15,
      rotSpeed: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 1 },
      landed: false,
      landY,
      delay: Math.random() * 1.5,
      started: false,
    });
  }
}

function updatePhase2Confetti(dt) {
  for (const p of phase2Confetti) {
    if (p.landed) continue;
    if (!p.started) {
      p.delay -= dt;
      if (p.delay > 0) { p.mesh.visible = false; continue; }
      p.started = true;
      p.mesh.visible = true;
    }
    p.vy -= 2.5 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.rotation.x += p.rotSpeed.x * dt;
    p.mesh.rotation.y += p.rotSpeed.y * dt;
    p.mesh.rotation.z += p.rotSpeed.z * dt;
    if (p.mesh.position.y <= p.landY) {
      p.mesh.position.y = p.landY;
      p.landed = true;
      p.mesh.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      p.mesh.rotation.z = Math.random() * Math.PI * 2;
    }
  }
}

function clearPhase2Confetti() {
  for (const p of phase2Confetti) {
    phase2ConfettiGroup.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  }
  phase2Confetti.length = 0;
}

// ── Spotlight for Phase 2 reveal ──
const spotLight = new THREE.SpotLight(0xffffff, 0, 25, Math.PI / 5, 0.4, 0.8);
spotLight.position.set(0, 12, 0);
spotLight.target.position.set(0, 0, 0);
scene.add(spotLight);
scene.add(spotLight.target);

// Store original scene values for blackout/restore
const origBgColor = new THREE.Color(0xf5f0eb);
const origFogDensity = 0.008;
let phase2PreviewVisible = false;

function showPhase2Preview() {
  phase2PreviewVisible = true;
  tntGroup.visible = true;
  wickTube.visible = true;
}

function hidePhase2Preview() {
  phase2PreviewVisible = false;
  tntGroup.visible = false;
  wickTube.visible = false;
  wickHitbox.visible = false;
  wickGlow.visible = false;
}

// ── Phase 2 trigger: enter wickReady after Phase 1 completes ──
function enterPhase2() {
  if (phase2State !== 'idle') return;
  phase2State = 'wickReady';
  wickReadyTime = performance.now() / 1000;
  setStatusMessage('Celebration arming now. The fuse will light automatically in a moment.');

  // Show TNT and wick, then enable the interactive fuse glow.
  showPhase2Preview();
  wickHitbox.visible = true;
  wickGlow.visible = true;

  // Hide reset button during Phase 2
  document.getElementById('reset-btn').style.display = 'none';
}

// ── Phase 2 wick tap handler (added to existing pointerup) ──
function handlePhase2Click(event) {
  if (phase2State !== 'wickReady') return false;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects([wickHitbox, wickTube]);
  if (hits.length > 0) {
    startWickBurn();
    return true;
  }
  return false;
}

function startWickBurn() {
  if (phase2State !== 'wickReady') return;
  phase2State = 'wickBurning';
  wickBurnStart = performance.now() / 1000;
  wickGlow.visible = false;
  wickHitbox.visible = false;
  startWickFuseAudio();
  setStatusMessage('Fuse lit. The reveal is in progress.');
}

// ── Hide Phase 1 cake elements for explosion ──
function hidePhase1Elements() {
  // Hide the entire cake group (bottom cake, sprinkles, frosting dots, logos, etc.)
  cakeGroup.visible = false;
  // Hide platter and plate
  table.visible = false;
  ridgeOuter.visible = false;
  ridgeInner.visible = false;
  plate.visible = false;
  // Hide TNT, wick, and tray decorations
  hidePhase2Preview();
  trayDecoGroup.visible = false;

  settleGroundConfetti();
}

// ── Update Phase 2 pointerup listener ──
// Patch the existing pointerup to also handle Phase 2
const origPointerUp = renderer.domElement.onpointerup;
renderer.domElement.addEventListener('pointerup', (event) => {
  const dx = event.clientX - mouseDownPos.x;
  const dy = event.clientY - mouseDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 5) return;
  handlePhase2Click(event);
});

// ── Phase 2 animation update (called from main animate loop) ──
function updatePhase2(elapsed, dt) {
  const now = performance.now() / 1000;

  // ── wickReady: pulse glow, auto-light after 20s ──
  if (phase2State === 'wickReady') {
    const readyElapsed = now - wickReadyTime;
    // Pulse the glow
    wickGlow.material.opacity = 0.4 + Math.sin(elapsed * 4) * 0.3;
    wickGlow.scale.setScalar(1.0 + Math.sin(elapsed * 3) * 0.2);

    // After 10s, pulse more intensely
    if (readyElapsed > 10) {
      wickGlow.material.opacity = 0.5 + Math.sin(elapsed * 8) * 0.4;
    }
    // Auto-light after 20s
    if (readyElapsed > 20) {
      startWickBurn();
    }
    return;
  }

  // ── wickBurning: burn shader + sparks ──
  if (phase2State === 'wickBurning') {
    const wickT = Math.min((now - wickBurnStart) / wickBurnDuration, 1.0);
    wickBurnUniforms.uBurnProgress.value = wickT;
    wickBurnUniforms.uTime.value = elapsed;

    // Spawn sparks at burn front
    const burnPt = wickCurve.getPointAt(Math.min(wickT, 0.99));
    if (Math.random() < 0.4) spawnSpark(burnPt);
    updateSparks(dt);

    // Wick fully burned → slow-mo
    if (wickT >= 1.0) {
      stopWickFuseAudio();
      phase2State = 'slowMo';
      slowMoStart = now;
      clearSparks();
    }
    return;
  }

  // ── slowMo: 0.8 second tension beat ──
  if (phase2State === 'slowMo') {
    const slowT = (now - slowMoStart) / 0.8;
    // TNT pulses red/orange
    const pulse = Math.sin(elapsed * 20) * 0.5 + 0.5;
    tntMat.emissive.setRGB(pulse * 0.8, pulse * 0.1, 0);

    // Intensify sparks at TNT
    if (Math.random() < 0.6) spawnSpark(tntGroup.position.clone().setY(0.5));
    updateSparks(dt);

    if (slowT >= 1.0) {
      // BOOM
      phase2State = 'exploding';
      explosionStart = now;
      tntMat.emissive.setRGB(0, 0, 0);
      clearSparks();
      stopWickFuseAudio();

      // White flash
      const flash = document.getElementById('white-flash');
      flash.style.display = 'block';
      flash.style.opacity = '1';

      // Screen shake
      shakeAmplitude = maxShakeAmplitude;
      shakeDecay = 5.0;
      shakeTime = 0;

      // Hide Phase 1 cake elements
      hidePhase1Elements();

      // Spawn explosion particles
      triggerExplosion();

      // Explosion boom sound
      playExplosionBoom();

    }
    return;
  }

  // ── exploding: flash fades, particles fly, then blackout ──
  if (phase2State === 'exploding') {
    const expT = now - explosionStart;

    // Fade white flash
    const flash = document.getElementById('white-flash');
    flash.style.opacity = String(Math.max(0, 1.0 - expT / 0.3));
    if (expT > 0.3) flash.style.display = 'none';

    // Screen shake
    shakeTime += dt;
    shakeAmplitude = maxShakeAmplitude * Math.exp(-shakeDecay * shakeTime);

    updateExplosionParticles(dt);
    // Update re-launched Phase 1 confetti
    if (confetti3D.length > 0) updateConfetti3D(Math.min(dt, 0.05), elapsed);

    // After 1.2s, transition to blackout
    if (expT > 1.2) {
      phase2State = 'blackout';
      blackoutStart = now;
      clearExplosionParticles();
    }
    return;
  }

  // ── blackout: fade to dark, then spotlight + monument rise ──
  if (phase2State === 'blackout') {
    const bT = now - blackoutStart;

    // Dim lights for dramatic effect (background stays the same)
    if (bT < 0.3) {
      const fade = bT / 0.3;
      ambientLight.intensity = 0.4 * (1 - fade * 0.6);
      dirLight.intensity = 1.0 * (1 - fade * 0.7);
      fillLight.intensity = 0.3 * (1 - fade * 0.7);
    }

    // 0.5s of darkness, then start reveal
    if (bT > 0.8) {
      phase2State = 'revealing';
      revealStart = now;

      monumentGroup.visible = true;

      // Start spotlight
      spotLight.intensity = 0;

      // Save camera start position for smooth transition to eye-level
      cameraStartPos = camera.position.clone();
      cameraStartTarget = controls.target.clone();

      startFightSongPlayback();
    }
    return;
  }

  // ── revealing: monument rises, spotlight fades in ──
  if (phase2State === 'revealing') {
    const rT = now - revealStart;

    // Spotlight fades in (bright for dramatic reveal)
    spotLight.intensity = Math.min(20, rT * 20);

    // Bring lights back up so everything is clearly visible
    const lightT = Math.min(1, rT / 1.5);
    ambientLight.intensity = 0.16 + lightT * 0.44; // ramp back to 0.6
    dirLight.intensity = 0.3 + lightT * 0.5;
    fillLight.intensity = 0.09 + lightT * 0.31;
    // Keep fog consistent
    scene.fog.density = origFogDensity;

    // Monument rises from y=-3 to y=0 over 1.2 seconds
    const riseT = Math.min(1, rT / 1.2);
    const eased = 1 - Math.pow(1 - riseT, 3); // ease-out cubic
    const riseTargetY = getActiveCenterpieceRiseTargetY();
    monumentGroup.position.y = THREE.MathUtils.lerp(CENTERPIECE_START_Y, riseTargetY, eased);

    // Smooth camera transition to eye-level view (flat horizon)
    const camT = Math.min(1, rT / 2.0);
    const camEased = 1 - Math.pow(1 - camT, 3);
    if (cameraStartPos) {
      const targetCamPos = new THREE.Vector3(0, 3, 10);
      const targetLookAt = new THREE.Vector3(0, getActiveCenterpieceLookAtY(), 0);
      camera.position.lerpVectors(cameraStartPos, targetCamPos, camEased);
      controls.target.lerpVectors(cameraStartTarget, targetLookAt, camEased);
      controls.update();
    }

    // After 1.5s, transition to celebrating
    if (rT > 2.0) {
      phase2State = 'celebrating';
      phase2StartTime = now;

      // Spawn balloons
      spawnBalloons();

      // Launch school-colored confetti
      launchPhase2Confetti();

      // Show congratulations text
      const congrats = document.getElementById('congrats-overlay');
      congrats.style.display = 'block';
      syncCongratsOverlayLayout();
      setTimeout(() => { congrats.style.transform = 'scale(1)'; }, reducedMotion ? 0 : 50);
      setStatusMessage('Celebration complete. Use Reset to play it again.');

      // Show reset button
      setTimeout(() => { document.getElementById('reset-btn').style.display = 'block'; }, 2000);
    }
    return;
  }

  // ── celebrating: balloons float, confetti falls ──
  if (phase2State === 'celebrating') {
    updateBalloons(dt, elapsed);
    updatePhase2Confetti(dt);

    updateActiveCelebrationCenterpiece(dt);

    return;
  }
}

// ── Phase 2 Reset ──
function resetPhase2() {
  phase2State = 'idle';

  // Reset Phase 2 elements (TNT stays visible)
  showPhase2Preview();
  wickHitbox.visible = true;
  wickGlow.visible = true;
  wickBurnUniforms.uBurnProgress.value = 0;

  clearSparks();
  clearExplosionParticles();
  clearBalloons();
  clearPhase2Confetti();
  stopWickFuseAudio();

  monumentGroup.visible = false;
  monumentGroup.position.y = CENTERPIECE_START_Y;
  resetCelebrationCenterpieces();


  shakeAmplitude = 0;
  spotLight.intensity = 0;

  // Restore scene
  scene.background.copy(origBgColor);
  scene.fog.density = origFogDensity;
  ambientLight.intensity = 0.4;
  dirLight.intensity = 1.0;
  fillLight.intensity = 0.3;

  // Restore Phase 1 elements
  bottomCake.visible = true;
  bottomRim.visible = true;
  revealLayer.visible = true;
  ribbon.visible = true;
  ribbonEdgeTop.visible = true;
  ribbonEdgeBottom.visible = true;
  trayDecoGroup.visible = true;

  // Hide overlays
  document.getElementById('white-flash').style.display = 'none';
  document.getElementById('congrats-overlay').style.display = 'none';
  document.getElementById('congrats-overlay').style.transform = 'scale(0)';

  // Stop fight song
  if (fightSong) {
    fightSong.pause();
    fightSong.currentTime = 0;
  }
  document.getElementById('audio-toggle').style.display = 'none';
}

// ===== END PHASE 2 =====

// ── Animation loop ──
const clock = new THREE.Clock();
let lastFrameTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  controls.update();

  // Flame animation (flicker only — scale/intensity handled by burn logic when burning)
  if (flameGroup.visible) {
    const flicker = Math.sin(elapsed * 15) * 0.03 + Math.sin(elapsed * 23) * 0.02;
    flameGroup.position.x = flicker;
    flameGroup.position.z = Math.sin(elapsed * 17) * 0.02;

    if (!isBurning) {
      flameGroup.scale.set(
        1 + Math.sin(elapsed * 12) * 0.1,
        1 + Math.sin(elapsed * 8) * 0.08,
        1 + Math.sin(elapsed * 10) * 0.1
      );
      flameLight.intensity = 2.0 + Math.sin(elapsed * 15) * 0.5;
    }
  }

  // Burn animation
  if (isBurning) {
    const now = performance.now() / 1000;
    const t = Math.min((now - burnStartTime) / burnDuration, 1.0);

    burnUniforms.burnProgress.value = t;
    burnUniforms.time.value = elapsed;

    // Logos burn via their own shaders (synced with burnUniforms), no JS fade needed
    const burnEdge = t * 1.2;

    // Top surface burns via its own shader (synced with burnUniforms)
    if (t > 0.85) {
      topSurface.visible = false;
    }

    // Burn frosting rim when edge reaches it (rim is at radius 2.7, normalized = 2.7/2.8 = 0.964)
    if (burnEdge > 0.9) {
      const rimFade = 1.0 - Math.max(0, Math.min(1, (burnEdge - 0.9) / 0.15));
      topRim.material.opacity = rimFade;
      topRim.material.transparent = true;
      if (rimFade <= 0) topRim.visible = false;
    }

    // Burn frosting dots based on position (dots are at radius 2.7)
    topDots.forEach(dot => {
      const dotDist = Math.sqrt(dot.position.x * dot.position.x + dot.position.z * dot.position.z) / 2.8;
      if (burnEdge > dotDist - 0.05) {
        const dotFade = 1.0 - Math.max(0, Math.min(1, (burnEdge - dotDist + 0.05) / 0.1));
        dot.material.opacity = dotFade;
        dot.material.transparent = true;
        if (dotFade <= 0) dot.visible = false;
      }
    });

    // Fire audio volume: ramp up, intensify during cake burn, fade at end
    if (t < 0.1) {
      setFireVolume(t * 3); // ramp in over first 10%
    } else if (t < 0.7) {
      setFireVolume(0.3 + t * 0.4); // candle + cake burning
    } else if (t < 0.95) {
      setFireVolume(0.6 * (1 - (t - 0.7) / 0.25)); // fade as cake disintegrates
    } else {
      setFireVolume(0);
      stopFireAudio();
    }

    // Candle burns down progressively — shrinks and melts as burn progresses
    if (t < 0.7) {
      const candleScale = 1.0 - t * 1.2; // shrinks to ~0.16 by t=0.7
      const clampedScale = Math.max(0.05, candleScale);
      candle.scale.y = clampedScale;
      candle.position.y = 0.5 * clampedScale; // keep base grounded
      wick.position.y = 1.0 * clampedScale + 0.075;
      flameGroup.position.y = 1.0 * clampedScale + 0.15;

      // Flame shrinks and fades out toward the end
      const flameFade = Math.max(0, (0.7 - t) / 0.3); // fades over last 30% of candle life
      const flameScale = 0.3 + 0.7 * flameFade;
      flameGroup.scale.set(
        flameScale * (1 + Math.sin(elapsed * 12) * 0.1),
        flameScale * (1 + Math.sin(elapsed * 8) * 0.08),
        flameScale * (1 + Math.sin(elapsed * 10) * 0.1)
      );
      outerFlameMat.opacity = 0.5 * flameFade;
      innerFlameMat.opacity = 0.6 * flameFade;
      flameLight.intensity = (2.0 + Math.sin(elapsed * 15) * 0.5) * flameFade;

      // Update flame light position to follow
      flameLight.position.y = candleGroup.position.y + flameGroup.position.y;
    } else {
      candleGroup.visible = false;
      flameGroup.visible = false;
      flameLight.intensity = 0;
    }
    // Hide remaining non-shader elements once walls are fully burned through
    if (t > 0.95) {
      topCake.visible = false;  // shader has discarded all fragments by now
      topSurface.visible = false;
      topRim.visible = false;
      topDots.forEach(dot => { dot.visible = false; });
      logoMeshes.forEach(mesh => { mesh.visible = false; });

      if (phase2State === 'idle' && !phase2PreviewVisible) {
        showPhase2Preview();
      }
    }

    // Progressive blur-to-focus reveal — starts blurry early, sharpens as burn progresses
    if (t > 0.25) {
      // Map t from [0.25, 0.85] → blur [1.0, 0.0] and opacity [0.3, 1.0]
      const revealT = Math.min(1.0, (t - 0.25) / 0.6);
      const blur = 1.0 - revealT;
      const opacity = 0.3 + revealT * 0.7;
      revealLogoMeshes.forEach(m => {
        m.material.uniforms.blurAmount.value = blur;
        m.material.uniforms.opacity.value = opacity;
      });

      // Launch confetti once fully sharp
      if (revealT >= 0.95 && !confettiTriggered) {
        confettiTriggered = true;
        launchConfetti();
      }
    }
  }

  // Update 3D confetti
  const dt = elapsed - lastFrameTime;
  lastFrameTime = elapsed;
  if (confetti3D.length > 0) {
    updateConfetti3D(Math.min(dt, 0.05), elapsed);
  }

  // ── Phase 2 update ──
  if (phase2State !== 'idle') {
    updatePhase2(elapsed, Math.min(dt, 0.05));
  }

  // ── Screen shake ──
  if (shakeAmplitude > 0.001) {
    camera.position.x += Math.sin(elapsed * 50) * shakeAmplitude;
    camera.position.y += Math.cos(elapsed * 40) * shakeAmplitude * 0.5;
  }

  renderer.render(scene, camera);
}

animate();

// ── Resize ──
window.addEventListener('resize', () => {
  const nextViewportFit = buildViewportCameraFit();
  const shouldRefitCamera = phase2State === 'idle' && cameraIsNearViewportFit(lastViewportCameraFit);

  camera.aspect = getViewportAspect();
  renderer.setSize(window.innerWidth, window.innerHeight);

  if (shouldRefitCamera) {
    applyViewportCameraFit(nextViewportFit);
  } else {
    camera.fov = nextViewportFit.fov;
    camera.updateProjectionMatrix();
  }

  lastViewportCameraFit = cloneViewportCameraFit(nextViewportFit);
});
