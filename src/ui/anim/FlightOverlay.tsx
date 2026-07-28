import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import type { AnimationPlaybackControls } from 'motion/react';
import { Card } from '../card/Card';
import { CARD_ASPECT } from '../../data/cardTypes';
import {
  FLIGHT_TIMES,
  PATH_TIMES,
  centerOf,
  controlPoint,
  defaultPeak,
  easedPathKeys,
  flipKeys,
  scaleKeys,
} from './arc';
import { EASE } from './tokens';
import type { FrozenRect } from './rectRegistry';
import { currentMetricsEpoch, resolveKey } from './rectRegistry';
import {
  FLIGHT_Z,
  _attach,
  _land,
  getClones,
  getSpeed,
  subscribe,
  type Clone,
} from './flightLayer';

// The renderer for the flight-layer singleton. Owns no state: it subscribes to
// the singleton's clone list and draws one <FlightClone> per entry.
//
// ⚠️ Named FlightOverlay, not FlightLayer, purely because `flightLayer.ts` (the
// singleton) already exists and Windows/macOS filesystems are case-insensitive:
// two files differing only in case make `tsc` fail with TS1149 and make the
// import that resolves depend on which one the compiler saw first. The spec's
// file list (ui-animation-spec §2) names both `FlightLayer.tsx` and
// `flightLayer.ts`; that pair cannot coexist here. Recorded as D18.
//
// ⚠️ `perspective: 1400px` lives on THE LAYER, not on each clone. One shared
// vanishing point is what makes several cards in flight read as objects on one
// table; per-card perspective gives every card its own private camera and the
// whole thing looks like a collage. This is also the wrapper that makes the
// mid-flight rotateY a real 3-D turn rather than a horizontal squash.

export function FlightOverlay() {
  const clones = useSyncExternalStore(subscribe, getClones, getClones);
  return (
    <div
      data-flight-layer=""
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: FLIGHT_Z, perspective: '1400px' }}
    >
      {clones.map((c) => (
        <FlightClone key={c.key} clone={c} />
      ))}
    </div>
  );
}

interface Geometry {
  x: number[];
  y: number[];
  scale: number[];
  rotateY: number[];
  rotate: number[];
  width: number;
  height: number;
}

