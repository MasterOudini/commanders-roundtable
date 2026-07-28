import { create } from 'zustand';
import type { InstanceId } from '../view/types';

// ⚠️ THE CONVERGENCE INVARIANT, and the single most important rule in the
// animation subsystem:
//
//     animStore may only HIDE or DECORATE. It never holds card→zone truth.
//
// Zone membership lives exclusively in `gameStore.view.zones`, which is committed
// from the engine's event log. This store says only "that card is mid-flight, so
// don't paint it in its slot yet" and "flash that slot".
//
// What that buys: the DOM's zone membership is ALWAYS the authoritative state, so
// the worst thing a dropped, hung or crashed animation can do is leave a card
// invisible for a moment. It can never move a card somewhere the engine did not
// put it, and it can never wedge the table into a state a reload is needed to
// escape. A reconciler sweeps orphaned `inFlight` ids every 500 ms, so even that
// worst case self-heals.
//
// The moment this store starts holding "which zone is this card in", every
// failure mode becomes a desync instead of a flicker. Don't.

export interface DigestPulse {
  /** SlotKey-ish target: a card id or a zone id. */
  key: string;
  /** Colour to pulse — usually the card's colour identity. */
  color: string;
  until: number;
}

/**
 * A floating damage / life number.
 *
 * ⚠️ DOM, never canvas — and this is the reason ALL floating FX text is DOM in
 * this app. It means the FX canvas never rasterizes a glyph, which STRUCTURALLY
 * satisfies this workspace's tofu rule: no `document.fonts.load()` race can bake
 * a missing-glyph box into a texture, because there is no texture. The rule is
 * satisfied by architecture rather than by remembering to await a font.
 *
 * `aria-hidden` on render: the game log is the accessible channel, and announcing
 * damage twice is worse than announcing it once.
 */
export interface FxBadge {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: 'damage' | 'gain' | 'commander';
}

interface AnimState {
  /** Cards whose real slot must render `visibility: hidden` while a clone flies. */
  inFlight: ReadonlySet<InstanceId>;
  /** Digest-mode decorations, keyed by target. No clones involved. */
  pulses: Record<string, DigestPulse>;
  /** One global table fade after a hard sync, so a resync is visible but silent. */
  hardSyncFlash: boolean;
  /**
   * Row-sweep decorations for a coalesced untap-all, keyed by `${player}:${band}`.
   * The ordered ids give each card a `transition-delay`, which is how the sweep
   * gets its 34 ms stagger for free — a CSS transition delay rather than twelve
   * JavaScript animations.
   */
  rowSweeps: Record<string, { at: number; order: InstanceId[]; stepMs: number }>;
  /** Floating numbers. DOM, never canvas — see FxBadge. */
  badges: FxBadge[];

  markInFlight: (ids: InstanceId[]) => void;
  clearInFlight: (ids: InstanceId[]) => void;
  /** Drop any id not in `live` — the 500 ms convergence sweep. */
  reconcile: (live: ReadonlySet<InstanceId>) => void;
  pulse: (key: string, color: string, ms: number) => void;
  sweepRow: (key: string, ms: number, order: InstanceId[], stepMs: number) => void;
  /** Add a floating number; it removes itself when its animation ends. */
  addBadge: (badge: Omit<FxBadge, 'id'>, ms: number) => void;
  setHardSyncFlash: (on: boolean) => void;
  clear: () => void;
}

export const useAnim = create<AnimState>((set, get) => ({
  inFlight: new Set(),
  pulses: {},
  hardSyncFlash: false,
  rowSweeps: {},
  badges: [],

  markInFlight: (ids) => {
    if (ids.length === 0) return;
    const next = new Set(get().inFlight);
    for (const id of ids) next.add(id);
    set({ inFlight: next });
  },

  clearInFlight: (ids) => {
    if (ids.length === 0) return;
    const current = get().inFlight;
    if (!ids.some((id) => current.has(id))) return; // no-op, no re-render
    const next = new Set(current);
    for (const id of ids) next.delete(id);
    set({ inFlight: next });
  },

  reconcile: (live) => {
    const current = get().inFlight;
    let stale = false;
    for (const id of current) {
      if (!live.has(id)) {
        stale = true;
        break;
      }
    }
    if (!stale) return;
    const next = new Set<InstanceId>();
    for (const id of current) if (live.has(id)) next.add(id);
    set({ inFlight: next });
  },

  pulse: (key, color, ms) => {
    const until = performance.now() + ms;
    set({ pulses: { ...get().pulses, [key]: { key, color, until } } });
    window.setTimeout(() => {
      const p = get().pulses[key];
      if (!p || p.until > performance.now() + 1) return; // a newer pulse replaced it
      const next = { ...get().pulses };
      delete next[key];
      set({ pulses: next });
    }, ms + 20);
  },

  sweepRow: (key, ms, order, stepMs) => {
    set({
      rowSweeps: { ...get().rowSweeps, [key]: { at: performance.now(), order, stepMs } },
    });
    window.setTimeout(() => {
      const next = { ...get().rowSweeps };
      delete next[key];
      set({ rowSweeps: next });
    }, ms + 120);
  },

  addBadge: (badge, ms) => {
    const id = ++badgeSeq;
    set({ badges: [...get().badges, { ...badge, id }] });
    window.setTimeout(() => {
      set({ badges: get().badges.filter((b) => b.id !== id) });
    }, ms + 60);
  },

  setHardSyncFlash: (hardSyncFlash) => set({ hardSyncFlash }),

  clear: () =>
    set({ inFlight: new Set(), pulses: {}, rowSweeps: {}, badges: [], hardSyncFlash: false }),
}));

let badgeSeq = 0;
