// The view contract — the ONLY thing the table renders from, and the only thing
// the choreographer consumes.
//
// ⚠️ This file is the M2↔M3 seam. In M2 the views and events come from
// `src/view/fixtures/` (canned scenarios, no rules). In M3 they come from
// `src/engine/project.ts` and the real event log. Nothing in `src/ui/` may know
// which — that is the whole point of the seam, and it is what lets the animation
// feel be judged before a single rule exists.
//
// Consequences that shaped these shapes:
//
//  • `CardView.card` is `null` when the card is hidden from `me`. Projection is
//    the hidden-information boundary (a bug there leaks hands), so hiddenness is
//    represented by the ABSENCE of data, not by a flag the UI must remember to
//    honour. A component cannot accidentally render an opponent's hand because
//    there is nothing there to render.
//  • Zones are ordered id arrays and cards live in one flat map. Every zone
//    change is then an id splice, and a card is reachable in O(1) from the
//    stack, from combat, and from an attachment — all of which hold ids.
//  • Every event carries `stepId`. Events sharing a stepId are ONE group to the
//    choreographer, which is what makes LIFO stack resolution visibly ordered
//    while independent things still overlap.

import type { CardData, ColorLetter } from '../data/cardTypes';

export type PlayerId = string;
export type InstanceId = string;

export type ZoneKind = 'hand' | 'bf' | 'gy' | 'exile' | 'lib' | 'cmd';
/** `'stack'` is shared; every other zone belongs to exactly one player. */
export type ZoneId = `${ZoneKind}:${PlayerId}` | 'stack';

export function zoneId(kind: ZoneKind, player: PlayerId): ZoneId {
  return `${kind}:${player}`;
}

/** Split a ZoneId back into its parts. `'stack'` has no owner. */
export function parseZone(id: ZoneId): { kind: ZoneKind | 'stack'; player: PlayerId | null } {
  if (id === 'stack') return { kind: 'stack', player: null };
  const cut = id.indexOf(':');
  return { kind: id.slice(0, cut) as ZoneKind, player: id.slice(cut + 1) };
}

