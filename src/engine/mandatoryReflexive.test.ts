// D586 - THE REFLEXIVE TRIGGER'S SECOND CUT (CR 603.12): the MANDATORY action `<action>. When you do, <payload>` - no price,
// no `you may`: the action is one sentence one rule reads whole, it happens (or not) as the ability resolves, and only if it
// HAPPENED does the payload trigger - D584's marker (`ReflexiveTriggered`) pushed after the action's last step, the bus
// making one pending trigger that is aimed as it goes on the stack (603.3d removes it with no legal target), its clauses
// rechecked on resolution (608.2b). What is proven here (the D586 measurement's proofs, ported - d586/measure586-mandatory
// and the judge's list): Faebloom Trick cast with NO target, the tokens made THEN the trigger aimed; no legal target - the
// trigger removed, nothing asked; the target gone - 608.2b; `you do` FAILS when the land left before its trigger resolved;
// the land's whole chain (the search refuses a Forest; the Island tapped; 1 life); Smoke Bomb's upkeep sacrifice - its
// shroud gone before the aim, no creature of its controller's - removed; a sacrifice REPLACED into exile still triggers (the
// action PERFORMED, not its destination); the replay hash on each. The land and the Bomb run test-local defs built by the
// vocabulary (their generated modules land with the wave): before the seam the vocabulary refuses their payload whole.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import { OBSCURA_STOREFRONT, ORNITHOPTER, SMOKE_BOMB } from '../data/fixtures/engineCards';
import { advanceUntil, answer, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const since = (g: Game, at: number): EventBody[] => g.log.slice(at).map((e) => e.body);
const marked = (g: Game, at: number) => since(g, at).filter((b) => b.t === 'ReflexiveTriggered').length;
const askedAim = (g: Game, at: number) => since(g, at).some((b) => b.t === 'AwaitingSet' && b.awaiting?.kind === 'chooseTargets');
const faeries = (g: Game): InstanceId[] =>
  (Object.keys(g.state.cards) as InstanceId[]).filter((id) => g.state.cards[id]?.zone.kind === 'battlefield' && g.state.cards[id]?.isToken === true && nameOf(g, id) === 'Faerie');

function castTrick(g: Game, trick: InstanceId): number {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  const at = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: trick, targets: [] }));
  return at;
}

/** Obscura Storefront's enters trigger, built by the vocabulary the way its generated module builds it. */
function storefront(): CardScript {
  const payload = 'Sacrifice it. When you do, search your library for a basic Plains, Island, or Swamp card, put it onto the battlefield tapped, then shuffle and you gain 1 life.';
  const vocab = vocabularyEffects(payload, OBSCURA_STOREFRONT.name);
  const vocabT = vocabularyTargets(payload);
  return {
    oracleId: OBSCURA_STOREFRONT.oracleId,
    name: OBSCURA_STOREFRONT.name,
    triggers: [
      {
        abilityId: 'etb-0',
        text: OBSCURA_STOREFRONT.faces[0]?.oracleText ?? '',
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        label: () => 'Obscura Storefront - ' + payload,
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, vocab, vocabT),
      },
    ],
  };
}

/** Smoke Bomb: every creature has shroud; at its controller's upkeep, the sacrifice and its reflexive aim. */
function smokeBomb(): CardScript {
  const payload = "Sacrifice this artifact. When you do, target creature you control can't be blocked this turn.";
  const vocab = vocabularyEffects(payload, SMOKE_BOMB.name);
  const vocabT = vocabularyTargets(payload);
  const lines = (SMOKE_BOMB.faces[0]?.oracleText ?? '').split(String.fromCharCode(10));
  return {
    oracleId: SMOKE_BOMB.oracleId,
    name: SMOKE_BOMB.name,
    triggers: [
      {
        abilityId: 'upkeep-2',
        text: lines[2] ?? '',
        event: 'StepBegan',
        activeZones: ['battlefield'],
        optional: false,
        matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
        label: () => 'Smoke Bomb - ' + payload,
        resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, vocab, vocabT),
      },
    ],
    statics: [
      {
        abilityId: 'anthem-grant-1',
        text: lines[1] ?? '',
        layer: 'ability',
        activeZones: ['battlefield'],
        appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield',
        modify: (chars) => {
          chars.keywords.add('shroud');
        },
      },
    ],
  };
}

