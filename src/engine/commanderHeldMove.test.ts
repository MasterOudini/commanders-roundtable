// Copy to src/engine/ (imports are relative to that folder).
//
// D587 - THE HELD 903.9b MOVE, AFTER THE MERGE (FIX-LIST items 1, 2 and 6; the review's commander F1, F2, F4 and the
// cross-branch X11). A commander's move to its owner's hand or library is HELD and asked about first (CR 903.9b); the
// answer rewrites it and runs the batch on. Three ways that went wrong, each failing on master aedb4001:
//
// - F1: the answer treated the move as stale when the card's zone player differed from the move's `from.player` - but the
//   battlefield is one shared array, and a vocabulary move names no player (Snap, a dash return), a script names the
//   controller now (a stolen commander's zone still names its owner). Either answer silently DROPPED the move.
// - F2: an effect that shuffles cards into a library works its order out (a wheel its draws too) with the commander already
//   there; sent home instead, it sat in the command zone AND the library (ManualMoveZone's shuffle, Oblation, Timetwister).
// - X11/F4: a Tier-3 move that raised a hold of its own replaced the question up (Grim Affliction's proliferate, lost) or
//   overwrote the held move (its batch orphaned); a question raised over a held move and answered left the move held with
//   nothing asking; and a held card moved on by hand was re-applied from its old zone (two zones at once).
//
// Proven on real cards (Snap, Zurgo Bellstriker's dash, Hallowed Burial, Oblation, Timetwister, Grim Affliction, Godless
// Shrine), with the invariant checker on after every event (a card in two zones throws) and the replay hash on each.
import { describe, expect, test } from 'vitest';
import { checkInvariants } from './invariants';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { HALLOWED_BURIAL_SCRIPT } from './scripts/cards/hallowedBurial';
import { OBLATION_SCRIPT } from './scripts/cards/oblation';
import { advanceUntil, holdEverywhere, must, put, startedGame, type TestGameOpts } from './testing/harness';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';
import type { GameOptions, GameState } from './types/state';

const LANDS = ['Plains', 'Island', 'Swamp', 'Plains', 'Island', 'Swamp'];
const SCRIPTS = createRegistry([HALLOWED_BURIAL_SCRIPT, OBLATION_SCRIPT]);

const settled = (s: GameState) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null;
/** Pass priority until a question is up or nothing is left to do - never answering one. */
const untilAsked = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting !== null || settled(s), 20_000);
/** Pass priority and answer every question the simplest way until nothing is left to do. */
const settle = (g: Game) => advanceUntil(g, settled, 20_000);

function table(opts: { mode?: GameOptions['commanderZoneReplacement']; decks: NonNullable<TestGameOpts['decks']>; commanders?: TestGameOpts['commanders'] }): Game {
  const g = startedGame({
    players: 2,
    decks: opts.decks,
    ...(opts.commanders !== undefined ? { commanders: opts.commanders } : {}),
    scripts: SCRIPTS,
    options: { commanderZoneReplacement: opts.mode ?? 'ask', maxHandSize: null },
  });
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}

const commanderOf = (g: Game, p: PlayerId, i = 0) => (g.state.zones.command[p] ?? [])[i] as InstanceId;
const onto = (g: Game, p: PlayerId, card: InstanceId) => {
  must(g.submit({ t: 'ManualMoveCard', player: p, card, to: { kind: 'battlefield', player: p } }));
  settle(g);
};
const mana = (g: Game, symbol: 'W' | 'U' | 'B' | 'R' | 'C', amount: number) =>
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
const choose = (g: Game, player: PlayerId, toCommandZone: boolean, always: boolean) =>
  must(g.submit({ t: 'CommanderZoneChoice', player, toCommandZone, always }));
/** p1 casts Hallowed Burial, and play goes on until the next question. */
function burial(g: Game): void {
  const spell = put(g, 'p1', 'Hallowed Burial', 'hand');
  mana(g, 'W', 2);
  mana(g, 'C', 3);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  untilAsked(g);
}
/** The 903.9b question that is up: its owner, its card, the zone it would come from and the one it would go to. */
function heldQuestion(g: Game) {
  const q = g.state.priority.awaiting;
  if (q?.kind !== 'commanderZoneChoice') throw new Error("expected the commander's question, got " + (q?.kind ?? 'none'));
  return { player: q.player, card: q.queue[0]?.card, from: q.queue[0]?.from, instead: q.instead?.kind };
}

