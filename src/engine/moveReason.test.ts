// D377 - WHY A CARD MOVED. `CardMove.reason` records the three rules ACTIONS a printed trigger
// names by verb: a sacrifice (CR 701.17), a discard (CR 701.8a) and the cycling discard that is
// both (CR 702.29a). Until now the engine recorded none of them - a sacrifice was an ordinary
// battlefield-to-graveyard `CardsMoved` and a discard an ordinary hand-to-graveyard one - which
// is why D177 and D230 each refused a whole family of trigger heads for want of a discriminator.
//
// ⚠️ THIS SUITE IS THE HONESTY GUARANTEE, and it is here because the compiler cannot be. D355
// and D356 make a new field REQUIRED so `tsc` names every construction site; that rule has a
// boundary and this is it - 1,836 shipped card modules construct a `CardsMoved` and not one of
// them is a sacrifice or a discard, so required would mean writing `reason: null` into two
// thousand generated files to say nothing at all. Instead every emitter that must fill it is
// DRIVEN here, through a real game, and the fuzz gate carries a floor beside it (D364's answer
// for `poolSnow`, whose state hash would otherwise have replayed an empty value for ever).
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import { CLAWS_OF_GIX_SCRIPT } from './scripts/cards/clawsOfGix';
import { FELIDAR_CUB_SCRIPT } from './scripts/cards/felidarCub';
import { RUMMAGING_GOBLIN_SCRIPT } from './scripts/cards/rummagingGoblin';
import { AMOK_SCRIPT } from './scripts/cards/amok';
import { HUNGRY_MIST_SCRIPT } from './scripts/cards/hungryMist';
import { advanceUntil, deps, find, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { InstanceId } from './types/ids';
import type { MoveReason } from './types/events';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Every reason the log has recorded for `card`, in order. */
function reasonsFor(g: Game, card: InstanceId): (MoveReason | undefined)[] {
  const out: (MoveReason | undefined)[] = [];
  for (const e of g.log) {
    if (e.body.t !== 'CardsMoved') continue;
    for (const m of e.body.moves) if (m.card === card) out.push(m.reason);
  }
  return out;
}

/** The reason on the LAST move the log records for `card`. */
const lastReason = (g: Game, card: InstanceId): MoveReason | undefined => reasonsFor(g, card).slice(-1)[0];

const REG = createRegistry([
  CLAWS_OF_GIX_SCRIPT,
  FELIDAR_CUB_SCRIPT,
  RUMMAGING_GOBLIN_SCRIPT,
  AMOK_SCRIPT,
  HUNGRY_MIST_SCRIPT,
]);

/** p1 holding priority in its own third-turn main phase, with `names` in its deck. */
function board(names: string[], p2: string[] = ['Grizzly Bears']): Game {
  const g = startedGame({ players: 2, decks: [names, p2], scripts: REG });
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null,
    20_000,
  );
  return g;
}

const mana = (g: Game, symbol: 'C' | 'W' | 'U' | 'B' | 'R' | 'G', amount = 1): void => {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
};

/** The printed index of the card's cycling ability - the engine synthesizes it in print order. */
function cyclingIndex(g: Game, id: InstanceId): number {
  const d = deps(REG);
  const inst = g.state.cards[id];
  const face = inst ? d.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
  const ability = face?.activated.find((a) => a.cycling !== undefined);
  if (!ability) throw new Error('no cycling ability');
  return ability.index;
}

