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

const WIDGET_SIZE = 110;
const MARGIN = 16;

// ---------------------------------------------------------------------------
// 3D model
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
    float lightAmt = clamp(dot(normalize(vNormal), normalize(vec3(0.4, 0.6, 1.0))) * 0.5 + 0.5, 0.0, 1.0);
    vec3 shaded = base * (0.55 + 0.45 * lightAmt);
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

function buildMascot() {
  const root = new THREE.Group();

  // Hood/head shell — rounded, blue (top) to green (bottom) gradient, matching
  // the mascot artwork's hoodie-and-leaves color story.
  const hoodMat = gradientMaterial('#35c2e8', '#34d17a', -1.1, 1.35);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 48), hoodMat);
  hood.scale.set(1, 1.08, 0.92);
  hood.position.y = 0.55;
  root.add(hood);

  // Dark face screen set into the hood.
  const faceMat = new THREE.MeshStandardMaterial({ color: '#0b0b10', roughness: 0.25, metalness: 0.35 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.86, 48, 48), faceMat);
  face.scale.set(1, 1.05, 0.55);
  face.position.set(0, 0.55, 0.42);
  root.add(face);

  // Rim highlight around the face screen.
  const rimMat = new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.4, metalness: 0.1 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.035, 16, 48), rimMat);
  rim.position.set(0, 0.55, 0.42);
  root.add(rim);

  // One big glowing eye + highlight.
  const eyeGroup = new THREE.Group();
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 24, 24),
    new THREE.MeshStandardMaterial({ color: '#1f8dff', emissive: '#1f8dff', emissiveIntensity: 0.9, roughness: 0.3 })
  );
  eyeGroup.add(eye);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), new THREE.MeshStandardMaterial({ color: '#06121f' }));
  pupil.position.z = 0.1;
  eyeGroup.add(pupil);
  const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  highlight.position.set(0.06, 0.07, 0.16);
  eyeGroup.add(highlight);
  eyeGroup.position.set(-0.12, 0.58, 0.78);
  root.add(eyeGroup);

  // Winking brow on the other side.
  const brow = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.022, 8, 24, Math.PI * 0.8),
    new THREE.MeshStandardMaterial({ color: '#1f8dff' })
  );
  brow.position.set(0.32, 0.66, 0.74);
  brow.rotation.z = Math.PI * 0.15;
  root.add(brow);

  // Smile — a thin curved arc.
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.02, 8, 24, Math.PI * 0.75),
    new THREE.MeshStandardMaterial({ color: '#ff5a7a' })
  );
  smile.position.set(0.05, 0.38, 0.8);
  smile.rotation.z = Math.PI * 1.12;
  root.add(smile);

  // Two leaf/antenna shapes on top of the hood.
  const leafMat1 = new THREE.MeshStandardMaterial({ color: '#2fb6e0', roughness: 0.4 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: '#39d17d', roughness: 0.4 });
  const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), leafMat1);
  leaf1.scale.set(0.35, 1, 0.5);
  leaf1.position.set(-0.08, 1.62, -0.05);
  leaf1.rotation.z = -0.35;
  root.add(leaf1);
  const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), leafMat2);
  leaf2.scale.set(0.3, 0.85, 0.45);
  leaf2.position.set(0.14, 1.52, -0.05);
  leaf2.rotation.z = 0.5;
  root.add(leaf2);

  // Body (hoodie torso).
  const bodyMat = gradientMaterial('#35c2e8', '#34d17a', -1.0, 0.1);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 0.55, 8, 24), bodyMat);
  body.position.y = -0.55;
  root.add(body);

  // Pants.
  const pants = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, 0.35, 8, 24),
    new THREE.MeshStandardMaterial({ color: '#17181c', roughness: 0.6 })
  );
  pants.position.y = -1.35;
  root.add(pants);

  // Arms + mitten hands.
  const armMat = new THREE.MeshStandardMaterial({ color: '#0f1013', roughness: 0.6 });
  const handMat = new THREE.MeshStandardMaterial({ color: '#f3f6fb', roughness: 0.5 });
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.45, 6, 12), armMat);
    arm.position.set(side * 0.74, -0.55, 0);
    arm.rotation.z = side * 0.25;
    root.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), handMat);
    hand.position.set(side * 0.92, -0.95, 0.05);
    root.add(hand);
  });

  // Feet.
  [-1, 1].forEach((side) => {
    const shoe = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.2, 0.22, 6, 12),
      new THREE.MeshStandardMaterial({ color: side < 0 ? '#2fb6e0' : '#39d17d', roughness: 0.5 })
    );
    shoe.rotation.z = Math.PI / 2;
    shoe.position.set(side * 0.3, -1.85, 0.08);
    root.add(shoe);
  });

  return { root, eyeGroup, leaf1, leaf2 };
}

function MascotScene({ containerRef }) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const width = WIDGET_SIZE;
    const height = WIDGET_SIZE;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 20);
    camera.position.set(0, 0.1, 5.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 3, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ab4ff, 0.5);
    rim.position.set(-3, -1, -2);
    scene.add(rim);

    const { root, eyeGroup } = buildMascot();
    root.scale.setScalar(1.18);
    scene.add(root);

    let frameId;
    let nextBlinkAt = performance.now() + 1500 + Math.random() * 2500;
    let blinkUntil = 0;
    const start = performance.now();

    const animate = () => {
      const now = performance.now();
      const t = (now - start) / 1000;

      root.position.y = Math.sin(t * 1.8) * 0.08;
      root.rotation.y = Math.sin(t * 0.6) * 0.25;
      root.rotation.z = Math.sin(t * 0.9) * 0.03;

      if (now >= nextBlinkAt && now >= blinkUntil) {
        blinkUntil = now + 140;
        nextBlinkAt = now + 2200 + Math.random() * 3000;
      }
      const blinking = now < blinkUntil;
      eyeGroup.scale.y = blinking ? 0.12 : 1;

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
      const res = await mascotAPI.chat(nextMessages.map(({ role, content }) => ({ role, content })));
      const reply = res?.data?.reply || 'Bağışlayın, cavab ala bilmədim.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
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