/** Every zone change the log records for one card, in order. */
const pathOf = (g: Game, id: InstanceId) =>
  g.log.flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves.filter((m) => m.card === id).map((m) => `${m.from.kind}>${m.to.kind}`) : []));
/** How many times the commander question was raised. */
const asked = (g: Game) => g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'commanderZoneChoice').length;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;
const libraryOf = (g: Game, p: PlayerId) => g.state.zones.library[p] ?? [];
const replays = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

describe('F1 - the held move is live while the commander is still on the battlefield, whoever its move names', () => {
  for (const home of [true, false]) {
    test(`Snap (a vocabulary bounce: its battlefield move names no player), answered ${home ? '"To command zone"' : '"Leave it"'}`, () => {
      const g = table({ decks: [['Snap', ...LANDS], LANDS] });
      const kess = commanderOf(g, 'p1');
      onto(g, 'p1', kess);
      const snap = put(g, 'p1', 'Snap', 'hand');
      mana(g, 'U', 1);
      mana(g, 'C', 1);
      must(g.submit({ t: 'CastSpell', player: 'p1', card: snap, targets: [{ kind: 'card', id: kess }] }));
      untilAsked(g);
      const q = heldQuestion(g);
      expect(q.instead, 'asked about its hand, before the move').toBe('hand');
      expect(q.from, 'the vocabulary move names no player').toEqual({ kind: 'battlefield', player: null });
      expect(g.state.cards[kess]?.zone, "the permanent's zone names the player it entered under").toEqual({ kind: 'battlefield', player: 'p1' });
      choose(g, 'p1', home, false);
      settle(g);
      expect(zoneOf(g, kess), 'the answer moves it - it was dropped, and the commander stayed on the battlefield').toBe(home ? 'command' : 'hand');
      expect(pathOf(g, kess)).toEqual(['command>battlefield', home ? 'battlefield>command' : 'battlefield>hand']);
      expect(zoneOf(g, snap)).toBe('graveyard');
      replays(g);
    });
  }

  test(`a dashed commander's end-step return (the dash's delayed self-bounce): "To command zone" sends it home`, () => {
    const g = table({ decks: [LANDS, LANDS], commanders: [['Zurgo Bellstriker'], ['Krenko, Mob Boss']] });
    const zurgo = commanderOf(g, 'p1');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: zurgo, to: { kind: 'hand', player: 'p1' } }));
    expect(asked(g), 'a move out of the command zone is not asked about').toBe(0);
    mana(g, 'R', 1);
    mana(g, 'C', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: zurgo, alternative: true }));
    settle(g);
    expect(zoneOf(g, zurgo)).toBe('battlefield');
    expect(g.state.cards[zurgo]?.dashed).toBe(true);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'commanderZoneChoice' || s.turn.turnNumber > 1, 20_000);
    const q = heldQuestion(g);
    expect(q.instead, 'the dash return asks at the end step').toBe('hand');
    expect(q.from).toEqual({ kind: 'battlefield', player: null });
    choose(g, 'p1', true, false);
    expect(zoneOf(g, zurgo), 'home - the return was dropped, and a dashed commander stayed for good').toBe('command');
    settle(g);
    expect(pathOf(g, zurgo)).toEqual(['command>hand', 'hand>stack', 'stack>battlefield', 'battlefield>command']);
    replays(g);
  });

  test('a stolen commander tucked by Hallowed Burial (its move names the controller, its zone the owner): "To command zone" sends it home', () => {
    const g = table({ decks: [['Hallowed Burial', 'Grizzly Bears', ...LANDS], LANDS] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    must(g.submit({ t: 'ManualSetController', player: 'p2', card: kess, controller: 'p2' }));
    expect(g.state.cards[kess]?.controller).toBe('p2');
    expect(g.state.cards[kess]?.zone, 'a control change leaves the zone as it was').toEqual({ kind: 'battlefield', player: 'p1' });
    burial(g);
    const q = heldQuestion(g);
    expect(q.player, 'its owner is asked').toBe('p1');
    expect(q.from, "the script names the controller now").toEqual({ kind: 'battlefield', player: 'p2' });
    choose(g, 'p1', true, false);
    settle(g);
    expect(zoneOf(g, kess), 'home - the move was dropped, and the commander stayed while everything else was tucked').toBe('command');
    expect(zoneOf(g, bears)).toBe('library');
    replays(g);
  });
});

