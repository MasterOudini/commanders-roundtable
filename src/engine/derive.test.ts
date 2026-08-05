import { describe, expect, test } from 'vitest';
import { derive, makeDeriveCache } from './derive';
import { createRegistry, NO_SCRIPTS } from './scripts/registry';
import type { CardScript, MutableCharacteristics, ScriptCtx } from './scripts/api';
import { ORACLE, find, findAnywhere, must, put, startedGame } from './testing/harness';
import type { InstanceId } from './types/ids';
import type { Game } from './game';

function d(game: Game, id: InstanceId) {
  return derive(game.state, ORACLE, game.deps.scripts, id);
}

describe('derive — layers 1, 7b and the Tier-3 override', () => {
  test('layer 1: printed power and toughness', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const chars = d(game, bear);
    expect(chars.power).toBe(2);
    expect(chars.toughness).toBe(2);
    expect(chars.isCreature).toBe(true);
    expect(chars.name).toBe('Grizzly Bears');
  });

  test('layer 7b: +1/+1 counters add', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: bear, kind: '+1/+1', delta: 3 }));
    expect(d(game, bear).power).toBe(5);
    expect(d(game, bear).toughness).toBe(5);
  });

  test('-1/-1 counters subtract, and can take toughness to zero', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: bear, kind: '-1/-1', delta: 2 }));
    // The SBA pass runs inside submit(), so by now the creature is already gone.
    expect(game.state.cards[bear]?.zone.kind).toBe('graveyard');
  });

  /**
   * ⚠️ The manual override lands BEFORE counters, not after (DECISIONS D34).
   * The player's intent when they type "4/4" is "its base is 4/4 now", and a
   * +1/+1 counter must still make it a 5/5 — applying the override last would
   * make the counter tool silently do nothing.
   */
  test('the Tier-3 P/T override sets the BASE, so counters still apply', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualSetPt', player: 'p1', card: bear, power: 4, toughness: 4 }));
    expect(d(game, bear).power).toBe(4);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: bear, kind: '+1/+1', delta: 1 }));
    expect(d(game, bear).power).toBe(5);
    expect(d(game, bear).toughness).toBe(5);
  });

  test('clearing the override returns the printed values', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    must(game.submit({ t: 'ManualSetPt', player: 'p1', card: bear, power: 9, toughness: 9 }));
    must(game.submit({ t: 'ManualSetPt', player: 'p1', card: bear, power: null, toughness: null }));
    expect(d(game, bear).power).toBe(2);
  });

  test('a face-down permanent is a 2/2 colourless creature with no name', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = put(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualSetFaceDown', player: 'p1', card: angel, faceDown: true }));
    const chars = d(game, angel);
    expect(chars.power).toBe(2);
    expect(chars.toughness).toBe(2);
    expect(chars.name).toBe('');
    expect(chars.colors).toEqual([]);
    expect(chars.keywords.size).toBe(0);
    expect(chars.isCreature).toBe(true);
  });

  /**
   * ⚠️ A `*`-power card is 0/0 WITHOUT a script, and the SBA bins it. That is
   * the honest Tier-2 answer: guessing 1/1 would put a wrong number on the board
   * and nobody would know where it came from.
   */
  test('a `*` power card is 0/0 with no script — and says so by dying', () => {
    const game = startedGame({ decks: [['Tarmogoyf']] });
    const goyf = findAnywhere(game, 'p1', 'Tarmogoyf');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: goyf, to: { kind: 'battlefield', player: 'p1' } }));
    expect(game.state.cards[goyf]?.zone.kind).toBe('graveyard');
  });

  test('keywords come through as a set', () => {
    const game = startedGame({ decks: [['Serra Angel']] });
    const angel = put(game, 'p1', 'Serra Angel');
    const chars = d(game, angel);
    expect([...chars.keywords].sort()).toEqual(['flying', 'vigilance']);
  });

  test('a non-creature has null power and toughness', () => {
    const game = startedGame({ decks: [['Sol Ring']] });
    const ring = put(game, 'p1', 'Sol Ring');
    expect(d(game, ring).power).toBeNull();
    expect(d(game, ring).isCreature).toBe(false);
  });

  test('legendary is visible to the layer pipeline', () => {
    const game = startedGame({ decks: [['Krenko, Mob Boss']] });
    const krenko = put(game, 'p1', 'Krenko, Mob Boss');
    expect(d(game, krenko).isLegendary).toBe(true);
  });

  test('the cache is invalidated by an event, not held across one', () => {
    const game = startedGame({ decks: [['Grizzly Bears']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const cache = makeDeriveCache(game.state);
    expect(derive(game.state, ORACLE, NO_SCRIPTS, bear, cache).power).toBe(2);
    must(game.submit({ t: 'ManualSetCounter', player: 'p1', card: bear, kind: '+1/+1', delta: 1 }));
    // Same cache object, new state: the eventCount moved, so it must recompute.
    expect(derive(game.state, ORACLE, NO_SCRIPTS, bear, cache).power).toBe(3);
  });
});

/**
 * The fixture script. It exists to prove ONE property: a script is purely
 * additive, and a card without one costs zero registrations. It is never
 * shipped — no `CardScript` is registered in the app.
 */
const ANTHEM_OF_TESTING: CardScript = {
  oracleId: ORACLE.byName('Sol Ring')?.oracleId ?? '',
  name: 'Anthem of Testing',
  statics: [
    {
      abilityId: 'anthem',
      text: 'Creatures you control get +1/+0.',
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx: ScriptCtx, self, candidate) =>
        ctx.state.cards[candidate]?.controller === ctx.state.cards[self]?.controller &&
        ctx.state.cards[candidate]?.zone.kind === 'battlefield',
      modify: (chars: MutableCharacteristics) => {
        if (chars.power !== null) chars.power += 1;
      },
    },
  ],
};

describe('the script registry is purely additive', () => {
  test('a script-less card is zero registrations', () => {
    expect(NO_SCRIPTS.size).toBe(0);
    expect(NO_SCRIPTS.triggersFor('CardsMoved')).toEqual([]);
    expect(NO_SCRIPTS.staticsFor('ptModify')).toEqual([]);
    expect(NO_SCRIPTS.get('anything')).toBeUndefined();
  });

  test('a registered static reaches derive() with no call-site change', () => {
    const scripts = createRegistry([ANTHEM_OF_TESTING]);
    const game = startedGame({ decks: [['Grizzly Bears', 'Sol Ring']], scripts });
    put(game, 'p1', 'Grizzly Bears');
    const bear = find(game, 'p1', 'battlefield', 'Grizzly Bears');
    expect(d(game, bear).power).toBe(2);
    put(game, 'p1', 'Sol Ring');
    expect(d(game, bear).power).toBe(3);
    expect(d(game, bear).toughness).toBe(2);
  });

  test('the same board with no registry is unaffected', () => {
    const game = startedGame({ decks: [['Grizzly Bears', 'Sol Ring']] });
    put(game, 'p1', 'Grizzly Bears');
    put(game, 'p1', 'Sol Ring');
    const bear = find(game, 'p1', 'battlefield', 'Grizzly Bears');
    expect(d(game, bear).power).toBe(2);
  });
});