export type ManaSymbol = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export const MANA_SYMBOLS: ManaSymbol[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export type PhaseId =
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'beginCombat'
  | 'attackers'
  | 'blockers'
  | 'combatDamage'
  | 'endCombat'
  | 'main2'
  | 'end'
  | 'cleanup';

/** The five phases of a turn, over the twelve steps below. CR 500.1. */
export type PhaseGroupId = 'beginning' | 'main1' | 'combat' | 'main2' | 'ending';

export interface PhaseSpec {
  id: PhaseId;
  label: string;
  /** Short form for the phase track at narrow widths. */
  short: string;
  /**
   * What the track prints under its group header. Shorter than `label` because
   * the header above already says which phase this belongs to — "Attackers"
   * under COMBAT reads as "declare attackers" without spending the width.
   */
  step: string;
  group: PhaseGroupId;
}

/** In turn order. The track renders exactly this, so it is data, not JSX. */
export const PHASES: PhaseSpec[] = [
  { id: 'untap', label: 'Untap', short: 'UN', step: 'Untap', group: 'beginning' },
  { id: 'upkeep', label: 'Upkeep', short: 'UP', step: 'Upkeep', group: 'beginning' },
  { id: 'draw', label: 'Draw', short: 'DR', step: 'Draw', group: 'beginning' },
  { id: 'main1', label: 'Main 1', short: 'M1', step: 'Main', group: 'main1' },
  { id: 'beginCombat', label: 'Begin combat', short: 'BC', step: 'Begin', group: 'combat' },
  { id: 'attackers', label: 'Declare attackers', short: 'DA', step: 'Attackers', group: 'combat' },
  { id: 'blockers', label: 'Declare blockers', short: 'DB', step: 'Blockers', group: 'combat' },
  { id: 'combatDamage', label: 'Combat damage', short: 'CD', step: 'Damage', group: 'combat' },
  { id: 'endCombat', label: 'End combat', short: 'EC', step: 'End', group: 'combat' },
  { id: 'main2', label: 'Main 2', short: 'M2', step: 'Main', group: 'main2' },
  { id: 'end', label: 'End step', short: 'EN', step: 'End step', group: 'ending' },
  { id: 'cleanup', label: 'Cleanup', short: 'CL', step: 'Cleanup', group: 'ending' },
];

export interface PhaseGroup {
  id: PhaseGroupId;
  label: string;
  /**
   * How many consecutive entries of `PHASES` belong to it. The steps of a phase
   * are contiguous, so a span is all the track needs to line the two rows up.
   */
  span: number;
}

/**
 * The header row of the phase track. Derived from `PHASES` at module scope
 * rather than written out twice, so the two can never disagree about which
 * steps belong to which phase.
 */
export const PHASE_GROUPS: PhaseGroup[] = (() => {
  const labels: Record<PhaseGroupId, string> = {
    beginning: 'Beginning',
    main1: 'Main 1',
    combat: 'Combat',
    main2: 'Main 2',
    ending: 'Ending',
  };
  const out: PhaseGroup[] = [];
  for (const p of PHASES) {
    const last = out[out.length - 1];
    if (last && last.id === p.group) last.span += 1;
    else out.push({ id: p.group, label: labels[p.group], span: 1 });
  }
  return out;
})();

/** Which battlefield band a permanent belongs in. See ui-animation-spec §3. */
export type BandKind = 'combat' | 'support';
/** Left-to-right clusters inside the support band. */
export type SupportCluster = 'land' | 'artifact' | 'enchantment';

export interface CardView {
  instanceId: InstanceId;
  /**
   * Oracle data, or null when this card is hidden from the viewing player.
   * A hidden card still occupies its zone (so counts and geometry are right)
   * but exposes nothing about itself.
   */
  card: CardData | null;
  faceIndex: number;
  /** Face-down on the battlefield, or in a zone the viewer cannot see into. */
  faceDown: boolean;
  controller: PlayerId;
  owner: PlayerId;
  tapped: boolean;
  summoningSick: boolean;
  /** Damage marked this turn. Cleared at cleanup by the engine, not by us. */
  damage: number;
  /** '+1/+1', 'loyalty', 'charge', … */
  counters: Record<string, number>;
  /** CURRENT power/toughness after counters and effects — never the printed value. */
  power: number | null;
  toughness: number | null;
  /** Aura/Equipment host, so the UI can tuck it under that card. */
  attachedTo: InstanceId | null;
  isCommander: boolean;
  isToken: boolean;
  /** Set while this permanent is attacking, so the lane can draw it. */
  attacking: PlayerId | null;
  /**
   * Every attacker this permanent is blocking, in the engine's damage-assignment
   * order. Empty while it is not blocking.
   *
   * ⚠️ AN ARRAY BECAUSE ONE CREATURE CAN BLOCK SEVERAL, and this was a single
   * `InstanceId` until it became clear no client could answer the
   * `orderAttackers` prompt — which asks for exactly this list. `GameState` has
   * modelled it as `BlockerDecl.attackerOrder` since M3; the projection was
   * throwing all but the first away with `attackerOrder[0]`, so the view could
   * not express the answer to a question the engine knows how to ask. See D125.
   *
   * ⚠️ The ORDER is load-bearing, not incidental: `assignBlockerDamage` divides
   * the blocker's power down this list, so re-sorting it changes who dies.
   */
  blocking: readonly InstanceId[];
}

export interface SeatView {
  playerId: PlayerId;
  name: string;
  life: number;
  /** Commander damage RECEIVED, keyed by the player who dealt it. */
  cmdDamage: Record<PlayerId, number>;
  /**
   * Poison counters. Ten is a loss, exactly like 0 life.
   *
   * ⚠️ Added in M5 with infect/toxic (D68), and it was missing before that in a
   * way that mattered: the poison SBA has existed since M3 and the Tier-3 manual
   * tool could already set it, so a player could be killed by a number that
   * appeared nowhere on screen. Any losing condition the engine enforces has to
   * be visible before it fires.
   */
  poison: number;
  manaPool: Record<ManaSymbol, number>;
  /**
   * Colour identity of this seat's commander. Drives the nameplate's gradient
   * underline — quietly the most useful use of colour in the app, because it is
   * how you tell four pods apart at a glance.
   */
  identity: ColorLetter[];
  lost: boolean;
}

export interface StackItemView {
  stackItemId: string;
  /** null for an activated/triggered ability, which is a chit rather than a card. */
  instanceId: InstanceId | null;
  label: string;
  controller: PlayerId;
  identity: ColorLetter[];
  /**
   * What this spell or ability is aimed at, KEEPING THE KIND.
   *
   * ⚠️ This used to be a bare `string[]` with the comment "instance ids or
   * player ids", which made drawing a target arrow a guess: is `"p2"` a seat or a
   * token somebody named `p2`? The engine's `StackObject.targets` has always been
   * typed, so flattening it at the projection threw away information the UI then
   * had to reinvent — and would have got wrong the first time the two id spaces
   * collided.
   */
  targets: { kind: 'card' | 'player' | 'stack'; id: string }[];
}

export interface LogEntry {
  id: number;
  text: string;
  /**
   * WHO the line is about — the edge bar's colour, taken from this seat's
   * commander identity. `null` only for a line that genuinely belongs to
   * nobody ("The game is a draw."), never as a shrug.
   *
   * ⚠️ The bar used to be keyed to `identity` below, which is the CARD's
   * colours. That left the majority of the log grey, because most lines are not
   * about a card at all — turn markers, draws, keeps, mulligans — and it made
   * the one question you scan a log for ("who did that") the one thing the
   * colour did not answer.
   */
  player: PlayerId | null;
  /** The card's own colours, when the entry is about a specific card. */
  identity: ColorLetter[];
  /**
   * True for a Tier-3 manual action. Rendered distinctly (wrench glyph, warn
   * colour) so a pod can always see what was automated and what was hand-waved.
   * In a friends game that is a trust feature, not a nicety.
   */
  manual: boolean;
}

export interface PlayerView {
  /** Whose view this is. Everything hidden is hidden *from this player*. */
  me: PlayerId;
  /** Clockwise around the table, starting at `me`. */
  seatOrder: PlayerId[];
  seats: Record<PlayerId, SeatView>;
  cards: Record<InstanceId, CardView>;
  /** Ordered membership. A zone with no entry is empty. */
  zones: Partial<Record<ZoneId, InstanceId[]>>;
  /** Bottom-first, so the LAST entry is the top of the stack. */
  stack: StackItemView[];
  turn: { active: PlayerId; phase: PhaseId; turnNumber: number };
  priority: PlayerId | null;
  log: LogEntry[];
  /** Counts for zones the viewer cannot see into (own library, others' hands). */
  hiddenCounts: Partial<Record<ZoneId, number>>;
  /**
   * The top of MY OWN library that I am currently looking at, TOP FIRST.
   *
   * ⚠️ The one ordered thing about a library that ever reaches a client, and it
   * is not a leak: these are exactly the cards already revealed to this viewer,
   * which projection has been handing over as `cards` entries since M3. What was
   * missing was the ORDER — and a scry that shows you three cards in a
   * dictionary's order is not a scry.
   *
   * ⚠️ It is the revealed PREFIX from the top and stops at the first card that
   * is not revealed, so a card revealed from deeper in the library (a tutor)
   * never turns into a phantom "top of your library".
   */
  peek: InstanceId[];
}

// ── Events ───────────────────────────────────────────────────────────────────
//
// Each event is an animation cue. That is not a coincidence: the engine's
// append-only log exists for replay, reconnect and rewind, and the cue stream
// falls out of it for free. `stepId` is the grouping key.

interface Base {
  stepId: number;
}

export type EngineEvent =
  | (Base & { t: 'CardDrawn'; player: PlayerId; instanceId: InstanceId })
  | (Base & {
      t: 'CardMoved';
      instanceId: InstanceId;
      from: ZoneId;
      to: ZoneId;
      /** Face-up on arrival? Drives the mid-flight flip. */
      faceUpAtEnd: boolean;
    })
  | (Base & {
      t: 'SpellCast';
      instanceId: InstanceId;
      from: ZoneId;
      controller: PlayerId;
      stackItemId: string;
    })
  | (Base & { t: 'AbilityActivated'; sourceInstanceId: InstanceId; stackItemId: string })
  | (Base & {
      t: 'StackResolved';
      stackItemId: string;
      instanceId: InstanceId | null;
      /** What it was aimed at — the assisted offer needs it after the card has moved. */
      targets: { kind: 'card' | 'player' | 'stack'; id: string }[];
      /** Where the card went — battlefield for a permanent, graveyard otherwise. */
      to: ZoneId | null;
      /**
       * WHOSE spell it was. `null` only for a fizzle or a counter, which carry
       * no `instanceId` either.
       *
       * ⚠️ The assisted offer needs this for the same reason it needs `targets`,
       * and needs it MORE: without it the offer was applied by whoever was
       * looking at the table, which in a hotseat is regularly not the player who
       * cast the spell. See D120.
       */
      controller: PlayerId | null;
    })
  | (Base & { t: 'PermanentTapped'; instanceId: InstanceId })
  | (Base & { t: 'PermanentUntapped'; instanceId: InstanceId })
  | (Base & { t: 'PermanentEntered'; instanceId: InstanceId; isLand: boolean })
  | (Base & {
      t: 'DamageDealt';
      /** An instance id, or a player id when `targetKind` is 'player'. */
      target: string;
      targetKind: 'card' | 'player';
      amount: number;
      /** Commander damage gets its own violet treatment and matrix cell. */
      commander: boolean;
      source: InstanceId | null;
    })
  | (Base & { t: 'LifeChanged'; player: PlayerId; from: number; to: number })
  | (Base & { t: 'CounterChanged'; instanceId: InstanceId; kind: string; delta: number })
  | (Base & { t: 'ManaAdded'; player: PlayerId; symbol: ManaSymbol; amount: number })
  | (Base & { t: 'ManaPoolEmptied'; player: PlayerId })
  | (Base & {
      t: 'AttackersDeclared';
      attackers: { instanceId: InstanceId; defender: PlayerId }[];
    })
  | (Base & {
      t: 'BlockersDeclared';
      blocks: { blocker: InstanceId; attacker: InstanceId }[];
    })
  | (Base & { t: 'PermanentDied'; instanceId: InstanceId })
  | (Base & { t: 'TokenCreated'; instanceId: InstanceId })
  | (Base & { t: 'CardRevealed'; instanceId: InstanceId })
  | (Base & { t: 'PhaseChanged'; phase: PhaseId; turnNumber: number; active: PlayerId })
  | (Base & { t: 'PriorityChanged'; player: PlayerId | null })
  | (Base & { t: 'PlayerLost'; player: PlayerId; reason: string })
  | (Base & { t: 'Logged'; entry: LogEntry });

export type EventKind = EngineEvent['t'];

/** An empty view, for a table that has no game yet. Never null anywhere. */
export function emptyView(me: PlayerId = 'p1'): PlayerView {
  return {
    me,
    seatOrder: [],
    seats: {},
    cards: {},
    zones: {},
    stack: [],
    turn: { active: me, phase: 'main1', turnNumber: 1 },
    priority: me,
    log: [],
    hiddenCounts: {},
    peek: [],
  };
}

/** Ordered zone contents, without the caller needing to handle `undefined`. */
export function zoneCards(view: PlayerView, id: ZoneId): InstanceId[] {
  return view.zones[id] ?? [];
}

/**
 * Is this card on a battlefield — anyone's?
 *
 * ⚠️ Filed under its CONTROLLER, which is the one zone that can hold it (see
 * `project.ts`). Shared because two callers ask it about the same card for
 * different reasons — "may E turn this" and "may the panel offer to turn this" —
 * and two spellings of the same question is how they end up disagreeing.
 */
export function onBattlefield(view: PlayerView, id: InstanceId): boolean {
  const card = view.cards[id];
  return !!card && zoneCards(view, zoneId('bf', card.controller)).includes(id);
}

/**
 * Which band a permanent belongs in, and which support cluster.
 * Type-line driven so it works for any card without a rules engine.
 */
export function bandFor(card: CardData | null, faceIndex = 0): {
  band: BandKind;
  cluster: SupportCluster;
} {
  const type = (card?.faces[faceIndex] ?? card?.faces[0])?.typeLine ?? '';
  if (/\b(Creature|Planeswalker|Battle)\b/.test(type)) {
    return { band: 'combat', cluster: 'artifact' };
  }
  if (/\bLand\b/.test(type)) return { band: 'support', cluster: 'land' };
  if (/\bEnchantment\b/.test(type)) return { band: 'support', cluster: 'enchantment' };
  return { band: 'support', cluster: 'artifact' };
}
