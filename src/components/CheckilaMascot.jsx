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
import * as THREE from 'three';
import { Send, X, Loader2, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { mascotAPI } from '../services/api';

const WIDGET_SIZE = 130;
const MARGIN = 16;

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

  const eyeGroup = new THREE.Group();
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 24),
    new THREE.MeshStandardMaterial({ color: '#1f8dff', emissive: '#1f8dff', emissiveIntensity: 1.0, roughness: 0.25 })
  );
  eyeGroup.add(eye);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshStandardMaterial({ color: '#05101c' }));
  pupil.position.z = 0.1;
  eyeGroup.add(pupil);
  const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  highlight.position.set(0.055, 0.06, 0.15);
  eyeGroup.add(highlight);
  eyeGroup.position.set(-0.16, 0.08, 1.1);
  headGroup.add(eyeGroup);

  const brow = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.02, 8, 24, Math.PI * 0.8),
    new THREE.MeshStandardMaterial({ color: '#1f8dff' })
  );
  brow.position.set(0.28, 0.18, 1.05);
  brow.rotation.z = Math.PI * 0.15;
  headGroup.add(brow);

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

  // --- Legs + feet --------------------------------------------------------
  const legsGroup = new THREE.Group();
  legsGroup.position.y = -0.85;
  root.add(legsGroup);

  const legMat = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.6 });
  [-1, 1].forEach((side) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.38, 6, 12), legMat);
    leg.position.set(side * 0.22, -0.28, 0);
    legsGroup.add(leg);

    const shoe = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.2, 6, 12),
      new THREE.MeshStandardMaterial({ color: side < 0 ? '#2fb6e0' : '#39d17d', roughness: 0.5 })
    );
    shoe.rotation.z = Math.PI / 2;
    shoe.position.set(side * 0.22, -0.62, 0.08);
    legsGroup.add(shoe);
  });

  // --- Arms (shoulder-pivoted, see buildArm) -----------------------------
  const leftArm = buildArm(-1, '#101114', '#f3f6fb');
  leftArm.position.set(-0.56, 0.42, 0.02);
  torsoGroup.add(leftArm);

  const rightArm = buildArm(1, '#101114', '#f3f6fb');
  rightArm.position.set(0.56, 0.42, 0.02);
  torsoGroup.add(rightArm);

  return { root, headGroup, torsoGroup, legsGroup, eyeGroup, leftArm, rightArm };
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

// Three "moods" the idle loop cycles through at random — mostly idle, with
// occasional waves/dances so the mascot feels alive without being
// distracting. Each entry returns nothing; they mutate the rig in place.
function applyIdlePose(rig, t) {
  rig.headGroup.rotation.y = Math.sin(t * 0.6) * 0.18;
  rig.headGroup.rotation.z = Math.sin(t * 0.8) * 0.03;
  rig.leftArm.rotation.z = rig.leftArm.userData.restRotationZ + Math.sin(t * 1.4) * 0.05;
  rig.rightArm.rotation.z = rig.rightArm.userData.restRotationZ + Math.sin(t * 1.4 + Math.PI) * 0.05;
  rig.leftArm.rotation.x = 0;
  rig.rightArm.rotation.x = 0;
  rig.root.rotation.z = 0;
  rig.legsGroup.rotation.z = 0;
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
}

function MascotScene({ containerRef }) {
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
    fitCameraToObject(camera, rig.root, 1.5);

    let frameId;
    let nextBlinkAt = performance.now() + 1500 + Math.random() * 2500;
    let blinkUntil = 0;
    const start = performance.now();

    // Mood state machine: idle most of the time, occasionally wave or dance.
    let mood = 'idle';
    let moodUntil = performance.now() + 4000 + Math.random() * 4000;
    let moodStart = performance.now();

    const pickNextMood = (now) => {
      const roll = Math.random();
      if (roll < 0.45) {
        mood = 'wave';
        moodUntil = now + 1800;
      } else if (roll < 0.75) {
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

      if (now >= moodUntil) pickNextMood(now);
      const progress = (now - moodStart) / 1000;

      rig.root.position.y = Math.sin(t * 1.8) * 0.06;

      if (mood === 'wave') applyWavePose(rig, t, progress);
      else if (mood === 'dance') applyDancePose(rig, t);
      else applyIdlePose(rig, t);

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
  }, [containerRef]);

  return null;
}

// ---------------------------------------------------------------------------
// Chat panel
// ---------------------------------------------------------------------------

function ChatPanel({ anchor, onClose, isDark }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Salam! Mən Checkila-yam 👋 Nə köməklik edim?' },
  ]);
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
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
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
      const startRes = await mascotAPI.startChat(nextMessages.map(({ role, content }) => ({ role, content })));
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
  const panelWidth = 340;
  const panelHeight = 440;
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
        <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <X size={16} />
        </button>
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

      <div className={`flex items-center gap-2 p-2.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={1}
          placeholder="Məsələn: B0C7BKZ883 ASIN-li məhsulun Amazon qiymətini 19.99 et"
          className={`flex-1 resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
          }`}
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition shrink-0"
        >
          <Send size={15} />
        </button>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Wandering widget
// ---------------------------------------------------------------------------

export default function CheckilaMascot() {
  const { isDark } = useTheme();
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const posRef = useRef({ x: 60, y: 60 });
  const targetRef = useRef({ x: 60, y: 60 });
  const nextTargetAtRef = useRef(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 60, y: 60 });

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
    posRef.current = { x: window.innerWidth - WIDGET_SIZE - MARGIN, y: window.innerHeight - WIDGET_SIZE - MARGIN };
    targetRef.current = { ...posRef.current };
    pickNewTarget();

    let frameId;
    const tick = () => {
      if (!chatOpen && wrapperRef.current) {
        const now = performance.now();
        if (now >= nextTargetAtRef.current) pickNewTarget();

        const pos = posRef.current;
        const target = targetRef.current;
        pos.x += (target.x - pos.x) * 0.015;
        pos.y += (target.y - pos.y) * 0.015;
        wrapperRef.current.style.left = `${pos.x}px`;
        wrapperRef.current.style.top = `${pos.y}px`;
      }
      frameId = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frameId);
  }, [chatOpen, pickNewTarget]);

  const handleClick = () => {
    const pos = posRef.current;
    setAnchor({ x: pos.x, y: pos.y });
    setChatOpen((v) => !v);
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
          cursor: 'pointer',
          filter: chatOpen ? 'drop-shadow(0 0 14px rgba(59,130,246,0.55))' : 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))',
        }}
        onClick={handleClick}
        title="Checkila Köməkçi"
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <MascotScene containerRef={containerRef} />
      </div>
      {chatOpen && <ChatPanel anchor={anchor} onClose={() => setChatOpen(false)} isDark={isDark} />}
    </>
  );
}
