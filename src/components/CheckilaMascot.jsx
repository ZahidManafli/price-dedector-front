// CheckilaMascot — admin-only 3D mascot + natural-language operational
// assistant. Wanders around the viewport on its own, and opens a chat panel
// on click that talks to POST /mascot/chat (services/mascotAgentService.js on
// the backend), which turns plain-language admin requests into real calls
// against the app's own REST API (price updates, Checkila Smart listing,
// etc.) and reports back what it did.
//
// The 3D model is built from plain Three.js primitives (no GLTF asset, no
// @react-three/fiber) — a stylized approximation of the mascot artwork, not a
// photoreal render. Requires the `three` package (not installed by this
// change — run `npm install three` before this renders).
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { Send, X, Loader2, Sparkles, Pin, PinOff, Trash2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { mascotAPI } from '../services/api';

const WIDGET_SIZE = 150;
const MARGIN = 16;
const PIN_STORAGE_KEY = 'checkila.mascot.pinned';

const DEFAULT_GREETING_MESSAGE = {
  role: 'assistant',
  content:
    'Salam! Mən Checkila-yam 👋 Sizə Products üzərində real əməliyyatları sözlə etməkdə kömək edə bilərəm:\n\n' +
    '• Məhsul axtarmaq (ASIN / eBay ID / ad ilə)\n' +
    '• Amazon və ya eBay qiymətini dəyişmək\n' +
    '• Marja (margin) rejimi təyin etmək\n' +
    '• Reklam faizini (ad rate) dəyişmək\n' +
    '• Yoxlama tənzimləmələrini aç/bağlamaq\n' +
    '• Yeni məhsul izləməyə qoşmaq\n' +
    '• ASIN-i Checkila Smart ilə birbaşa eBay-ə canlı list etmək\n\n' +
    'Məsələn: "B0C7BKZ883 ASIN-li məhsulun Amazon qiymətini 19.99 et" yaza bilərsiniz. Nə köməklik edim?',
};

// ---------------------------------------------------------------------------
// 3D model — a small chibi-proportioned figure (big head, small body) rigged
// with shoulder-pivot arms so it can wave/dance, auto-framed by the camera
// (see fitCameraToObject) so proportions here never have to be hand-tuned
// against a fixed camera distance again.
// ---------------------------------------------------------------------------

const GRADIENT_VERTEX_SHADER = `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GRADIENT_FRAGMENT_SHADER = `
  uniform vec3 colorTop;
  uniform vec3 colorBottom;
  uniform float minY;
  uniform float maxY;
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    float t = clamp((vPos.y - minY) / max(0.0001, (maxY - minY)), 0.0, 1.0);
    vec3 base = mix(colorBottom, colorTop, t);
    float lightAmt = clamp(dot(normalize(vNormal), normalize(vec3(0.45, 0.65, 1.0))) * 0.5 + 0.5, 0.0, 1.0);
    vec3 shaded = base * (0.4 + 0.75 * lightAmt);
    gl_FragColor = vec4(shaded, 1.0);
  }