describe('F2 - a commander sent home is not left in a shuffle order the batch computed with it in the library', () => {
  test('ManualMoveZone shuffles a graveyard holding a declined commander into the library; "To command zone": one zone, not two', () => {
    const g = table({ decks: [['Grizzly Bears', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'graveyard', player: 'p1' } }));
    untilAsked(g);
    expect(g.state.priority.awaiting?.kind, "903.9a's question").toBe('commanderZoneChoice');
    choose(g, 'p1', false, false);
    settle(g);
    expect(zoneOf(g, kess), 'left in the graveyard').toBe('graveyard');
    must(g.submit({ t: 'ManualMoveZone', player: 'p1', target: 'p1', from: 'graveyard', to: 'library', shuffle: true }));
    expect(heldQuestion(g).instead, 'the move into the library is held and asked about').toBe('library');
    // Before the fix the answer threw here: the shuffle order still listed the commander (InvariantError, two zones).
    choose(g, 'p1', true, false);
    expect(zoneOf(g, kess)).toBe('command');
    expect(libraryOf(g, 'p1'), 'the shuffle order dropped it').not.toContain(kess);
    expect(zoneOf(g, bears), 'the rest of the pile was shuffled in').toBe('library');
    expect(libraryOf(g, 'p1')).toContain(bears);
    expect(checkInvariants(g.state)).toEqual([]);
    replays(g);
  });

  test('Oblation tucks a commander under the "always" option: the rewrite home drops it from the shuffle the spell computed', () => {
    const g = table({ mode: 'always', decks: [['Oblation', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    const spell = put(g, 'p1', 'Oblation', 'hand');
    mana(g, 'W', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: kess }] }));
    // Before the fix the resolution threw here (InvariantError: the commander in the command zone and the library).
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(libraryOf(g, 'p1')).not.toContain(kess);
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>command']);
    expect(asked(g), 'the option answers it').toBe(0);
    expect(checkInvariants(g.state)).toEqual([]);
    replays(g);
  });

  test('Timetwister wheels a commander kept in hand: "To command zone" drops it from the shuffle and from any draw computed off it', () => {
    const g = table({ decks: [['Timetwister', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'hand', player: 'p1' } }));
    const spell = put(g, 'p1', 'Timetwister', 'hand');
    mana(g, 'U', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [] }));
    untilAsked(g);
    const q = heldQuestion(g);
    expect(q.card).toBe(kess);
    expect(q.instead, 'the wheel would put it into the library').toBe('library');
    expect(q.from).toEqual({ kind: 'hand', player: 'p1' });
    choose(g, 'p1', true, false);
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(libraryOf(g, 'p1')).not.toContain(kess);
    expect(g.state.zones.hand.p1 ?? [], 'not drawn off the stale order either').not.toContain(kess);
    expect(asked(g), 'one question - no second one about a draw of the card the shuffle no longer holds').toBe(1);
    expect(g.log.filter((e) => e.body.t === 'WheelShuffled').map((e) => (e.body.t === 'WheelShuffled' ? e.body.player : ''))).toEqual(['p1', 'p2']);
    expect(checkInvariants(g.state)).toEqual([]);
    replays(g);
  });
});