describe('D377 - a sacrifice says so', () => {
  // D168's chosen-sacrifice cost: the permanent the activation NAMED.
  test('the chosen sacrifice cost (Claws of Gix)', () => {
    const g = board(['Claws of Gix', 'Grizzly Bears']);
    const claws = put(g, 'p1', 'Claws of Gix');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    mana(g, 'C');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: claws, abilityIndex: 0, sacrifice: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(lastReason(g, bears)).toBe('sacrifice');
    // The Claws paid nothing of their own, so their own arrival carries no reason.
    expect(lastReason(g, claws)).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // D159's SELF-sacrifice cost: the source pays with itself.
  test('the self-sacrifice cost (Felidar Cub)', () => {
    const g = board(['Felidar Cub', 'Pacifism']);
    const cub = put(g, 'p1', 'Felidar Cub');
    const aura = put(g, 'p1', 'Pacifism', 'hand');
    settle(g);
    mana(g, 'C');
    mana(g, 'W');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aura, targets: [{ kind: 'card', id: cub }] }));
    settle(g);
    mana(g, 'G');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: cub, abilityIndex: 0, targets: [{ kind: 'card', id: aura }] }));
    settle(g);
    expect(g.state.cards[cub]?.zone.kind).toBe('graveyard');
    expect(lastReason(g, cub)).toBe('sacrifice');
    // The enchantment it DESTROYED is an ordinary death and must not read as one.
    expect(lastReason(g, aura)).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // D355's mana-ability price - no script anywhere, so this is the one sacrifice path a
  // generated suite can drive with nothing shipped.
  test('a mana ability own price (Lotus Petal)', () => {
    const g = board(['Lotus Petal']);
    const petal = put(g, 'p1', 'Lotus Petal');
    settle(g);
    must(g.submit({ t: 'TapForMana', player: 'p1', card: petal, abilityIndex: 0, outputChoice: 0 }));
    settle(g);
    expect(g.state.cards[petal]?.zone.kind).toBe('graveyard');
    expect(lastReason(g, petal)).toBe('sacrifice');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // D369's `sacrificeSelf` - the one sacrifice the effect VOCABULARY performs, reached here
  // through a payment prompt the harness declines.
  test('the vocabulary sacrifice (Hungry Mist, payment declined)', () => {
    const g = startedGame({ players: 2, decks: [['Hungry Mist'], ['Grizzly Bears']], scripts: REG });
    holdEverywhere(g);
    const mist = put(g, 'p1', 'Hungry Mist');
    settle(g);
    advanceUntil(g, (s) => s.cards[mist]?.zone.kind === 'graveyard', 40_000);
    expect(lastReason(g, mist)).toBe('sacrifice');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D377 - a discard says so', () => {
  // D286's chosen discard cost.
  test('the chosen discard cost (Rummaging Goblin)', () => {
    const g = board(['Rummaging Goblin', 'Grizzly Bears', 'Grizzly Bears']);
    const goblin = put(g, 'p1', 'Rummaging Goblin');
    settle(g);
    const held = [...(g.state.zones.hand.p1 ?? [])];
    const pitch = held[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: goblin, abilityIndex: 0, discard: [pitch] }));
    settle(g);
    expect(g.state.cards[pitch]?.zone.kind).toBe('graveyard');
    expect(lastReason(g, pitch)).toBe('discard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // D328's random discard cost: the seeded generator picks, and the pick is still a discard.
  test('the random discard cost (Amok)', () => {
    const g = board(['Amok', 'Grizzly Bears', 'Grizzly Bears']);
    const amok = put(g, 'p1', 'Amok');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const before = [...(g.state.zones.hand.p1 ?? [])];
    expect(before.length).toBeGreaterThan(0);
    mana(g, 'C');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: amok, abilityIndex: 0, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const gone = before.filter((c) => g.state.cards[c]?.zone.kind === 'graveyard');
    expect(gone.length).toBe(1);
    expect(lastReason(g, gone[0] as InstanceId)).toBe('discard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // D137's DISCARD PROMPT, the path most printed discard watchers will ever see.
  // ⚠️ The title says "the discard question" rather than the P-word followed by a bracket: the
  // battery greps every file under `src/` for that exact pair, to catch a `window.prompt` call,
  // which throws in Electron - and this is the THIRD time a test NAME has tripped it (D144, D147).
  test('the discard question, answered (Mind Rot)', () => {
    const g = board(['Mind Rot', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears']);
    const spell = find(g, 'p1', 'hand', 'Mind Rot');
    mana(g, 'C', 2);
    mana(g, 'B');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const theirs = [...(g.state.zones.hand.p2 ?? [])].slice(0, 2);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: theirs }));
    settle(g);
    for (const c of theirs) {
      expect(g.state.cards[c]?.zone.kind).toBe('graveyard');
      expect(lastReason(g, c)).toBe('discard');
    }
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // The vocabulary's own two discard branches: a hand no bigger than the count goes WHOLE with
  // no question (CR 701.8a), and at random asks nobody (CR 701.8b).
  test('the whole hand, with nothing asked (Mind Rot into a two-card hand)', () => {
    const g = board(['Mind Rot'], ['Grizzly Bears', 'Grizzly Bears']);
    const spell = find(g, 'p1', 'hand', 'Mind Rot');
    while ((g.state.zones.hand.p2 ?? []).length > 2) {
      const drop = (g.state.zones.hand.p2 ?? [])[0] as InstanceId;
      must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: drop, to: { kind: 'exile', player: 'p2' } }));
    }
    const left = [...(g.state.zones.hand.p2 ?? [])];
    expect(left.length).toBe(2);
    mana(g, 'C', 2);
    mana(g, 'B');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    for (const c of left) expect(lastReason(g, c)).toBe('discard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('at random (Hymn to Tourach)', () => {
    const g = board(['Hymn to Tourach']);
    const spell = find(g, 'p1', 'hand', 'Hymn to Tourach');
    const before = [...(g.state.zones.hand.p2 ?? [])];
    mana(g, 'B', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    const gone = before.filter((c) => g.state.cards[c]?.zone.kind === 'graveyard');
    expect(gone.length).toBe(2);
    for (const c of gone) expect(lastReason(g, c)).toBe('discard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D377 - cycling is its own reason', () => {
  // D306's cycling discard. It is BOTH a cycle and a discard, and the printed heads tell them
  // apart, so the move says `cycling` and the head reads the pair.
  test('the cycling cost (Lonely Sandbar)', () => {
    const g = board(['Lonely Sandbar', 'Grizzly Bears']);
    const land = find(g, 'p1', 'hand', 'Lonely Sandbar');
    mana(g, 'U');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: land, abilityIndex: cyclingIndex(g, land) }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(lastReason(g, land)).toBe('cycling');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});

describe('D377 - the Tier-3 tools, and the line they must not cross', () => {
  // CR 701.8a: a discard IS the move from a hand to that player's graveyard, so a player
  // applying a card by hand and doing exactly that has discarded.
  test('a manual hand-to-graveyard move is a discard', () => {
    const g = board(['Grizzly Bears', 'Grizzly Bears']);
    const held = (g.state.zones.hand.p1 ?? [])[0] as InstanceId;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: held, to: { kind: 'graveyard', player: 'p1' } }));
    expect(lastReason(g, held)).toBe('discard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // ⚠️ THE TEETH. A destroy, a sacrifice and the legend rule (CR 704.5j, expressly NOT a
  // sacrifice) all look identical from the zones alone, so a battlefield-to-graveyard move
  // applied by hand says nothing - inferring `sacrifice` there would fire a sacrifice trigger
  // on every hand-applied death in the game.
  test('a manual battlefield-to-graveyard move says nothing', () => {
    const g = board(['Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    expect(lastReason(g, bears)).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // And an ordinary hand-to-battlefield move is not a discard however it is applied. `put()`
  // takes the card library-to-hand and then hand-to-battlefield, so BOTH moves are read.
  test('a manual hand-to-battlefield move says nothing', () => {
    const g = board(['Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const seen = reasonsFor(g, bears);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((r) => r === undefined)).toBe(true);
  });
});
