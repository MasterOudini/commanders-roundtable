import { motion } from 'motion/react';
import { useAnim } from '../../store/animStore';
import { EASE, DUR, ds } from './tokens';
import { resolveKey, type SlotKey } from './rectRegistry';
import { FX_Z } from './flightLayer';

// Floating numbers and digest-mode pulses. DOM, above the FX canvas.
//
// ⚠️ ALL FX TEXT IS DOM, NEVER CANVAS — and this is the architectural reason, not
// a stylistic preference. Because the canvas never rasterizes a glyph, no
// `document.fonts.load()` race can bake a tofu box into a texture. This
// workspace's tofu rule is satisfied STRUCTURALLY rather than by remembering to
// await a font before every draw call. (The matching comment lives above FxCanvas.)
//
// Every badge is `aria-hidden`: the game log is the accessible channel, and
// announcing damage twice is worse than announcing it once.

const BADGE_COLOR = {
  damage: 'var(--color-crt-danger)',
  gain: 'var(--color-crt-ok)',
  commander: 'var(--color-crt-cmd)',
} as const;

export function FxOverlay() {
  const badges = useAnim((s) => s.badges);
  const pulses = useAnim((s) => s.pulses);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: FX_Z + 10 }}
      data-fx-overlay=""
    >
      {/* Digest mode's entire vocabulary: a 140 ms fade and a coloured outline on
          the destination. No clones, nothing to cancel, nothing to wedge. */}
      {Object.values(pulses).map((p) => {
        const r = resolveKey(p.key as SlotKey);
        return (
          <motion.div
            key={p.key}
            data-digest-pulse={p.key}
            className="absolute rounded"
            style={{
              left: r.left - 2,
              top: r.top - 2,
              width: r.width + 4,
              height: r.height + 4,
              boxShadow: `0 0 0 2px ${p.color}`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: ds(DUR.digest * 1.6), ease: EASE.out }}
          />
        );
      })}

      {badges.map((b) => (
        <motion.div
          key={b.id}
          data-fx-badge={b.id}
          className="crt-num absolute font-semibold"
          style={{
            left: b.x,
            top: b.y,
            fontSize: 22,
            color: BADGE_COLOR[b.kind],
            textShadow: '0 1px 3px oklch(0 0 0 / 0.8)',
            // Its own compositor layer, for the ~half second it exists. Without it,
            // animating a child of a full-viewport fixed overlay can invalidate a
            // paint region far larger than the badge. ⚠️ Only ever transient — a
            // standing will-change on 40 cards would be 40 layers and a GPU-memory
            // blowout, which is why it lives here and not on Card.
            willChange: 'transform, opacity',
          }}
          // Overshoot to 1.34, then settle and float up out of the way.
          //
          // ⚠️ NO `filter: blur` entrance, despite the spec's 3-frame blur. Measured:
          // a damage volley creates three or four badges at once, and four
          // simultaneous blur animations cost 5 long frames with a 108 ms maximum,
          // against 0 long frames for every other beat once view identity was fixed.
          // `filter: blur` forces a filter region and a repaint per frame; the
          // overshoot and the fade already carry the punch. The spec's own note
          // ("only 2 of these may be live at once") was the warning — the honest
          // resolution is not to pay for it at all.
          initial={{ scale: 0.4, opacity: 0, y: 0 }}
          animate={{
            scale: [0.4, 1.34, 1, 0.94],
            opacity: [0, 1, 1, 0],
            y: [0, -6, -10, -46],
          }}
          transition={{
            duration: ds(DUR.damagePunch),
            times: [0, 0.14, 0.26, 1],
            ease: EASE.out,
          }}
        >
          {b.kind === 'commander' && (
            <span className="mr-[1px] align-super text-[9px] tracking-wider">CMD</span>
          )}
          {b.text}
        </motion.div>
      ))}
    </div>
  );
}
