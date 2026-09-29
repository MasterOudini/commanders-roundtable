// CR 903.9 - where a commander goes when it leaves. Two different rules since the 2020 change:
//
// - 903.9a (a graveyard or exile) is a STATE-BASED ACTION (CR 704.6d): the commander is put into the graveyard or exile
//   first - it dies, it is exiled, every trigger watching that sees it - and the owner may then move it to the command
//   zone the next time state-based actions are checked. The "always" answer answers that SBA; it never replaces the move.
// - 903.9b (a hand or a library) is a REPLACEMENT: the move is rewritten before it happens ("always"), or held and asked
//   first (the funnel's held-event path, D486's), so the commander never touches the hand or the library.
//
// Proven here on real spells: Murder, Swords to Plowshares, Wrath of God, Echoing Truth, Hallowed Burial and the haunt of
// Benediction of Moons, with Blood Artist and a test exile watcher looking on; the answer's guards against a commander
// that moved on (fuzz seed 69's shape) and a linked exile ending in the same check; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import type { CardScript } from './scripts/api';
import { vocabularyTargets } from './scripts/vocabulary';
import { BLOOD_ARTIST_SCRIPT } from './scripts/cards/bloodArtist';
import { ECHOING_TRUTH_SCRIPT } from './scripts/cards/echoingTruth';
import { HALLOWED_BURIAL_SCRIPT } from './scripts/cards/hallowedBurial';
import { SWORDS_TO_PLOWSHARES_SCRIPT } from './scripts/cards/swordsToPlowshares';
import { WRATH_OF_GOD_SCRIPT } from './scripts/cards/wrathOfGod';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, type TestGameOpts } from './testing/harness';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { GameOptions, GameState } from './types/state';

const LANDS = ['Plains', 'Island', 'Swamp', 'Plains', 'Island', 'Swamp'];
const oracleIdOf = (name: string) => {
  const c = deps().oracle.byName(name);
  if (!c) throw new Error('no such fixture: ' + name);
  return c.oracleId;
};

// A test watcher: whenever a creature is put into exile from the battlefield, its controller gains 1 life.
const EXILE_WATCH: CardScript = {
  oracleId: oracleIdOf('Grizzly Bears'),
  name: 'Grizzly Bears',
  triggers: [
    {
      abilityId: 'test-exiled',
      text: 'TEST: whenever a creature is put into exile from the battlefield, you gain 1 life.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'exile'),
      label: () => 'TEST - gain 1 life',
      resolve: (ctx, self): readonly EventBody[] => {
        const who = ctx.state.cards[self]?.controller ?? 'p1';
        const now = ctx.state.players[who]?.life ?? 0;
        return [{ t: 'LifeChanged', player: who, delta: 1, to: now + 1 }];
      },
    },
  ],
};

// A test script on Banishing Light's printing: as it enters, exile target creature until it leaves the battlefield - and
// then it leaves, in the same resolution. The exiled card's linked exile ends at the very next check (D407, CR 610.3c).
const EXILE_THEN_LEAVE: CardScript = {
  oracleId: oracleIdOf('Banishing Light'),
  name: 'Banishing Light',
  triggers: [
    {
      abilityId: 'test-exile-then-leave',
      text: 'TEST: when this enters, exile target creature until this leaves the battlefield; then put this into its owner\'s graveyard.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: vocabularyTargets('Exile target creature.'),
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'TEST - exile until it leaves, then leave',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        const me = ctx.state.cards[self];
        const it = target?.kind === 'card' ? ctx.state.cards[target.id] : undefined;
        if (!me || !it || target?.kind !== 'card') return [];
        return [
          { t: 'CardsMoved', moves: [{ card: target.id, from: it.zone, to: { kind: 'exile', player: it.owner }, until: { source: self, entry: me.entries ?? 0 } }] },
          { t: 'CardsMoved', moves: [{ card: self, from: me.zone, to: { kind: 'graveyard', player: me.owner } }] },
        ];
      },
    },
  ],
};

