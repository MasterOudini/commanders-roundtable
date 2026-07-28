// Event → beat-intent coalescing — PURE. Unit-tested.
//
// One engine step can emit a lot of events. Playing one animation per event gives
// you six sequential card flights for one draw, a queue of twelve identical taps,
// and a life total that restarts its count four times in a second. Coalescing is
// what turns a group of events into the beats a person would actually describe:
// "you drew six", "everything untapped", "you went to 31".
//
// ⚠️ The last rule is the one that matters most, and it is not an optimisation.
// A→B→C for one card in a single group flies ONLY the last hop. Cast → countered →
// graveyard is a real sequence, and without this rule you watch a card fly to a
// stack you already know it never stayed on, then fly off it again. The card ends
// where the engine says; the animation shows you that, once.

import type {
  EngineEvent,
  InstanceId,
  ManaSymbol,
  PhaseId,
  PlayerId,
  ZoneId,
} from '../../view/types';

export type BeatIntent =
  | { kind: 'draw'; player: PlayerId; instanceIds: InstanceId[] }
  | {
      kind: 'flight';
      instanceId: InstanceId;
      from: ZoneId;
      to: ZoneId;
      faceUpAtEnd: boolean;
      /** Which named beat to parameterise the generic flight as. */
      as: 'move' | 'cast' | 'resolve' | 'land';
    }
  | { kind: 'flourish'; instanceId: InstanceId | null; stackItemId: string }
  | { kind: 'tapSweep'; player: PlayerId; instanceIds: InstanceId[]; untap: boolean }
  | { kind: 'enter'; instanceId: InstanceId; isLand: boolean }
  | {
      kind: 'damage';
      target: string;
      targetKind: 'card' | 'player';
      amount: number;
      commander: boolean;
    }
  | { kind: 'life'; player: PlayerId; to: number }
  | { kind: 'counter'; instanceId: InstanceId; counter: string; delta: number }
  | { kind: 'attack'; attackers: { instanceId: InstanceId; defender: PlayerId }[] }
  | { kind: 'block'; blocks: { blocker: InstanceId; attacker: InstanceId }[] }
  | { kind: 'death'; instanceIds: InstanceId[] }
  | { kind: 'token'; instanceIds: InstanceId[] }
  | { kind: 'reveal'; instanceId: InstanceId }
  | { kind: 'phase'; phase: PhaseId }
  | { kind: 'mana'; player: PlayerId; symbol: ManaSymbol | null };

/** Events that move a specific card between zones — the multi-hop candidates. */
interface Hop {
  instanceId: InstanceId;
  from: ZoneId;
  to: ZoneId;
  faceUpAtEnd: boolean;
  as: 'move' | 'cast' | 'resolve' | 'land';
  order: number;
}