function FlightClone({ clone }: { clone: Clone }) {
  const { spec, from } = clone;
  const [geom, setGeom] = useState<Geometry | null>(null);
  const progress = useMotionValue(0);
  const controlsRef = useRef<AnimationPlaybackControls | null>(null);

  // ── Pass 1: resolve the destination, then set state.
  //
  // ⚠️ This MUST be useLayoutEffect, and the two-pass shape is deliberate.
  //  • Late resolution is the point: by the time this runs, React has committed
  //    the destination slot (rendered with `visibility: hidden` so it still
  //    occupies layout), so the geometry we read is FINAL. Resolving earlier
  //    would aim the flight at where the slot was about to be.
  //  • A setState inside useLayoutEffect is flushed synchronously BEFORE the
  //    browser paints, so the invisible first pass never reaches the screen.
  //    With useEffect instead, there would be one painted frame in which the
  //    source card is already hidden and the clone is not yet drawn — a visible
  //    flash on every single card movement.
  useLayoutEffect(() => {
    // A resize between queueing and starting invalidates the captured source
    // rect. A 400 ms flight to a rect that has since moved 300 px looks far worse
    // than an instant snap, so snap.
    if (clone.metricsEpoch !== currentMetricsEpoch()) {
      _land(spec.instanceId);
      return;
    }

    const to: FrozenRect = typeof spec.to === 'string' ? resolveKey(spec.to) : spec.to;
    const height = Math.max(1, to.height);
    const width = Math.max(1, to.width || Math.round(height * CARD_ASPECT));

    const fromC = centerOf(from);
    const toC = centerOf(to);
    const vp = { w: window.innerWidth, h: window.innerHeight };
    const ctrl = controlPoint(fromC, toC, spec.arc, vp);
    // ⚠️ The flight ease is baked in HERE, by sampling the curve at eased
    // parameters, so the single driving MotionValue can stay linear in time and
    // every keyframe time below means wall-clock time. Easing the driver instead
    // made the face flip complete at 32% of the flight — see FLIGHT_TIMES.
    const path = easedPathKeys(fromC, ctrl, toC, EASE[spec.ease ?? 'flight']);

    // The clone is a fixed-position box at the destination SIZE, moved by
    // translating its centre. transformOrigin stays at the centre, so scaling
    // never shifts the position — which is what makes the landing exact.
    setGeom({
      x: path.x.map((v) => v - width / 2),
      y: path.y.map((v) => v - height / 2),
      scale: scaleKeys(from.height, height, spec.peakScale ?? defaultPeak(from.height, height)),
      rotateY: flipKeys(spec.faceUpAtStart, spec.faceUpAtEnd),
      rotate: rampKeys(spec.spinFrom ?? 0, spec.spinTo ?? 0),
      width,
      height,
    });
    // `from`/`spec` are stable for a clone's lifetime — a clone is never reused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two keyframe grids off ONE linear driver: a dense one for the curved path,
  // a sparse one for the properties whose shape is defined at the apex.
  const pathTimes = PATH_TIMES as unknown as number[];
  const keyTimes = FLIGHT_TIMES as unknown as number[];
  const IDLE_PATH = PATH_TIMES.map(() => 0);
  const IDLE_KEYS = [0, 0, 0, 0, 0];
  const x = useTransform(progress, pathTimes, geom?.x ?? IDLE_PATH);
  const y = useTransform(progress, pathTimes, geom?.y ?? IDLE_PATH);
  const scale = useTransform(progress, keyTimes, geom?.scale ?? [1, 1, 1, 1, 1]);
  const rotateY = useTransform(progress, keyTimes, geom?.rotateY ?? IDLE_KEYS);
  const rotate = useTransform(progress, keyTimes, geom?.rotate ?? IDLE_KEYS);
  // The travelling glow: it swells across the middle of the flight and fades to a
  // residue on landing. Kept as an opacity on a shadow-only sibling because that
  // composites, whereas animating a `filter: drop-shadow` string re-rasterizes
  // the card every frame.
  const glowOpacity = useTransform(progress, [0, 0.5, 1], [0, 0.55, 0.32]);

  // ── Pass 2: run the animation.
  useLayoutEffect(() => {
    if (!geom) return;

    const { cancelled } = _attach(spec.instanceId, {
      onCancel: () => {
        // Snap to the final pose, then let the singleton settle the promise.
        progress.set(1);
        controlsRef.current?.stop();
      },
      onSpeed: (speed) => {
        if (controlsRef.current) controlsRef.current.speed = speed;
      },
    });
    if (cancelled) {
      progress.set(1);
      _land(spec.instanceId);
      return;
    }

    // LINEAR, deliberately. The flight ease lives in the position keyframes.
    const controls = animate(progress, 1, {
      duration: Math.max(0.001, spec.durationMs / 1000),
      ease: 'linear',
    });
    controls.speed = getSpeed();
    controlsRef.current = controls;

    void controls.then(() => {
      // ⚠️ Settle in the SAME frame the clone stops. animStore.inFlight is
      // cleared by the awaiting beat, so the real card becomes visible exactly as
      // the clone unmounts — one frame either way is a visible double-image or a
      // visible gap.
      _land(spec.instanceId);
    });

    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geom]);

  if (!geom) {
    // Never painted — see the note on pass 1.
    return <div style={{ position: 'fixed', width: 0, height: 0 }} />;
  }

  const faceDown = !spec.faceUpAtStart && !spec.faceUpAtEnd;
  // ⚠️ Only mount the back face when the flight actually FLIPS. For the majority of
  // flights (a move, a resolve, a land drop) the reverse side is never visible, and
  // mounting it doubled the clone's DOM for nothing. Together with `chrome={false}`
  // this took a six-card draw from a 50 ms hitch to one frame.
  const flips = spec.faceUpAtStart !== spec.faceUpAtEnd;

  return (
    <motion.div
      className="crt-flight-clone"
      data-flight-clone={spec.instanceId}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: geom.width,
        height: geom.height,
        x,
        y,
        scale,
        rotateY,
        rotate,
        zIndex: spec.z ?? 10,
        transformStyle: 'preserve-3d',
        // Needed for the flip, and it also keeps the compositor from drawing the
        // reverse side of the card during the turn.
        backfaceVisibility: 'hidden',
      }}
    >
      {spec.glow && (
        <motion.div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '4.5%',
            boxShadow: `0 0 22px 6px ${spec.glow}`,
            opacity: glowOpacity,
          }}
        />
      )}

      {/* Front and back are stacked, each hiding its own backface, with the back
          pre-rotated 180°. That is what turns one rotateY into a real card flip
          instead of a mirror-image smear. */}
      <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
        <Card
          card={spec.card}
          height={geom.height}
          faceIndex={spec.faceIndex ?? 0}
          faceDown={faceDown || spec.faceMode === 'back'}
          registerSlot={false}
          chrome={false}
        />
      </div>
      {flips && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden',
          }}
        >
          <Card card={spec.card} height={geom.height} faceDown registerSlot={false} chrome={false} />
        </div>
      )}
    </motion.div>
  );
}

/** Linear keyframes across FLIGHT_TIMES, for a plain start→end ramp. */
function rampKeys(from: number, to: number): number[] {
  return FLIGHT_TIMES.map((t) => from + (to - from) * t);
}

export { PATH_TIMES };