const SCRIPTS = createRegistry([BLOOD_ARTIST_SCRIPT, ECHOING_TRUTH_SCRIPT, HALLOWED_BURIAL_SCRIPT, SWORDS_TO_PLOWSHARES_SCRIPT, WRATH_OF_GOD_SCRIPT, EXILE_WATCH]);

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
const mana = (g: Game, symbol: 'W' | 'U' | 'B' | 'C', amount: number) =>
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
/** p1 casts Murder at the card, and play goes on until the next question. */
function murder(g: Game, target: InstanceId): void {
  const spell = put(g, 'p1', 'Murder', 'hand');
  mana(g, 'C', 1);
  mana(g, 'B', 2);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }));
  untilAsked(g);
}
/** p1 casts Echoing Truth at the card, and play goes on until the next question after the aim. */
function echo(g: Game, target: InstanceId): void {
  const spell = put(g, 'p1', 'Echoing Truth', 'hand');
  mana(g, 'U', 1);
  mana(g, 'C', 1);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  untilAsked(g);
}
function burial(g: Game): void {
  const spell = put(g, 'p1', 'Hallowed Burial', 'hand');
  mana(g, 'W', 2);
  mana(g, 'C', 3);
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  untilAsked(g);
}
const aimAt = (g: Game, player: PlayerId, target: PlayerId) => {
  expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
  must(g.submit({ t: 'ChooseTargets', player, targets: [{ kind: 'player', id: target }] }));
};
const choose = (g: Game, player: PlayerId, toCommandZone: boolean, always: boolean) =>
  must(g.submit({ t: 'CommanderZoneChoice', player, toCommandZone, always }));

/** Every zone change the log records for one card, in order. */
const pathOf = (g: Game, id: InstanceId) =>
  g.log.flatMap((e) => (e.body.t === 'CardsMoved' ? e.body.moves.filter((m) => m.card === id).map((m) => `${m.from.kind}>${m.to.kind}`) : []));