`;

function gradientMaterial(colorTop, colorBottom, minY, maxY) {
  return new THREE.ShaderMaterial({
    uniforms: {
      colorTop: { value: new THREE.Color(colorTop) },
      colorBottom: { value: new THREE.Color(colorBottom) },
      minY: { value: minY },
      maxY: { value: maxY },
    },
    vertexShader: GRADIENT_VERTEX_SHADER,
    fragmentShader: GRADIENT_FRAGMENT_SHADER,
  });
}

// Builds one shoulder-pivoted arm: a Group placed AT the shoulder joint, with
// the upper-arm/forearm capsule and the hand both hanging below the pivot
// (local space) — so rotating the pivot swings the whole arm+hand naturally,
// the same way a real shoulder joint would, instead of each piece having to
// be re-positioned by hand for every pose.
function buildArm(side, armColor, handColor) {
  const pivot = new THREE.Group();
  const upperArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.1, 0.42, 6, 12),
    new THREE.MeshStandardMaterial({ color: armColor, roughness: 0.55 })
  );
  upperArm.position.y = -0.32;
  pivot.add(upperArm);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 16), new THREE.MeshStandardMaterial({ color: handColor, roughness: 0.5 }));
  hand.position.y = -0.62;
  pivot.add(hand);

  pivot.userData.restRotationZ = side * 0.22;
  pivot.rotation.z = pivot.userData.restRotationZ;
  return pivot;
}

// Same shoulder-pivot idea, at the hip — lets a leg swing forward/back (and,
// for the frontal camera here, kick out to the side) from a fixed joint
// instead of the whole leg mesh having to be re-positioned for each pose.
function buildLeg(legColor, shoeColor) {
  const pivot = new THREE.Group();
  const upperLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, 0.3, 6, 12),
    new THREE.MeshStandardMaterial({ color: legColor, roughness: 0.6 })
  );
  upperLeg.position.y = -0.24;
  pivot.add(upperLeg);

  const shoe = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, 0.2, 6, 12),
    new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.5 })
  );
  shoe.rotation.z = Math.PI / 2;
  shoe.position.set(0, -0.5, 0.08);
  pivot.add(shoe);

  return pivot;
}

function buildMascot() {
  const root = new THREE.Group();

  // --- Head -----------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.25;
  root.add(headGroup);

  const hoodMat = gradientMaterial('#3fc6ec', '#2fd17e', -1.05, 1.0);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1.0, 48, 48), hoodMat);
  hood.scale.set(1, 1.05, 0.78);
  headGroup.add(hood);

  // Dark face screen, pushed clearly in front of the hood's own front
  // surface so it's never occluded by it.
  const faceMat = new THREE.MeshStandardMaterial({ color: '#0b0b10', roughness: 0.2, metalness: 0.4 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 32), faceMat);
  face.scale.set(1, 1.08, 0.42);
  face.position.set(0, 0.02, 0.82);
  headGroup.add(face);

  const rimMat = new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.4, metalness: 0.1 });
  const faceRim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.03, 16, 48), rimMat);
  faceRim.scale.set(1, 1.08, 1);
  faceRim.position.set(0, 0.02, 0.82);
  headGroup.add(faceRim);

  // One matching pair of eyes (not one eye + a "wink" brow, which read as a
  // missing eye at small widget sizes) — both wrapped in eyeGroup so the
  // blink animation (see MascotScene) scales them together as one unit.
  const buildEyeball = () => {
    const eye = new THREE.Group();
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 24, 24),
      new THREE.MeshStandardMaterial({ color: '#1f8dff', emissive: '#1f8dff', emissiveIntensity: 1.0, roughness: 0.25 })
    );
    eye.add(ball);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), new THREE.MeshStandardMaterial({ color: '#05101c' }));
    pupil.position.z = 0.1;
    eye.add(pupil);
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    highlight.position.set(0.05, 0.055, 0.14);
    eye.add(highlight);
    return eye;
  };

  const eyeGroup = new THREE.Group();
  const leftEye = buildEyeball();
  leftEye.position.set(-0.27, 0.08, 1.1);
  eyeGroup.add(leftEye);
  const rightEye = buildEyeball();
  rightEye.position.set(0.27, 0.08, 1.1);
  eyeGroup.add(rightEye);
  headGroup.add(eyeGroup);

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.018, 8, 24, Math.PI * 0.75),
    new THREE.MeshStandardMaterial({ color: '#ff5a7a' })
  );
  smile.position.set(0.03, -0.18, 1.08);
  smile.rotation.z = Math.PI * 1.12;
  headGroup.add(smile);

  const leaf1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#2fb6e0', roughness: 0.4 })
  );
  leaf1.scale.set(0.32, 1, 0.45);
  leaf1.position.set(-0.1, 1.0, -0.05);
  leaf1.rotation.z = -0.35;
  headGroup.add(leaf1);

  const leaf2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#39d17d', roughness: 0.4 })
  );
  leaf2.scale.set(0.28, 0.85, 0.4);
  leaf2.position.set(0.14, 0.92, -0.05);
  leaf2.rotation.z = 0.5;
  headGroup.add(leaf2);

  // --- Torso ------------------------------------------------------------
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.1;
  root.add(torsoGroup);

  const bodyMat = gradientMaterial('#3fc6ec', '#2fd17e', -0.55, 0.4);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.4, 8, 24), bodyMat);
  torsoGroup.add(body);

  const beltMat = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.6 });
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 24), beltMat);
  belt.position.y = -0.55;
  torsoGroup.add(belt);

  // --- Legs + feet (hip-pivoted, see buildLeg) ---------------------------
  const legsGroup = new THREE.Group();
  legsGroup.position.y = -0.85;
  root.add(legsGroup);

  const leftLeg = buildLeg('#15161a', '#2fb6e0');
  leftLeg.position.set(-0.22, 0.1, 0);
  legsGroup.add(leftLeg);

  const rightLeg = buildLeg('#15161a', '#39d17d');
  rightLeg.position.set(0.22, 0.1, 0);
  legsGroup.add(rightLeg);

  // --- Arms (shoulder-pivoted, see buildArm) -----------------------------
  const leftArm = buildArm(-1, '#101114', '#f3f6fb');
  leftArm.position.set(-0.56, 0.42, 0.02);
  torsoGroup.add(leftArm);

  const rightArm = buildArm(1, '#101114', '#f3f6fb');
  rightArm.position.set(0.56, 0.42, 0.02);
  torsoGroup.add(rightArm);

  return { root, headGroup, torsoGroup, legsGroup, leftLeg, rightLeg, eyeGroup, leftArm, rightArm };
}

function fitCameraToObject(camera, object, paddingFactor = 1.45) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const fovRad = (camera.fov * Math.PI) / 180;
  const fitHeightDistance = size.y / 2 / Math.tan(fovRad / 2);
  const fitWidthDistance = size.x / 2 / Math.tan(fovRad / 2) / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * paddingFactor;

  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  return center;
}

// Three "moods" the idle loop cycles through at random while the mascot is
// stationary — mostly idle, with occasional waves/dances so it feels alive
// without being distracting. A fourth pose, applyRunPose, takes over
// whenever the wander loop (CheckilaMascot component) reports it's actually
// traveling between two points, instead of these three. Each entry returns
// nothing; they mutate the rig in place.
function applyIdlePose(rig, t) {
  rig.root.scale.x = 1;
  rig.root.rotation.x = 0;
  rig.headGroup.rotation.y = Math.sin(t * 0.6) * 0.18;
  rig.headGroup.rotation.z = Math.sin(t * 0.8) * 0.03;
  rig.headGroup.rotation.x = 0;
  rig.leftArm.rotation.z = rig.leftArm.userData.restRotationZ + Math.sin(t * 1.4) * 0.05;
  rig.rightArm.rotation.z = rig.rightArm.userData.restRotationZ + Math.sin(t * 1.4 + Math.PI) * 0.05;
  rig.leftArm.rotation.x = 0;
  rig.rightArm.rotation.x = 0;
  rig.root.rotation.z = 0;
  rig.legsGroup.rotation.z = 0;
  rig.leftLeg.rotation.z = 0;
  rig.rightLeg.rotation.z = 0;
}

function applyWavePose(rig, t, progress) {
  applyIdlePose(rig, t);
  // Raise the right arm up (toward the viewer) and wiggle it side to side.
  const raise = Math.min(1, progress * 4);
  rig.rightArm.rotation.z = rig.rightArm.userData.restRotationZ + raise * 2.3;
  rig.rightArm.rotation.x = Math.sin(t * 9) * 0.35 * raise;
  rig.headGroup.rotation.y = Math.sin(t * 2) * 0.08;
}

function applyDancePose(rig, t) {
  rig.root.position.y += Math.abs(Math.sin(t * 6)) * 0.12;
  rig.root.rotation.z = Math.sin(t * 6) * 0.1;
  rig.headGroup.rotation.z = Math.sin(t * 6 + 0.3) * 0.12;
  rig.leftArm.rotation.z = rig.leftArm.userData.restRotationZ + Math.sin(t * 6) * 1.1;
  rig.rightArm.rotation.z = rig.rightArm.userData.restRotationZ + Math.sin(t * 6 + Math.PI) * 1.1;
  rig.legsGroup.rotation.z = Math.sin(t * 6) * 0.12;
  rig.leftLeg.rotation.z = Math.sin(t * 6) * 0.3;
  rig.rightLeg.rotation.z = Math.sin(t * 6 + Math.PI) * 0.3;
}

// Running + hopping combined, used while the mascot is actually traveling
// across the screen (see the wander loop's motionRef in CheckilaMascot).
// Legs/arms swing opposite each other and the whole body hops — tuned for a
// camera that's always front-on, so the swing mostly reads as side-to-side
// kicks rather than a true forward/back running stride.
function applyRunPose(rig, t) {
  const speed = 10;
  const swing = Math.sin(t * speed);
  rig.root.scale.x = 1;
  // Assignment, NOT +=: this runs every frame for as long as the mascot is
  // traveling, so accumulating onto the previous value here would make it
  // drift upward without bound (and right out of the camera's view) the
  // longer a single run lasts, only "coming back" once it arrives and the
  // idle/dance poses (which also assign, not accumulate) reset it.
  rig.root.position.y = Math.abs(Math.sin(t * speed)) * 0.2;
  rig.root.rotation.z = swing * 0.07;
  rig.headGroup.rotation.x = 0.1;
  rig.headGroup.rotation.y = swing * 0.1;
  rig.headGroup.rotation.z = 0;
  rig.leftLeg.rotation.z = swing * 0.65;
  rig.rightLeg.rotation.z = -swing * 0.65;
  rig.legsGroup.rotation.z = 0;
  rig.leftArm.rotation.z = rig.leftArm.userData.restRotationZ - swing * 0.9;
  rig.rightArm.rotation.z = rig.rightArm.userData.restRotationZ + swing * 0.9;
  rig.leftArm.rotation.x = 0;
  rig.rightArm.rotation.x = 0;
}

// Played after arriving at a randomly-picked product row (see the "visit"
// state machine in CheckilaMascot) — an exaggerated alternating reach-and-pull
// motion, like scaling a wall, instead of the run/idle poses.
function applyClimbPose(rig, t) {
  const speed = 7;
  const phase = Math.sin(t * speed);
  rig.root.scale.x = 1;
  rig.root.rotation.z = 0;
  rig.root.position.y = Math.abs(Math.sin(t * speed * 0.6)) * 0.08;
  rig.headGroup.rotation.x = -0.12;
  rig.headGroup.rotation.y = 0;
  rig.headGroup.rotation.z = 0;
  rig.leftArm.rotation.x = -1.1 + phase * 0.35;
  rig.rightArm.rotation.x = -1.1 - phase * 0.35;
  rig.leftArm.rotation.z = rig.leftArm.userData.restRotationZ;
  rig.rightArm.rotation.z = rig.rightArm.userData.restRotationZ;
  rig.leftLeg.rotation.z = phase * 0.5;
  rig.rightLeg.rotation.z = -phase * 0.5;
  rig.legsGroup.rotation.z = 0;
}

// motionRef is a plain ref object ({ isMoving, direction }) the wander loop
// in CheckilaMascot mutates every frame — read directly here instead of via
// React state/props so the Three.js render loop (its own rAF, independent of
// React's render cycle) never needs to restart to pick up a new value.
function MascotScene({ containerRef, motionRef }) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const width = WIDGET_SIZE;
    const height = WIDGET_SIZE;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 20);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rimLight = new THREE.DirectionalLight(0x8ab4ff, 0.85);
    rimLight.position.set(-3, 1.5, -2);
    scene.add(rimLight);
    const fillLight = new THREE.DirectionalLight(0xbfffe0, 0.35);
    fillLight.position.set(0, -2, 3);
    scene.add(fillLight);

    const rig = buildMascot();
    scene.add(rig.root);
    fitCameraToObject(camera, rig.root, 1.14);

    let frameId;
    let nextBlinkAt = performance.now() + 1500 + Math.random() * 2500;
    let blinkUntil = 0;
    const start = performance.now();

    // Mood state machine for when the mascot is STATIONARY: idle most of the
    // time, occasionally wave or dance. While motionRef reports it's
    // traveling, applyRunPose takes over instead and this cycle is paused
    // (and reset, so arriving somewhere never resumes a stale countdown).
    let mood = 'idle';
    let moodUntil = performance.now() + 4000 + Math.random() * 4000;
    let moodStart = performance.now();
    let wasMoving = false;
    // Smoothly turned to face the direction of travel while running, and
    // smoothly turned back to face the viewer once stopped — interpolated
    // here (not snapped) so the turn itself reads as a deliberate "turning to
    // run that way" motion instead of an instant flip.
    let facingY = 0;

    const pickNextMood = (now) => {
      const roll = Math.random();
      if (roll < 0.4) {
        mood = 'wave';
        moodUntil = now + 1800;
      } else if (roll < 0.7) {
        mood = 'dance';
        moodUntil = now + 2600 + Math.random() * 1400;
      } else {
        mood = 'idle';
        moodUntil = now + 5000 + Math.random() * 5000;
      }
      moodStart = now;
    };

    const animate = () => {
      const now = performance.now();
      const t = (now - start) / 1000;
      const isMoving = !!motionRef?.current?.isMoving;
      const climbing = !!motionRef?.current?.climbing;
      const direction = motionRef?.current?.direction || 1;
      // direction > 0 means moving toward +X (screen right): rotating root.y
      // POSITIVE swings its front (local +Z, facing the camera at rest)
      // toward world +X, i.e. turns it to face screen-right — so this must
      // match direction's own sign, not oppose it (that was the bug: it was
      // inverted, so it turned to face away from where it was actually going).
      const targetFacingY = isMoving ? (direction < 0 ? -0.85 : 0.85) : 0;
      facingY += (targetFacingY - facingY) * 0.08;
      rig.root.rotation.y = facingY;

      if (climbing) {
        applyClimbPose(rig, t);
      } else if (isMoving) {
        applyRunPose(rig, t);
      } else {
        if (wasMoving) {
          // Just arrived somewhere — start a fresh, short idle window
          // instead of resuming whatever mood countdown was running before
          // it started moving.
          mood = 'idle';
          moodStart = now;
          moodUntil = now + 1200 + Math.random() * 2000;
        }
        if (now >= moodUntil) pickNextMood(now);
        const progress = (now - moodStart) / 1000;

        rig.root.position.y = Math.sin(t * 1.8) * 0.06;

        if (mood === 'wave') applyWavePose(rig, t, progress);
        else if (mood === 'dance') applyDancePose(rig, t);
        else applyIdlePose(rig, t);
      }
      wasMoving = isMoving;

      if (now >= nextBlinkAt && now >= blinkUntil) {
        blinkUntil = now + 140;
        nextBlinkAt = now + 2200 + Math.random() * 3000;
      }
      rig.eyeGroup.scale.y = now < blinkUntil ? 0.12 : 1;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [containerRef, motionRef]);

  return null;
}

// ---------------------------------------------------------------------------
// Chat panel
// ---------------------------------------------------------------------------

function ChatPanel({ messages, setMessages, onClose, onReset, anchor, isDark }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    // Shown immediately for responsiveness; the backend independently saves
    // this same text (and its own reply) to that admin's DB-stored history —
    // see mascotAPI.startChat/services/mascotAgentService.js.
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setError(null);
    setSending(true);
    try {
      // A mascot reply can involve a slow real action (product creation,
      // Checkila Smart listing) that takes well over a minute — /mascot/chat
      // only kicks the job off and returns a jobId right away, so this polls
      // GET /mascot/chat/:jobId until it's done instead of holding one long
      // connection open (which a reverse proxy in front of the server can
      // cut before the real reply ever arrives).
      const startRes = await mascotAPI.startChat(text);
      const jobId = startRes?.data?.jobId;
      if (!jobId) throw new Error('Cavab gözlənilmədi (jobId yoxdur)');

      const deadline = Date.now() + 180000;
      let result = null;
      for (;;) {
        const statusRes = await mascotAPI.getChatStatus(jobId);
        const data = statusRes?.data || {};
        if (data.status !== 'processing') {
          result = data;
          break;
        }
        if (Date.now() >= deadline) {
          result = { status: 'error', error: 'Cavab gözləmə vaxtı bitdi' };
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (result.status === 'error') throw new Error(result.error || 'Checkila köməkçisi uğursuz oldu');
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply || 'Bağışlayın, cavab ala bilmədim.' }]);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Xəta baş verdi');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Anchor the panel above/left of the mascot, clamped to the viewport.
  const panelWidth = 370;
  const panelHeight = 480;
  const left = Math.min(Math.max(8, anchor.x - panelWidth + WIDGET_SIZE), window.innerWidth - panelWidth - 8);
  const top = Math.min(Math.max(8, anchor.y - panelHeight - 12), window.innerHeight - panelHeight - 8);

  return createPortal(
    <div
      style={{ position: 'fixed', left, top, width: panelWidth, height: panelHeight, zIndex: 2147483000 }}
      className={`flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-blue-500" />
          <span className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Checkila Köməkçi</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            title="Söhbəti təmizlə"
            className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <Trash2 size={15} />
          </button>
          <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : isDark
                  ? 'bg-slate-800 text-slate-100 rounded-bl-sm'
                  : 'bg-slate-100 text-slate-800 rounded-bl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className={`rounded-2xl rounded-bl-sm px-3 py-2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <Loader2 size={14} className={`animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className={`flex items-end gap-2 p-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={2}
          placeholder="Məsələn: B0C7BKZ883 ASIN-li məhsulun Amazon qiymətini 19.99 et"
          className={`flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed min-h-[52px] max-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition shrink-0"
        >
          <Send size={17} />
        </button>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// "Visit a random product row" flourish — only on the Products page, only
// while not pinned. The mascot runs over to a random row in the table (or
// grid card — see the data-mascot-product-* attributes in ProductsPage.jsx),
// plays a short climb animation, then shows a speech bubble with a flavor
// line (see backend GET /mascot/flavor-lines) filled in with that product's
// real name/profit.
// ---------------------------------------------------------------------------

const DEFAULT_FLAVOR_LINES = [
  'Uf, bura qədər dırmaşmaq çox vaxt apardı! 😅',
  'Nəfəsim kəsildi, bir azca dincəlim burda.',
  '{productName}-a qədər gəldim, möhkəm imiş bu!',
  'Bilirsinizmi, {productName} satmaqla {profit}$ qazanırsınız? 💰',
  'Yorulmayasınız, işləriniz qaydasındadır 💪',
];

function fillFlavorLine(template, { productName, profit }) {
  const profitText = Number.isFinite(Number(profit)) ? Number(profit).toFixed(2) : '—';
  return String(template || '')
    .replaceAll('{productName}', productName || 'bu məhsul')
    .replaceAll('{profit}', profitText);
}

function pickRandomProductElement() {
  const nodes = Array.from(document.querySelectorAll('[data-mascot-product-id]'));
  const visible = nodes.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top > 40 && rect.top < window.innerHeight - 60;
  });
  if (!visible.length) return null;
  return visible[Math.floor(Math.random() * visible.length)];
}

function SpeechBubble({ text, anchor, isDark }) {
  if (!text) return null;
  const width = 230;
  const left = Math.min(Math.max(8, anchor.x + WIDGET_SIZE / 2 - width / 2), window.innerWidth - width - 8);
  const top = Math.max(8, anchor.y - 98);

  return createPortal(
    <div style={{ position: 'fixed', left, top, width, zIndex: 2147482950 }} className="pointer-events-none">
      <div
        className={`relative rounded-2xl border px-3.5 py-2.5 text-xs leading-snug shadow-xl ${
          isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {text}
        <div
          className={`absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
        />
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Wandering widget
// ---------------------------------------------------------------------------

function getCornerPosition() {
  return {
    x: window.innerWidth - WIDGET_SIZE - MARGIN,
    y: window.innerHeight - WIDGET_SIZE - MARGIN,
  };
}

export default function CheckilaMascot() {
  const { isDark } = useTheme();
  const location = useLocation();
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const posRef = useRef(getCornerPosition());
  const targetRef = useRef({ ...posRef.current });
  const nextTargetAtRef = useRef(0);
  // Mutated directly by the wander loop below and read directly by
  // MascotScene's own render loop — see that component's comment on why this
  // is a plain ref instead of React state.
  const motionRef = useRef({ isMoving: false, direction: 1, climbing: false });
  // "Visit a random product row" state machine — see the tick loop below.
  // phase: 'idle' | 'traveling' | 'climbing' | 'bubble'.
  const visitRef = useRef({ phase: 'idle', el: null, productName: '', profit: null });
  const nextVisitAtRef = useRef(performance.now() + 15000 + Math.random() * 15000);
  const phaseUntilRef = useRef(0);
  const flavorLinesRef = useRef(DEFAULT_FLAVOR_LINES);
  const [chatOpen, setChatOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 60, y: 60 });
  const [bubble, setBubble] = useState(null); // { text, anchor } | null
  // Chat history lives in MySQL (mascot_chat_messages), scoped per admin —
  // loaded once on mount; the greeting below is shown locally whenever that
  // admin has no saved history yet, never written to the DB itself (only
  // real exchanges are).
  const [chatMessages, setChatMessages] = useState([DEFAULT_GREETING_MESSAGE]);

  useEffect(() => {
    let cancelled = false;
    mascotAPI
      .getChatHistory()
      .then((res) => {
        const stored = res?.data?.messages;
        if (!cancelled && Array.isArray(stored) && stored.length) {
          setChatMessages(stored.map(({ role, content }) => ({ role, content })));
        }
      })
      .catch(() => {
        // Keep the local greeting — not worth surfacing an error for this.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetChatHistory = useCallback(() => {
    setChatMessages([DEFAULT_GREETING_MESSAGE]);
    mascotAPI.clearChatHistory().catch(() => {
      // Best-effort — the local reset already happened either way.
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    mascotAPI
      .getFlavorLines()
      .then((res) => {
        const lines = res?.data?.lines;
        if (!cancelled && Array.isArray(lines) && lines.length) {
          flavorLinesRef.current = lines;
        }
      })
      .catch(() => {
        // Keep the built-in default lines — this is a cosmetic flourish, not
        // worth surfacing an error for.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [pinned, setPinned] = useState(() => {
    try {
      // Defaults to pinned (bottom-right corner) until the admin explicitly
      // un-pins it at least once — free wandering is opt-in, not the
      // out-of-the-box behavior.
      const stored = localStorage.getItem(PIN_STORAGE_KEY);
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, pinned ? '1' : '0');
    } catch {
      // Best-effort only — a private window or blocked storage just means
      // the pinned choice won't be remembered next visit.
    }
  }, [pinned]);

  const pickNewTarget = useCallback(() => {
    const maxX = window.innerWidth - WIDGET_SIZE - MARGIN;
    const maxY = window.innerHeight - WIDGET_SIZE - MARGIN;
    targetRef.current = {
      x: MARGIN + Math.random() * Math.max(1, maxX - MARGIN),
      y: MARGIN + Math.random() * Math.max(1, maxY - MARGIN),
    };
    nextTargetAtRef.current = performance.now() + 4000 + Math.random() * 5000;
  }, []);

  useEffect(() => {
    if (!pinned) pickNewTarget();

    let frameId;
    // Constant speed (px/sec) rather than an exponential lerp — a lerp
    // covers most of the distance in its first few frames and then crawls
    // the last little bit, which (especially over the short hops this does)
    // reads as an instant jump rather than a visible run. A fixed speed
    // keeps it on screen, actually running, for a consistent, noticeable
    // stretch of time no matter the distance.
    const RUN_SPEED_PX_PER_SEC = 260;
    let lastTickAt = performance.now();

    const isProductsPage = location.pathname.startsWith('/products');

    const resetVisit = () => {
      visitRef.current = { phase: 'idle', el: null, productName: '', profit: null };
      motionRef.current.climbing = false;
      setBubble(null);
    };

    const tick = () => {
      const now = performance.now();
      const dtSec = Math.min(0.05, (now - lastTickAt) / 1000);
      lastTickAt = now;

      // Pinning or opening the chat always wins — drop whatever visit was in
      // progress rather than letting it fight the corner/chat anchor.
      if ((pinned || chatOpen || !isProductsPage) && visitRef.current.phase !== 'idle') {
        resetVisit();
      }

      if (!chatOpen && wrapperRef.current) {
        const visit = visitRef.current;

        if (pinned) {
          targetRef.current = getCornerPosition();
        } else if (visit.phase === 'idle' && isProductsPage && now >= nextVisitAtRef.current) {
          const el = pickRandomProductElement();
          if (el) {
            const rect = el.getBoundingClientRect();
            const maxX = window.innerWidth - WIDGET_SIZE - MARGIN;
            const maxY = window.innerHeight - WIDGET_SIZE - MARGIN;
            targetRef.current = {
              x: Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - WIDGET_SIZE / 2), maxX),
              y: Math.min(Math.max(MARGIN, rect.top - WIDGET_SIZE + 24), maxY),
            };
            visitRef.current = {
              phase: 'traveling',
              el,
              productName: el.dataset.mascotProductName || '',
              profit: el.dataset.mascotProductProfit || null,
            };
          }
          // Whether or not a row was found, don't retry again for a while —
          // an empty/loading Products table shouldn't spin this check every
          // frame.
          nextVisitAtRef.current = now + 20000 + Math.random() * 20000;
        } else if (visit.phase === 'idle' && now >= nextTargetAtRef.current) {
          pickNewTarget();
        }

        const pos = posRef.current;
        const target = targetRef.current;
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 2) {
          const travel = Math.min(dist, RUN_SPEED_PX_PER_SEC * dtSec);
          pos.x += (dx / dist) * travel;
          pos.y += (dy / dist) * travel;
        }
        wrapperRef.current.style.left = `${pos.x}px`;
        wrapperRef.current.style.top = `${pos.y}px`;

        const arrived = dist <= 3;
        motionRef.current.isMoving = !arrived;
        if (Math.abs(dx) > 1) motionRef.current.direction = dx >= 0 ? 1 : -1;

        // Visit phase transitions: traveling -> climbing -> bubble -> idle.
        if (visit.phase === 'traveling' && arrived) {
          visitRef.current.phase = 'climbing';
          motionRef.current.climbing = true;
          phaseUntilRef.current = now + 1400;
        } else if (visit.phase === 'climbing') {
          if (now >= phaseUntilRef.current) {
            visitRef.current.phase = 'bubble';
            motionRef.current.climbing = false;
            const lines = flavorLinesRef.current;
            const template = lines[Math.floor(Math.random() * lines.length)];
            const text = fillFlavorLine(template, { productName: visit.productName, profit: visit.profit });
            setBubble({ text, anchor: { x: pos.x, y: pos.y } });
            phaseUntilRef.current = now + 4500;
          }
        } else if (visit.phase === 'bubble' && now >= phaseUntilRef.current) {
          resetVisit();
          nextTargetAtRef.current = now; // pick a fresh wander target right away
        }
      } else {
        motionRef.current.isMoving = false;
        motionRef.current.climbing = false;
      }
      frameId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frameId);
  }, [chatOpen, pinned, pickNewTarget, location.pathname]);

  const handleClick = () => {
    const pos = posRef.current;
    setAnchor({ x: pos.x, y: pos.y });
    setChatOpen((v) => !v);
  };

  const togglePinned = (e) => {
    e.stopPropagation();
    setPinned((v) => !v);
  };

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          position: 'fixed',
          left: posRef.current.x,
          top: posRef.current.y,
          width: WIDGET_SIZE,
          height: WIDGET_SIZE,
          zIndex: 2147482900,
        }}
      >
        <button
          type="button"
          onClick={togglePinned}
          title={pinned ? 'Sərbəst gəzsin' : 'Sağ-alt küncdə qalsın'}
          className={`absolute -top-1 -right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow transition ${
            pinned
              ? 'bg-blue-600 text-white border-blue-700'
              : isDark
              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {pinned ? <Pin size={11} /> : <PinOff size={11} />}
        </button>
        <div
          onClick={handleClick}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            filter: chatOpen ? 'drop-shadow(0 0 14px rgba(59,130,246,0.55))' : 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))',
          }}
          title="Checkila Köməkçi"
        >
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          <MascotScene containerRef={containerRef} motionRef={motionRef} />
        </div>
      </div>
      {chatOpen && (
        <ChatPanel
          messages={chatMessages}
          setMessages={setChatMessages}
          onReset={resetChatHistory}
          anchor={anchor}
          onClose={() => setChatOpen(false)}
          isDark={isDark}
        />
      )}
      {!chatOpen && bubble && <SpeechBubble text={bubble.text} anchor={bubble.anchor} isDark={isDark} />}
    </>
  );
}