describe('X11/F4 - a Tier-3 tool never displaces a question, and a held move is never orphaned or re-applied', () => {
  test("a Tier-3 move that would raise a held question is refused under a live one: Grim Affliction's proliferate stays", () => {
    const g = table({ decks: [['Grim Affliction', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const spell = put(g, 'p1', 'Grim Affliction', 'hand');
    mana(g, 'B', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }] }));
    untilAsked(g);
    const proliferate = g.state.priority.awaiting;
    expect(proliferate?.kind, "the spell's own question").toBe('proliferateChoice');
    const r = g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'hand', player: 'p1' } });
    expect(r.ok, 'refused: its own 903.9b question would replace the proliferate').toBe(false);
    expect(g.state.priority.awaiting, 'the proliferate is still up').toEqual(proliferate);
    expect(g.state.pendingReplacement).toBeNull();
    expect(zoneOf(g, kess)).toBe('battlefield');
    const from = g.log.length;
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [], players: [] }));
    expect(g.log.slice(from).some((e) => e.body.t === 'Proliferated'), 'the proliferate was answered').toBe(true);
    settle(g);
    expect(zoneOf(g, kess), 'the commander never moved').toBe('battlefield');
    replays(g);
  });

  test('under a held 903.9b question, a Tier-3 move that would hold a second is refused: the held move is not overwritten', () => {
    const g = table({ decks: [['Hallowed Burial', 'Grizzly Bears', ...LANDS], LANDS] });
    const krenko = commanderOf(g, 'p2');
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: krenko, to: { kind: 'graveyard', player: 'p2' } }));
    expect(g.state.cards[krenko]?.commanderZoneOwed, 'out of the command zone: nothing is owed').toBeUndefined();
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    burial(g);
    const held = g.state.pendingReplacement;
    expect(held?.commanderChoice?.card).toBe(kess);
    const r = g.submit({ t: 'ManualMoveCard', player: 'p2', card: krenko, to: { kind: 'hand', player: 'p2' } });
    expect(r.ok, "refused: Krenko's own 903.9b hold would overwrite the Burial's").toBe(false);
    expect(g.state.pendingReplacement, 'the held move stands').toEqual(held);
    expect(heldQuestion(g).card).toBe(kess);
    expect(zoneOf(g, krenko)).toBe('graveyard');
    choose(g, 'p1', true, false);
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(zoneOf(g, bears), 'the held batch completed').toBe('library');
    replays(g);
  });

  test("a question raised over a held move and answered (a Tier-3 Godless Shrine's 2 life): the held question is asked again, and the Burial completes", () => {
    const g = table({ decks: [['Hallowed Burial', 'Grizzly Bears', ...LANDS], ['Godless Shrine', ...LANDS]] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    burial(g);
    expect(heldQuestion(g).card).toBe(kess);
    // Holds nothing, so allowed - and it asks p2 to pay 2 life over p1's question.
    const shrine = put(g, 'p2', 'Godless Shrine');
    expect(g.state.priority.awaiting?.kind).toBe('entersChoice');
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p2', source: shrine, pay: false }));
    expect(g.state.cards[shrine]?.tapped, 'the land entered tapped').toBe(true);
    const q = heldQuestion(g);
    expect(q.player, "the held move's question is back - it was never asked again, and the Burial never finished").toBe('p1');
    expect(q.card).toBe(kess);
    expect(q.instead).toBe('library');
    choose(g, 'p1', true, false);
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(zoneOf(g, bears)).toBe('library');
    expect(g.state.pendingReplacement).toBeNull();
    replays(g);
  });

  test('a card of the held move moved by hand under the question is not moved again from its old zone (Grizzly Bears in one zone)', () => {
    const g = table({ decks: [['Hallowed Burial', 'Grizzly Bears', ...LANDS], LANDS] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    burial(g);
    expect(heldQuestion(g).card).toBe(kess);
    // A Tier-3 move that asks nothing of its own is allowed under the question.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    // Before the fix the answer threw here: the Bears' held move was applied from the battlefield (graveyard AND library).
    choose(g, 'p1', true, false);
    expect(zoneOf(g, bears)).toBe('graveyard');
    expect(libraryOf(g, 'p1')).not.toContain(bears);
    expect(zoneOf(g, kess)).toBe('command');
    settle(g);
    expect(checkInvariants(g.state)).toEqual([]);
    replays(g);
  });
});