/** How many times the commander question was raised. */
const asked = (g: Game) => g.log.filter((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'commanderZoneChoice').length;
/** How many triggers of one source were collected. */
const fired = (g: Game, source: InstanceId) =>
  g.log.flatMap((e) => (e.body.t === 'PendingTriggersAdded' ? e.body.triggers.filter((t) => t.source === source) : [])).length;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind;
const life = (g: Game, p: PlayerId) => g.state.players[p]?.life ?? 0;
const replays = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

describe('CR 903.9a - a commander put into a graveyard or exile goes there first; the command zone is a state-based action', () => {
  test('it dies first: with "Always do this" answered, Blood Artist sees both deaths and the SBA sends it home before the trigger is put on the stack', () => {
    const g = table({ decks: [['Blood Artist', 'Murder', 'Murder', ...LANDS], LANDS] });
    const artist = put(g, 'p1', 'Blood Artist');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    const p2life = life(g, 'p2');

    // The first death: no standing answer yet, so the owner is asked - after the death, before Blood Artist's trigger.
    murder(g, kess);
    expect(g.state.priority.awaiting?.kind, 'the owner is asked').toBe('commanderZoneChoice');
    expect(zoneOf(g, kess), 'the commander died: it is in the graveyard while the question is up').toBe('graveyard');
    expect(g.state.pendingTriggers.map((t) => t.source), 'Blood Artist saw it die; its trigger waits for the answer').toContain(artist);
    expect(g.state.stack, 'nothing is put on the stack before the SBA').toHaveLength(0);
    choose(g, 'p1', true, true);
    expect(zoneOf(g, kess)).toBe('command');
    expect(g.state.players.p1?.commanderZoneAlways).toBe(true);
    untilAsked(g);
    aimAt(g, 'p1', 'p2');
    settle(g);
    expect(life(g, 'p2')).toBe(p2life - 1);

    // The second death, under the standing answer: nothing is asked; the commander dies, then goes home.
    onto(g, 'p1', kess);
    murder(g, kess);
    expect(g.state.priority.awaiting?.kind, 'Blood Artist sees the second death too').toBe('chooseTargets');
    expect(zoneOf(g, kess), 'the SBA sent it home before the trigger was put on the stack').toBe('command');
    aimAt(g, 'p1', 'p2');
    settle(g);
    expect(life(g, 'p2')).toBe(p2life - 2);
    expect(asked(g), 'asked once - the standing answer answered the second').toBe(1);
    expect(fired(g, artist)).toBe(2);
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>graveyard', 'graveyard>command', 'command>battlefield', 'battlefield>graveyard', 'graveyard>command']);
    expect(g.state.cards[kess]?.commanderZoneOwed, 'nothing is owed once it went home').toBeUndefined();
    replays(g);
  });

  test("the commander's OWN dies trigger fires under the \"always\" option (Blood Artist as the commander)", () => {
    const g = table({ mode: 'always', decks: [['Murder', ...LANDS], LANDS], commanders: [['Blood Artist'], ['Krenko, Mob Boss']] });
    const artist = commanderOf(g, 'p1');
    onto(g, 'p1', artist);
    const p2life = life(g, 'p2');
    murder(g, artist);
    expect(g.state.priority.awaiting?.kind, 'its own dies trigger').toBe('chooseTargets');
    expect(zoneOf(g, artist)).toBe('command');
    aimAt(g, 'p1', 'p2');
    settle(g);
    expect(life(g, 'p2')).toBe(p2life - 1);
    expect(asked(g), 'the option answers every question').toBe(0);
    expect(pathOf(g, artist)).toEqual(['command>battlefield', 'battlefield>graveyard', 'graveyard>command']);
    replays(g);
  });

  test('it is exiled first: an exile watcher sees it, then the SBA sends it home (Swords to Plowshares, the "always" option)', () => {
    const g = table({ mode: 'always', decks: [['Swords to Plowshares', 'Grizzly Bears', ...LANDS], LANDS] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    const life0 = life(g, 'p1');
    const spell = put(g, 'p1', 'Swords to Plowshares', 'hand');
    mana(g, 'W', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: kess }] }));
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(fired(g, bears), 'the watcher saw it exiled').toBe(1);
    expect(life(g, 'p1'), "Swords' three for its power, and the watcher's one").toBe(life0 + 3 + 1);
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>exile', 'exile>command']);
    replays(g);
  });

  test('"Leave it" leaves it in the graveyard and it is not asked about again - until it is put into exile, a new zone change', () => {
    const g = table({ decks: [['Blood Artist', 'Murder', ...LANDS], LANDS] });
    put(g, 'p1', 'Blood Artist');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    murder(g, kess);
    expect(g.state.priority.awaiting?.kind).toBe('commanderZoneChoice');
    choose(g, 'p1', false, false);
    expect(zoneOf(g, kess)).toBe('graveyard');
    expect(g.state.cards[kess]?.commanderZoneOwed, 'the choice was made: nothing owed').toBeUndefined();
    untilAsked(g);
    aimAt(g, 'p1', 'p2');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.priority.awaiting === null, 20_000);
    expect(asked(g), 'not asked again while it stays').toBe(1);
    expect(zoneOf(g, kess)).toBe('graveyard');

    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'exile', player: 'p1' } }));
    untilAsked(g);
    expect(g.state.priority.awaiting?.kind, 'put into exile: asked again').toBe('commanderZoneChoice');
    choose(g, 'p1', true, false);
    expect(zoneOf(g, kess)).toBe('command');
    replays(g);
  });

  test('two commanders die together: one question at a time, and "Always do this" answers the second too (Wrath of God)', () => {
    const g = table({ decks: [['Wrath of God', ...LANDS], LANDS], commanders: [['Kess, Dissident Mage', 'Talrand, Sky Summoner'], ['Krenko, Mob Boss']] });
    const kess = commanderOf(g, 'p1', 0);
    const talrand = commanderOf(g, 'p1', 1);
    onto(g, 'p1', kess);
    onto(g, 'p1', talrand);
    const spell = put(g, 'p1', 'Wrath of God', 'hand');
    mana(g, 'W', 4);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    untilAsked(g);
    const q = g.state.priority.awaiting;
    expect(q?.kind).toBe('commanderZoneChoice');
    expect(q?.kind === 'commanderZoneChoice' ? q.queue.map((e) => e.card) : [], 'both are owed').toEqual([kess, talrand]);
    expect(zoneOf(g, kess)).toBe('graveyard');
    expect(zoneOf(g, talrand)).toBe('graveyard');
    choose(g, 'p1', true, true);
    untilAsked(g);
    expect(g.state.priority.awaiting, 'the second needs no question').toBeNull();
    expect(zoneOf(g, kess)).toBe('command');
    expect(zoneOf(g, talrand)).toBe('command');
    expect(asked(g)).toBe(1);
    replays(g);
  });

  test("the review's haunt case: Benediction of Moons haunting a commander still fires when it dies (the \"always\" option)", () => {
    const g = table({ mode: 'always', decks: [['Benediction of Moons', 'Murder', ...LANDS], LANDS] });
    const krenko = commanderOf(g, 'p2');
    onto(g, 'p2', krenko);
    const life0 = life(g, 'p1');
    const spell = put(g, 'p1', 'Benediction of Moons', 'hand');
    mana(g, 'W', 3);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    untilAsked(g);
    expect(g.state.priority.awaiting?.kind, "the haunt's aim").toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: krenko }] }));
    settle(g);
    expect(g.state.cards[spell]?.haunting?.card).toBe(krenko);
    expect(life(g, 'p1'), 'the spell').toBe(life0 + 2);
    murder(g, krenko);
    settle(g);
    expect(life(g, 'p1'), 'the creature it haunts died: the line again, from exile').toBe(life0 + 4);
    expect(zoneOf(g, krenko)).toBe('command');
    expect(pathOf(g, krenko)).toEqual(['command>battlefield', 'battlefield>graveyard', 'graveyard>command']);
    replays(g);
  });

  test("fuzz seed 69's guard, under a question that is up: the commander moved on before the answer, so the answer moves nothing", () => {
    const g = table({ decks: [['Murder', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    murder(g, kess);
    expect(g.state.priority.awaiting?.kind).toBe('commanderZoneChoice');
    // A Tier-3 move is allowed under any question: the owner puts it back onto the battlefield by hand.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.cards[kess]?.commanderZoneOwed, 'the move settled what was owed').toBeUndefined();
    choose(g, 'p1', true, false);
    settle(g);
    expect(zoneOf(g, kess), 'the stale yes is a no-op').toBe('battlefield');
    expect(g.state.zones.battlefield.filter((id) => id === kess)).toHaveLength(1);
    expect(g.state.zones.command.p1 ?? []).not.toContain(kess);
    replays(g);
  });

  test('a linked exile that ends in the same check wins: the commander returns to the battlefield, and is not sent home as well', () => {
    const g = startedGame({
      players: 2,
      decks: [['Banishing Light', ...LANDS], LANDS],
      scripts: createRegistry([EXILE_THEN_LEAVE]),
      options: { commanderZoneReplacement: 'always', maxHandSize: null },
    });
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const krenko = commanderOf(g, 'p2');
    onto(g, 'p2', krenko);
    put(g, 'p1', 'Banishing Light');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: krenko }] }));
    settle(g);
    expect(pathOf(g, krenko), 'exiled, then back as its source left - one move out of exile').toEqual(['command>battlefield', 'battlefield>exile', 'exile>battlefield']);
    expect(zoneOf(g, krenko)).toBe('battlefield');
    expect(g.state.cards[krenko]?.commanderZoneOwed, 'the return settled what was owed').toBeUndefined();
    replays(g);
  });

  test('the "never" option: nothing is asked, nothing is owed, and the commander stays in the graveyard', () => {
    const g = table({ mode: 'never', decks: [['Murder', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    murder(g, kess);
    settle(g);
    expect(zoneOf(g, kess)).toBe('graveyard');
    expect(g.state.cards[kess]?.commanderZoneOwed).toBeUndefined();
    expect(asked(g)).toBe(0);
    replays(g);
  });
});

describe('CR 903.9b - a commander that would be put into its owner\'s hand or library goes to the command zone instead', () => {
  test('bounced (Echoing Truth) under the "always" option: it goes to the command zone and never touches the hand', () => {
    const g = table({ mode: 'always', decks: [['Echoing Truth', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    echo(g, kess);
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>command']);
    expect(asked(g)).toBe(0);
    replays(g);
  });

  test('tucked (Hallowed Burial) under the "always" option: the commander goes home, the rest of the move goes on', () => {
    const g = table({ mode: 'always', decks: [['Hallowed Burial', 'Grizzly Bears', ...LANDS], LANDS] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    burial(g);
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(zoneOf(g, bears)).toBe('library');
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>command']);
    replays(g);
  });

  test('asked: the move is HELD and asked about before it happens; "To command zone" sends it home and the rest of the move completes', () => {
    const g = table({ decks: [['Hallowed Burial', 'Grizzly Bears', ...LANDS], LANDS] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    burial(g);
    const q = g.state.priority.awaiting;
    expect(q?.kind, 'asked before the move').toBe('commanderZoneChoice');
    expect(q?.kind === 'commanderZoneChoice' ? q.instead?.kind : undefined, 'about its library').toBe('library');
    expect(g.state.pendingReplacement, 'the move is held').not.toBeNull();
    expect(zoneOf(g, kess), 'not moved yet').toBe('battlefield');
    expect(zoneOf(g, bears), 'the whole move waits').toBe('battlefield');
    choose(g, 'p1', true, false);
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(zoneOf(g, bears)).toBe('library');
    expect(g.state.pendingReplacement).toBeNull();
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>command']);
    replays(g);
  });

  test('asked: "Leave it" lets the move happen (Echoing Truth puts it into the hand)', () => {
    const g = table({ decks: [['Echoing Truth', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    echo(g, kess);
    const q = g.state.priority.awaiting;
    expect(q?.kind).toBe('commanderZoneChoice');
    expect(q?.kind === 'commanderZoneChoice' ? q.instead?.kind : undefined).toBe('hand');
    expect(zoneOf(g, kess)).toBe('battlefield');
    choose(g, 'p1', false, false);
    settle(g);
    expect(zoneOf(g, kess)).toBe('hand');
    expect(g.state.players.p1?.commanderZoneAlways).toBeNull();
    expect(asked(g)).toBe(1);
    replays(g);
  });

  test('asked: "Always do this" sends it home and answers the next time too (a hand, then a library)', () => {
    const g = table({ decks: [LANDS, LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'hand', player: 'p1' } }));
    untilAsked(g);
    expect(g.state.priority.awaiting?.kind).toBe('commanderZoneChoice');
    choose(g, 'p1', true, true);
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(g.state.players.p1?.commanderZoneAlways).toBe(true);
    onto(g, 'p1', kess);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'library', player: 'p1' } }));
    settle(g);
    expect(zoneOf(g, kess)).toBe('command');
    expect(asked(g)).toBe(1);
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>command', 'command>battlefield', 'battlefield>command']);
    replays(g);
  });

  test('a held commander that moved on before the answer: its move is dropped, the rest of the move goes on, and its new zone change is owed', () => {
    const g = table({ decks: [['Hallowed Burial', 'Grizzly Bears', ...LANDS], LANDS] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    burial(g);
    expect(g.state.priority.awaiting?.kind).toBe('commanderZoneChoice');
    // Under the held question, the owner puts it into the graveyard by hand (a Tier-3 move).
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'graveyard', player: 'p1' } }));
    choose(g, 'p1', true, false);
    expect(zoneOf(g, kess), 'the held move is stale: dropped, never applied from the battlefield').toBe('graveyard');
    expect(zoneOf(g, bears), 'the rest of the move went on').toBe('library');
    expect(g.state.pendingReplacement).toBeNull();
    untilAsked(g);
    expect(g.state.priority.awaiting?.kind, 'the move into the graveyard is 903.9a: asked afresh').toBe('commanderZoneChoice');
    choose(g, 'p1', true, false);
    expect(zoneOf(g, kess)).toBe('command');
    expect(pathOf(g, kess)).toEqual(['command>battlefield', 'battlefield>graveyard', 'graveyard>command']);
    replays(g);
  });

  test('the "never" option: a bounce is not asked about and not replaced', () => {
    const g = table({ mode: 'never', decks: [['Echoing Truth', ...LANDS], LANDS] });
    const kess = commanderOf(g, 'p1');
    onto(g, 'p1', kess);
    echo(g, kess);
    settle(g);
    expect(zoneOf(g, kess)).toBe('hand');
    expect(asked(g)).toBe(0);
    replays(g);
  });

  test('a commander leaving the command zone for its hand is not asked about (a Command Beacon move)', () => {
    const g = table({ decks: [LANDS, LANDS] });
    const kess = commanderOf(g, 'p1');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: kess, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(zoneOf(g, kess)).toBe('hand');
    expect(asked(g)).toBe(0);
    replays(g);
  });
});