/** A Rest in Peace stand-in on an Ornithopter: a card that would go to a graveyard is exiled instead. */
const redirect: CardScript = {
  oracleId: ORNITHOPTER.oracleId,
  name: ORNITHOPTER.name,
  replacements: [
    {
      abilityId: 'd586-redirect',
      text: 'If a card or token would be put into a graveyard from anywhere, exile it instead.',
      activeZones: ['battlefield'],
      applies: (_ctx, _self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.to.kind === 'graveyard'),
      replace: (_ctx, _self, ev) =>
        ev.t === 'CardsMoved' ? [{ ...ev, moves: ev.moves.map((m) => (m.to.kind === 'graveyard' ? { ...m, to: { kind: 'exile' as const, player: m.to.player } } : m)) }] : [ev],
    },
  ],
};

describe('D586 - the mandatory reflexive trigger (CR 603.12)', () => {
  test('Faebloom Trick: cast with NO target, the tokens made, THEN the trigger aimed and the tap; once; the log replays', () => {
    const g = startedGame({ players: 2, decks: [['Faebloom Trick'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const trick = put(g, 'p1', 'Faebloom Trick', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main3(g);
    const at = castTrick(g, trick);
    expect(g.state.stack[0]?.targets.length, 'the spell declares no target').toBe(0);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'chooseTargets' ? ask.player : null, 'the reflexive trigger asks its controller').toBe('p1');
    expect(faeries(g).length, 'the tokens were made before the trigger was aimed').toBe(2);
    const kinds = since(g, at).map((b) => b.t);
    expect(kinds.indexOf('ReflexiveTriggered') > kinds.lastIndexOf('TokenCreated'), 'the marker follows the action').toBe(true);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped, 'the payload tapped the target').toBe(true);
    expect(g.state.cards[trick]?.zone.kind).toBe('graveyard');
    expect(marked(g, at), 'it triggered once').toBe(1);
    hashHolds(g);
  });

  test('no legal target: the tokens are made, the trigger is removed (603.3d), nothing is asked', () => {
    const g = startedGame({ players: 2, decks: [['Faebloom Trick'], ['Forest']] });
    holdEverywhere(g);
    const trick = put(g, 'p1', 'Faebloom Trick', 'hand');
    main3(g);
    const at = castTrick(g, trick);
    settle(g);
    expect(faeries(g).length).toBe(2);
    expect(marked(g, at), 'the action happened').toBe(1);
    expect(askedAim(g, at), 'nothing to aim at').toBe(false);
    expect(g.state.stack.length).toBe(0);
    hashHolds(g);
  });

  test('the target leaves before the trigger resolves: 608.2b - nothing is tapped', () => {
    const g = startedGame({ players: 2, decks: [['Faebloom Trick'], ['Grizzly Bears', 'Llanowar Elves']] });
    holdEverywhere(g);
    const trick = put(g, 'p1', 'Faebloom Trick', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    const elves = put(g, 'p2', 'Llanowar Elves');
    main3(g);
    castTrick(g, trick);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.stack.length, 'the trigger is on the stack').toBe(1);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[elves]?.tapped, 'no other creature is tapped').toBe(false);
    expect(faeries(g).length).toBe(2);
    hashHolds(g);
  });

  test('you do NOT: the land left before its trigger resolved - no sacrifice, no trigger, no search, no life', () => {
    const g = startedGame({ players: 2, decks: [['Obscura Storefront'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([storefront()]) });
    holdEverywhere(g);
    const land = put(g, 'p1', 'Obscura Storefront', 'graveyard');
    main3(g);
    const life0 = g.state.players.p1?.life ?? 0;
    const at = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.stack.length === 1, 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(marked(g, at), 'nothing triggered').toBe(0);
    expect(since(g, at).some((b) => b.t === 'AwaitingSet' && b.awaiting?.kind === 'searchLibrary'), 'no search').toBe(false);
    expect(g.state.players.p1?.life).toBe(life0);
    expect(g.state.cards[land]?.zone.kind).toBe('hand');
    hashHolds(g);
  });

  test('the land: sacrificed, the reflexive trigger (no target) resolves - the search refuses a Forest, the Island tapped, 1 life', () => {
    const g = startedGame({ players: 2, decks: [['Obscura Storefront'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([storefront()]) });
    holdEverywhere(g);
    const land = put(g, 'p1', 'Obscura Storefront', 'graveyard');
    main3(g);
    const life0 = g.state.players.p1?.life ?? 0;
    const at = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    expect(g.state.cards[land]?.zone.kind, 'sacrificed').toBe('graveyard');
    expect(marked(g, at)).toBe(1);
    const lib = [...(g.state.zones.library.p1 ?? [])];
    const forest = lib.find((id) => nameOf(g, id) === 'Forest');
    const island = lib.find((id) => nameOf(g, id) === 'Island');
    if (!forest || !island) throw new Error('the library holds no Forest and Island');
    expect(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [forest], declined: false }).ok, 'a Forest is not a basic Plains, Island or Swamp').toBe(false);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [island], declined: false }));
    settle(g);
    expect(g.state.cards[island]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[island]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(life0 + 1);
    hashHolds(g);
  });

  test('a sacrifice REPLACED into exile is still a sacrifice: the land is exiled and its payload still triggers', () => {
    const g = startedGame({ players: 2, decks: [['Obscura Storefront', 'Ornithopter'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([storefront(), redirect]) });
    holdEverywhere(g);
    put(g, 'p1', 'Ornithopter');
    const land = put(g, 'p1', 'Obscura Storefront', 'hand');
    main3(g);
    const life0 = g.state.players.p1?.life ?? 0;
    const at = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
    expect(g.state.cards[land]?.zone.kind, 'exiled instead').toBe('exile');
    expect(marked(g, at), 'the sacrifice happened - its payload triggers').toBe(1);
    const island = [...(g.state.zones.library.p1 ?? [])].find((id) => nameOf(g, id) === 'Island');
    if (!island) throw new Error('the library holds no Island');
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [island], declined: false }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 1);
    hashHolds(g);
  });

  // D586 - THE REVIEW (pre-existing in the vocabulary's `sacrifice ~`, D377): a player sacrifices only a permanent they control
  // (CR 701.21a), and a phased-out permanent is treated as though it does not exist (CR 702.26b) - nothing is sacrificed, so the
  // action did not happen and nothing triggers. Both failed before the fix (the land went to its old controller's graveyard).
  test('the land given away before its trigger resolves: nothing is sacrificed, nothing triggers', () => {
    const g = startedGame({ players: 2, decks: [['Obscura Storefront'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([storefront()]) });
    holdEverywhere(g);
    const land = put(g, 'p1', 'Obscura Storefront', 'graveyard');
    main3(g);
    const life0 = g.state.players.p1?.life ?? 0;
    const at = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.stack.length === 1, 20_000);
    must(g.submit({ t: 'ManualSetController', player: 'p1', card: land, controller: 'p2' }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind, 'still on the battlefield').toBe('battlefield');
    expect(g.state.cards[land]?.controller).toBe('p2');
    expect(marked(g, at), 'nothing triggered').toBe(0);
    expect(g.state.players.p1?.life).toBe(life0);
    hashHolds(g);
  });

  test('the land phased out (Reality Ripple) before its trigger resolves: nothing is sacrificed, nothing triggers', () => {
    const g = startedGame({ players: 2, decks: [['Obscura Storefront', 'Reality Ripple'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([storefront()]) });
    holdEverywhere(g);
    const land = put(g, 'p1', 'Obscura Storefront', 'graveyard');
    const ripple = put(g, 'p1', 'Reality Ripple', 'hand');
    main3(g);
    const at = g.log.length;
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }));
    advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ripple, targets: [{ kind: 'card', id: land }] }));
    settle(g);
    expect(g.state.cards[land]?.phasedOut, 'phased out').toBe(true);
    expect(g.state.cards[land]?.zone.kind, 'still on the battlefield, phased out').toBe('battlefield');
    expect(marked(g, at), 'nothing triggered').toBe(0);
    hashHolds(g);
  });

  // D586 - THE REVIEW: a spell COPY's reflexive trigger is the copy's (CR 603.7d - a delayed trigger a spell creates has that
  // spell as its source), and Fork's copy is RED: its trigger may tap the pro-blue Scragnoth and never the pro-red Kor
  // Firewalker - the original card (blue) answered the other way before the fix.
  test('a Fork copy of Faebloom Trick is red: its trigger may tap the pro-blue Scragnoth, never the pro-red Kor Firewalker', () => {
    const g = startedGame({ players: 2, decks: [['Faebloom Trick', 'Fork'], ['Kor Firewalker', 'Scragnoth', 'Grizzly Bears']] });
    holdEverywhere(g);
    const trick = put(g, 'p1', 'Faebloom Trick', 'hand');
    const fork = put(g, 'p1', 'Fork', 'hand');
    const kor = put(g, 'p2', 'Kor Firewalker');
    const scrag = put(g, 'p2', 'Scragnoth');
    main3(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: trick, targets: [] }));
    const trickObj = g.state.stack[g.state.stack.length - 1]?.id;
    if (!trickObj) throw new Error('Faebloom Trick is not on the stack');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: trickObj }] }));
    // Drive to the copy's reflexive aim: every other question answered the harness's way (Kor's optional life gain).
    for (let i = 0; i < 400; i++) {
      const a = g.state.priority.awaiting;
      if (a?.kind === 'chooseTargets' && a.player === 'p1') break;
      if (a) { answer(g, a); continue; }
      const holder = g.state.priority.player;
      if (!holder) throw new Error('nobody has priority');
      must(g.submit({ t: 'PassPriority', player: holder }));
    }
    const ask = g.state.priority.awaiting;
    expect(ask?.kind, 'the copy' + "'" + 's reflexive trigger asks for its aim').toBe('chooseTargets');
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: kor }] }).ok, 'the red copy' + "'" + 's trigger cannot target the pro-red Kor Firewalker').toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: scrag }] }));
    hashHolds(g);
  });

  test('Smoke Bomb: its upkeep sacrifice; with no creature of its controller, the trigger is removed; with one, it cannot be blocked', () => {
    for (const withCreature of [false, true]) {
      const g = startedGame({ players: 2, decks: [['Smoke Bomb', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([smokeBomb()]) });
      holdEverywhere(g);
      const bomb = put(g, 'p1', 'Smoke Bomb');
      const bears = withCreature ? put(g, 'p1', 'Grizzly Bears') : null;
      const at = g.log.length;
      advanceUntil(g, (s) => (s.cards[bomb]?.zone.kind ?? '') !== 'battlefield' && (s.priority.awaiting?.kind === 'chooseTargets' || (s.stack.length === 0 && s.pendingTriggers.length === 0)), 40_000);
      expect(g.state.cards[bomb]?.zone.kind, 'sacrificed at the upkeep').toBe('graveyard');
      expect(marked(g, at), 'the sacrifice happened').toBe(1);
      if (bears === null) {
        expect(askedAim(g, at), 'no creature of its controller: nothing to aim at (603.3d)').toBe(false);
      } else {
        const ask = g.state.priority.awaiting;
        expect(ask?.kind, 'the shroud left with the Bomb: the Bears is a legal target').toBe('chooseTargets');
        must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
        settle(g);
        expect(g.state.untilEndOfTurn.some((m) => m.card === bears && m.cantBeBlocked === true), 'the Bears cannot be blocked this turn').toBe(true);
      }
      hashHolds(g);
    }
  });
});
