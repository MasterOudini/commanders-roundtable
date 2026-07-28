// `diffView` / `applyPatch` — how one viewer's `PlayerView` crosses the wire
// after the first `Snapshot`.
//
// ⚠️ DELIBERATELY COARSE. One key per `cards.<id>`, per `seats.<id>`, per
// `zones.<zoneId>`, per `hiddenCounts.<zoneId>`, and whole-value for `me`,
// `seatOrder`, `stack`, `turn` and `priority`. A typical update touches one to
// four cards (~1 KB); a wrath touches thirty (~8 KB). That is ~150 lines with no
// JSON-Patch library and no operational transforms — and the coarseness is what
// makes it auditable: every key is either sent whole or not sent.
//
// ⚠️ `log` is the ONE exception, and it earns it. The narration window is 200
// entries (`MAX_NARRATION`), so sending it whole would put ~16 KB on the wire
// for the one or two lines a normal update adds. It is diffed as an append, and
// the append is VERIFIED by reconstructing the result and comparing before the
// short form is chosen — so a rewind, which rewrites the log rather than
// extending it, silently falls back to the whole array instead of producing a
// wrong one.
//
// ⚠️ REFERENTIAL IDENTITY APPLIES ON BOTH SIDES OF THE WIRE (D21). `applyPatch`
// only ever replaces the keys a patch names, so every untouched `CardView`,
// `SeatView` and zone array keeps its object identity on the client — which is
// what lets `React.memo` on `Card` match, and it is the difference between 0
// long frames and one per commit. A patch applier that rebuilt the view would
// reintroduce the single largest performance bug M2 ever found.
//
// ⚠️ `diffView` treats REFERENCE EQUALITY as "unchanged" for cards, seats and
// zones. That is exact rather than optimistic because `Projector` reuses an
// object only when every field compared equal (see `project.ts`); a fresh object
// may still be deep-equal, in which case the key is sent redundantly and the
// client ends up with the same value. Sound in one direction, cheap in the
// other — which is the correct trade for something that runs on every event.

import { hashOf } from './hash';
import type { InstanceId, PlayerId } from './types/ids';
import type {
  CardView,
  LogEntry,
  PlayerView,
  SeatView,
  StackItemView,
  ZoneId,
} from '../view/types';

/** Mirrors `MAX_NARRATION` in `reducer.ts`; the client applies the same window. */
const LOG_WINDOW = 200;

export interface ViewPatch {
  /** Must equal the client's `eventCount`, or the client asks for a snapshot. */
  readonly base: number;
  readonly next: number;
  readonly set: Readonly<Record<string, unknown>>;
  /** Keys removed — a card left this viewer's visibility, or a zone emptied. */
  readonly del: readonly string[];
}

/** Split `'cards.c41'` / `'zones.hand:p2'` on the FIRST dot — zone ids contain colons. */
function splitKey(key: string): { section: string; rest: string } {
  const dot = key.indexOf('.');
  return dot < 0 ? { section: key, rest: '' } : { section: key.slice(0, dot), rest: key.slice(dot + 1) };
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameTargets(
  a: readonly StackItemView['targets'][number][],
  b: readonly StackItemView['targets'][number][],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.kind !== b[i]?.kind || a[i]?.id !== b[i]?.id) return false;
  }
  return true;
}

function sameStack(a: readonly StackItemView[], b: readonly StackItemView[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (
      x.stackItemId !== y.stackItemId ||
      x.instanceId !== y.instanceId ||
      x.label !== y.label ||
      x.controller !== y.controller ||
      !sameStrings(x.identity, y.identity) ||
      !sameTargets(x.targets, y.targets)
    ) {
      return false;
    }
  }
  return true;
}

function sameLog(a: readonly LogEntry[], b: readonly LogEntry[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (x.id !== y.id || x.text !== y.text || x.manual !== y.manual || !sameStrings(x.identity, y.identity)) {
      return false;
    }
  }
  return true;
}

/** `[...prev, ...added].slice(-WINDOW)`, which is exactly what the reducer does. */
function appendWindowed(prev: readonly LogEntry[], added: readonly LogEntry[]): LogEntry[] {
  const joined = [...prev, ...added];
  return joined.length > LOG_WINDOW ? joined.slice(joined.length - LOG_WINDOW) : joined;
}

/**
 * Everything that changed between two projections of the SAME viewer.
 *
 * `base` and `next` are event counts, not view versions: the client refuses a
 * patch whose `base` is not the event count it already holds, because guessing
 * is how a one-frame desync becomes a permanent one.
 */
export function diffView(prev: PlayerView, next: PlayerView, base: number, nextCount: number): ViewPatch {
  const set: Record<string, unknown> = {};
  const del: string[] = [];

  if (prev.me !== next.me) set['me'] = next.me;
  if (!sameStrings(prev.seatOrder, next.seatOrder)) set['seatOrder'] = next.seatOrder;
  if (prev.priority !== next.priority) set['priority'] = next.priority;
  if (
    prev.turn.active !== next.turn.active ||
    prev.turn.phase !== next.turn.phase ||
    prev.turn.turnNumber !== next.turn.turnNumber
  ) {
    set['turn'] = next.turn;
  }
  if (!sameStack(prev.stack, next.stack)) set['stack'] = next.stack;

  // ── the log, as an append when it provably is one ──────────────────────────
  if (!sameLog(prev.log, next.log)) {
    const lastId = prev.log[prev.log.length - 1]?.id ?? -1;
    const added = next.log.filter((e) => e.id > lastId);
    if (added.length > 0 && sameLog(appendWindowed(prev.log, added), next.log)) {
      set['log+'] = added;
    } else {
      set['log'] = next.log;
    }
  }

  diffRecord(prev.cards, next.cards, 'cards', set, del);
  diffRecord(prev.seats, next.seats, 'seats', set, del);
  diffRecord(prev.zones, next.zones, 'zones', set, del);
  diffCounts(prev.hiddenCounts, next.hiddenCounts, set, del);

  return { base, next: nextCount, set, del };
}

