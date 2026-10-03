'use client';

import { useEffect, useRef } from 'react';

type Three = typeof import('three');
type Variant = 'orb' | 'waves';

/** What each variant hands back to the shared render loop. */
type Built = {
  /** Called on every resize with the camera's visible half-width at z = 0. */
  layout: (halfWidth: number, aspect: number) => void;
  /** Called every frame. `pointer` is eased, and in the range -1..1. */
  tick: (time: number, pointer: { x: number; y: number }) => void;
};

/**
 * The WebGL backdrop for a hero band.
 *
 * DECORATION ONLY. It sits behind the content, is hidden from assistive tech,
 * takes no pointer events, and the band's CSS gradient is the complete design
 * without it. That is what makes every skip below safe:
 *
 *   Save-Data on         never loads three.js at all
 *   no WebGL context     leaves the gradient
 *   reduced motion       draws one still frame, no loop
 *   off screen / hidden  the loop is paused, so a background tab costs nothing
 *
 * three.js is imported inside the effect and only once the browser is idle, so
 * it never competes with the content for the first paint.
 *
 *   orb     a slowly turning constellation — the home hero
 *   waves   a rolling field of points — every other page header
 */
export function Scene({ variant, className = '' }: { variant: Variant; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      const THREE = await import('three');
      if (disposed) return;

      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'low-power',
        });
      } catch {
        return;
      }

      // Past ~1.75 the extra pixels are invisible on points and lines, and
      // they are what makes a phone warm.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setClearColor(0x000000, 0);

      const canvas = renderer.domElement;
      canvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.2s ease';
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      const built =
        variant === 'orb' ? buildOrb(THREE, scene, camera) : buildWaves(THREE, scene, camera);

      const target = { x: 0, y: 0 };
      const pointer = { x: 0, y: 0 };
      const onPointer = (event: PointerEvent) => {
        target.x = (event.clientX / window.innerWidth) * 2 - 1;
        target.y = (event.clientY / window.innerHeight) * 2 - 1;
      };

      const resize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * camera.position.length();
        built.layout(halfHeight * camera.aspect, camera.aspect);
        if (reducedMotion) renderer.render(scene, camera);
      };

      const clock = new THREE.Clock();
      const frame = () => {
        pointer.x += (target.x - pointer.x) * 0.045;
        pointer.y += (target.y - pointer.y) * 0.045;
        built.tick(clock.getElapsedTime(), pointer);
        renderer.render(scene, camera);
      };

      let onScreen = true;
      const sync = () => {
        if (reducedMotion) return;
        renderer.setAnimationLoop(onScreen && !document.hidden ? frame : null);
      };

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      const intersectionObserver = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? true;
        sync();
      });
      intersectionObserver.observe(host);
      document.addEventListener('visibilitychange', sync);
      window.addEventListener('pointermove', onPointer, { passive: true });

      resize();
      built.tick(0, pointer);
      renderer.render(scene, camera);
      sync();
      requestAnimationFrame(() => {
        canvas.style.opacity = '1';
      });

      cleanup = () => {
        renderer.setAnimationLoop(null);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener('visibilitychange', sync);
        window.removeEventListener('pointermove', onPointer);
        scene.traverse((object) => {
          const node = object as import('three').Mesh;
          node.geometry?.dispose();
          const material = node.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material?.dispose();
        });
        renderer.dispose();
        canvas.remove();
      };
    };

    // Safari has no requestIdleCallback; a short timeout is close enough.
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    const run = () => {
      start().catch((error: unknown) => {
        console.warn('[scene] WebGL backdrop unavailable', error);
      });
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(run, 250);
    }

    return () => {
      disposed = true;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      cleanup();
    };
  }, [variant]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-[1] ${className}`}
    />
  );
}

// The brand ramp, shared by both variants: indigo → cyan → amber.
const RAMP = [0x818cf8, 0x22d3ee, 0xfbbf24] as const;

/** Writes the ramp colour at `t` (0..1) into `out` at vertex `index`. */
function rampInto(THREE: Three, out: Float32Array, index: number, t: number): void {
  const [a, b, c] = RAMP.map((hex) => new THREE.Color(hex)) as [
    import('three').Color,
    import('three').Color,
    import('three').Color,
  ];
  const colour = t < 0.5 ? a.clone().lerp(b, t * 2) : b.clone().lerp(c, (t - 0.5) * 2);
  out[index * 3] = colour.r;
  out[index * 3 + 1] = colour.g;
  out[index * 3 + 2] = colour.b;
}

function buildOrb(
  THREE: Three,
  scene: import('three').Scene,
  camera: import('three').PerspectiveCamera,
): Built {
  camera.position.set(0, 0, 7);

  const group = new THREE.Group();
  scene.add(group);

  // A shell of points on a Fibonacci sphere: evenly spread, no visible poles.
  const COUNT = 1500;
  const RADIUS = 1.7;
  const positions = new Float32Array(COUNT * 3);
  const colours = new Float32Array(COUNT * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i += 1) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const r = RADIUS * (1 + (Math.random() - 0.5) * 0.05);
    positions[i * 3] = Math.cos(theta) * ring * r;
    positions[i * 3 + 1] = y * r;
    positions[i * 3 + 2] = Math.sin(theta) * ring * r;
    rampInto(THREE, colours, i, (y + 1) / 2);
  }
  const shellGeometry = new THREE.BufferGeometry();
  shellGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  shellGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const shell = new THREE.Points(
    shellGeometry,
    new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(shell);

  const lattice = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.22, 1)),
    new THREE.LineBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.32,
    }),
  );
  group.add(lattice);

  const core = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 0)),
    new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.7,
    }),
  );
  group.add(core);

  // Two orbit rings, each with a satellite riding it.
  const makeRing = (radius: number, colour: number, tiltX: number, tiltY: number) => {
    const pivot = new THREE.Group();
    pivot.rotation.set(tiltX, tiltY, 0);
    pivot.add(
      new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.006, 8, 180),
        new THREE.MeshBasicMaterial({
          color: colour,
          transparent: true,
          opacity: 0.5,
        }),
      ),
    );
    const satellite = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({ color: colour }),
    );
    pivot.add(satellite);
    group.add(pivot);
    return { radius, satellite };
  };
  const rings = [
    makeRing(2.15, 0xfbbf24, Math.PI / 2.35, 0.25),
    makeRing(2.4, 0x22d3ee, Math.PI / 2.9, -0.5),
  ];

  // Far dust, outside the group so it drifts on its own.
  const DUST = 420;
  const dustPositions = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 22;
    dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    dustPositions[i * 3 + 2] = -2 - Math.random() * 8;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      size: 0.035,
      color: 0xc7d2fe,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  scene.add(dust);

  return {
    layout: (halfWidth, aspect) => {
      // Wide: the orb sits to the right of the copy. Narrow: it centres behind
      // the copy, smaller, and the wrapper's opacity keeps the text readable.
      const wide = aspect > 1.25;
      group.position.x = wide ? halfWidth * 0.52 : 0;
      group.position.y = wide ? 0 : 0.4;
      group.scale.setScalar(wide ? 1 : 0.8);
    },
    tick: (time, pointer) => {
      group.rotation.y = time * 0.12 + pointer.x * 0.35;
      group.rotation.x = Math.sin(time * 0.2) * 0.08 + pointer.y * 0.22;
      lattice.rotation.y = -time * 0.18;
      lattice.rotation.z = time * 0.05;
      core.rotation.x = time * 0.4;
      core.rotation.y = time * 0.55;
      const pulse = 1 + Math.sin(time * 1.4) * 0.06;
      core.scale.setScalar(pulse);
      rings.forEach((ring, index) => {
        const angle = time * (index === 0 ? 0.55 : -0.38) + index * 2;
        ring.satellite.position.set(
          Math.cos(angle) * ring.radius,
          Math.sin(angle) * ring.radius,
          0,
        );
      });
      dust.rotation.y = time * 0.01 + pointer.x * 0.03;
      dust.position.y = pointer.y * -0.12;
    },
  };
}

function buildWaves(
  THREE: Three,
  scene: import('three').Scene,
  camera: import('three').PerspectiveCamera,
): Built {
  camera.position.set(0, 2.1, 6.4);
  camera.lookAt(0, -0.2, 0);

  const COLS = 84;
  const ROWS = 26;
  const GAP = 0.3;
  const count = COLS * ROWS;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const i = row * COLS + col;
      positions[i * 3] = (col - COLS / 2) * GAP;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = (row - ROWS / 2) * GAP;
      rampInto(THREE, colours, i, col / (COLS - 1));
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

  const field = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  field.position.y = -1.1;
  scene.add(field);

  return {
    layout: () => {},
    tick: (time, pointer) => {
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const i = row * COLS + col;
          const x = positions[i * 3] ?? 0;
          const z = positions[i * 3 + 2] ?? 0;
          positions[i * 3 + 1] =
            Math.sin(x * 0.65 + time * 0.9) * 0.24 + Math.cos(z * 0.9 + time * 0.6) * 0.2;
        }
      }
      positionAttribute.needsUpdate = true;
      field.rotation.y = pointer.x * 0.12;
      field.rotation.x = pointer.y * 0.04;
    },
  };
}