export function coalesce(events: EngineEvent[]): BeatIntent[] {
  const out: BeatIntent[] = [];

  const drawsByPlayer = new Map<PlayerId, InstanceId[]>();
  const tapsByPlayer = new Map<PlayerId, InstanceId[]>();
  const untapsByPlayer = new Map<PlayerId, InstanceId[]>();
  const lifeByPlayer = new Map<PlayerId, number>();
  const damageByTarget = new Map<string, { targetKind: 'card' | 'player'; amount: number; commander: boolean }>();
  const hopsByCard = new Map<InstanceId, Hop[]>();
  const deaths: InstanceId[] = [];
  const tokens: InstanceId[] = [];
  const entered: { instanceId: InstanceId; isLand: boolean }[] = [];
  const flourishes: { instanceId: InstanceId | null; stackItemId: string }[] = [];
  let order = 0;

  /** Which player controls this card, for tap coalescing. Falls back to a bucket. */
  const controllerOf = (id: InstanceId) => tapOwner.get(id) ?? 'unknown';
  const tapOwner = new Map<InstanceId, PlayerId>();

  for (const e of events) {
    order++;
    switch (e.t) {
      case 'CardDrawn': {
        const list = drawsByPlayer.get(e.player) ?? [];
        list.push(e.instanceId);
        drawsByPlayer.set(e.player, list);
        break;
      }
      case 'CardMoved': {
        pushHop(hopsByCard, {
          instanceId: e.instanceId,
          from: e.from,
          to: e.to,
          faceUpAtEnd: e.faceUpAtEnd,
          as: e.to.startsWith('bf:') && e.from.startsWith('hand:') ? 'land' : 'move',
          order,
        });
        break;
      }
      case 'SpellCast': {
        pushHop(hopsByCard, {
          instanceId: e.instanceId,
          from: e.from,
          to: 'stack',
          faceUpAtEnd: true,
          as: 'cast',
          order,
        });
        flourishes.push({ instanceId: e.instanceId, stackItemId: e.stackItemId });
        break;
      }
      case 'AbilityActivated': {
        // An ability is a chit, not a card: nothing flies, but the stack still
        // flourishes so you see that something went on it.
        flourishes.push({ instanceId: null, stackItemId: e.stackItemId });
        break;
      }
      case 'StackResolved': {
        if (e.instanceId && e.to) {
          pushHop(hopsByCard, {
            instanceId: e.instanceId,
            from: 'stack',
            to: e.to,
            faceUpAtEnd: true,
            as: 'resolve',
            order,
          });
        }
        break;
      }
      case 'PermanentTapped': {
        const p = controllerOf(e.instanceId);
        const list = tapsByPlayer.get(p) ?? [];
        list.push(e.instanceId);
        tapsByPlayer.set(p, list);
        break;
      }
      case 'PermanentUntapped': {
        const p = controllerOf(e.instanceId);
        const list = untapsByPlayer.get(p) ?? [];
        list.push(e.instanceId);
        untapsByPlayer.set(p, list);
        break;
      }
      case 'PermanentEntered':
        entered.push({ instanceId: e.instanceId, isLand: e.isLand });
        break;
      case 'DamageDealt': {
        const prev = damageByTarget.get(e.target);
        damageByTarget.set(e.target, {
          targetKind: e.targetKind,
          // Two hits on one creature in one step is ONE number, not two
          // overlapping ones fighting for the same 40 px of screen.
          amount: (prev?.amount ?? 0) + e.amount,
          commander: (prev?.commander ?? false) || e.commander,
        });
        break;
      }
      case 'LifeChanged':
        // Keep only the FINAL value. The counter retargets from wherever it is, so
        // queueing the intermediate steps would make it visibly stutter.
        lifeByPlayer.set(e.player, e.to);
        break;
      case 'CounterChanged':
        out.push({ kind: 'counter', instanceId: e.instanceId, counter: e.kind, delta: e.delta });
        break;
      case 'ManaAdded':
        out.push({ kind: 'mana', player: e.player, symbol: e.symbol });
        break;
      case 'ManaPoolEmptied':
        out.push({ kind: 'mana', player: e.player, symbol: null });
        break;
      case 'AttackersDeclared':
        out.push({ kind: 'attack', attackers: e.attackers });
        break;
      case 'BlockersDeclared':
        out.push({ kind: 'block', blocks: e.blocks });
        break;
      case 'PermanentDied':
        deaths.push(e.instanceId);
        break;
      case 'TokenCreated':
        tokens.push(e.instanceId);
        break;
      case 'CardRevealed':
        out.push({ kind: 'reveal', instanceId: e.instanceId });
        break;
      case 'PhaseChanged':
        out.push({ kind: 'phase', phase: e.phase });
        break;
      case 'PriorityChanged':
      case 'PlayerLost':
      case 'Logged':
        // HUD-only: the view commit is the whole animation. Deliberately produces
        // no beat, so priority and the log can NEVER be delayed by the queue.
        break;
    }
  }

  for (const [player, instanceIds] of drawsByPlayer) {
    out.push({ kind: 'draw', player, instanceIds });
  }
  for (const [player, instanceIds] of tapsByPlayer) {
    out.push({ kind: 'tapSweep', player, instanceIds, untap: false });
  }
  for (const [player, instanceIds] of untapsByPlayer) {
    out.push({ kind: 'tapSweep', player, instanceIds, untap: true });
  }

  // ⚠️ Multi-hop collapse. One flight per card, from where it started to where it
  // ended. See the file header for why this is correctness, not tidiness.
  for (const hops of hopsByCard.values()) {
    const sorted = [...hops].sort((a, b) => a.order - b.order);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    // Drawn cards are already covered by the coalesced draw beat above.
    out.push({
      kind: 'flight',
      instanceId: first.instanceId,
      from: first.from,
      to: last.to,
      faceUpAtEnd: last.faceUpAtEnd,
      // A collapsed multi-hop is a plain move: it is no longer "a cast", because
      // the card did not stay on the stack.
      as: sorted.length > 1 ? 'move' : last.as,
    });
  }

  for (const f of flourishes) out.push({ kind: 'flourish', ...f });
  for (const e of entered) out.push({ kind: 'enter', ...e });
  if (deaths.length > 0) out.push({ kind: 'death', instanceIds: deaths });
  if (tokens.length > 0) out.push({ kind: 'token', instanceIds: tokens });

  for (const [target, d] of damageByTarget) {
    out.push({ kind: 'damage', target, ...d });
  }
  for (const [player, to] of lifeByPlayer) {
    out.push({ kind: 'life', player, to });
  }

  return out;
}

function pushHop(map: Map<InstanceId, Hop[]>, hop: Hop): void {
  const list = map.get(hop.instanceId) ?? [];
  list.push(hop);
  map.set(hop.instanceId, list);
}

/**
 * Tap coalescing needs to know who controls each permanent, which the events do
 * not carry. The choreographer supplies it from the view before calling
 * `coalesce`; without it, taps from different players merge into one sweep across
 * two pods.
 */
export function coalesceWithControllers(
  events: EngineEvent[],
  controllerOf: (id: InstanceId) => PlayerId | undefined,
): BeatIntent[] {
  const out: BeatIntent[] = [];
  for (const intent of coalesce(events)) {
    if (intent.kind !== 'tapSweep') {
      out.push(intent);
      continue;
    }
    // Re-split the sweep by real controller.
    const byPlayer = new Map<PlayerId, InstanceId[]>();
    for (const id of intent.instanceIds) {
      const p = controllerOf(id) ?? intent.player;
      const list = byPlayer.get(p) ?? [];
      list.push(id);
      byPlayer.set(p, list);
    }
    for (const [player, instanceIds] of byPlayer) {
      out.push({ kind: 'tapSweep', player, instanceIds, untap: intent.untap });
    }
  }
  return out;
}