function diffRecord<T>(
  prev: Readonly<Record<string, T | undefined>>,
  next: Readonly<Record<string, T | undefined>>,
  section: string,
  set: Record<string, unknown>,
  del: string[],
): void {
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (value === undefined) continue;
    if (prev[key] !== value) set[`${section}.${key}`] = value;
  }
  for (const key of Object.keys(prev)) {
    if (prev[key] !== undefined && next[key] === undefined) del.push(`${section}.${key}`);
  }
}

function diffCounts(
  prev: Partial<Record<ZoneId, number>>,
  next: Partial<Record<ZoneId, number>>,
  set: Record<string, unknown>,
  del: string[],
): void {
  for (const key of Object.keys(next) as ZoneId[]) {
    const value = next[key];
    if (value === undefined) continue;
    if (prev[key] !== value) set[`hiddenCounts.${key}`] = value;
  }
  for (const key of Object.keys(prev) as ZoneId[]) {
    if (prev[key] !== undefined && next[key] === undefined) del.push(`hiddenCounts.${key}`);
  }
}

/**
 * Apply a patch, reusing every object the patch did not name.
 *
 * ⚠️ The record spreads below are shallow ON PURPOSE: `{ ...view.cards }` copies
 * the map but keeps every `CardView` reference, so only the cards the patch
 * actually names become new objects. See the D21 note in the header.
 */
export function applyPatch(view: PlayerView, patch: ViewPatch): PlayerView {
  let cards: Record<InstanceId, CardView> | null = null;
  let seats: Record<PlayerId, SeatView> | null = null;
  let zones: Partial<Record<ZoneId, InstanceId[]>> | null = null;
  let hiddenCounts: Partial<Record<ZoneId, number>> | null = null;
  const top: Partial<PlayerView> = {};
  let log: LogEntry[] | null = null;

  for (const [key, value] of Object.entries(patch.set)) {
    const { section, rest } = splitKey(key);
    switch (section) {
      case 'cards':
        cards ??= { ...view.cards };
        cards[rest] = value as CardView;
        break;
      case 'seats':
        seats ??= { ...view.seats };
        seats[rest] = value as SeatView;
        break;
      case 'zones':
        zones ??= { ...view.zones };
        zones[rest as ZoneId] = value as InstanceId[];
        break;
      case 'hiddenCounts':
        hiddenCounts ??= { ...view.hiddenCounts };
        hiddenCounts[rest as ZoneId] = value as number;
        break;
      case 'log+':
        log = appendWindowed(log ?? view.log, value as LogEntry[]);
        break;
      case 'log':
        log = value as LogEntry[];
        break;
      case 'me':
        top.me = value as PlayerId;
        break;
      case 'seatOrder':
        top.seatOrder = value as PlayerId[];
        break;
      case 'priority':
        top.priority = value as PlayerId | null;
        break;
      case 'turn':
        top.turn = value as PlayerView['turn'];
        break;
      case 'stack':
        top.stack = value as StackItemView[];
        break;
      default:
        // An unknown key from a newer host. Ignoring it keeps the view
        // internally consistent; the `viewHash` comparison then fails and the
        // client resyncs — which is a diagnosis rather than a silent drift.
        break;
    }
  }

  for (const key of patch.del) {
    const { section, rest } = splitKey(key);
    switch (section) {
      case 'cards':
        cards ??= { ...view.cards };
        delete cards[rest];
        break;
      case 'seats':
        seats ??= { ...view.seats };
        delete seats[rest];
        break;
      case 'zones':
        zones ??= { ...view.zones };
        delete zones[rest as ZoneId];
        break;
      case 'hiddenCounts':
        hiddenCounts ??= { ...view.hiddenCounts };
        delete hiddenCounts[rest as ZoneId];
        break;
      default:
        break;
    }
  }

  return {
    ...view,
    ...top,
    ...(cards ? { cards } : {}),
    ...(seats ? { seats } : {}),
    ...(zones ? { zones } : {}),
    ...(hiddenCounts ? { hiddenCounts } : {}),
    ...(log ? { log } : {}),
  };
}

/**
 * The desync detector.
 *
 * ⚠️ Hashed over the card's PRINTING ID rather than its whole `CardData`. The
 * rendered view inlines ~2 KB of oracle text per card, so hashing it whole would
 * canonicalise ~100 KB on every single event on both the host and four clients,
 * for no extra discrimination: a printing id determines its `CardData`
 * completely, and a client that disagreed about that would have failed the
 * `oracleVersion` check at `Welcome`.
 */
export function viewHash(view: PlayerView): string {
  const cards: Record<string, unknown> = {};
  for (const [id, card] of Object.entries(view.cards)) {
    cards[id] = { ...card, card: card.card?.scryfallId ?? null };
  }
  return hashOf({ ...view, cards });
}
