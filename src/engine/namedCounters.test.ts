// D611 - THE NAMED COUNTER ON ITS OWN PERMANENT. `Put a charge counter on this artifact.` (Golem Foundry, Aether Vial, the
// Quests, the Shrines, the verse enchantments) puts a counter of a kind the engine applies nothing for by itself - the
// card's OWN text reads it back: a remove cost (D319 already reads any kind on the source), `for each charge counter on
// this artifact`, `where X is the number of page counters on this artifact`. The count (`CountExpr` `selfCounters`) reads
// the source as the resolution finds it - the counters an earlier clause of the same resolution put included - or, when
// the cost moved it (a sacrifice, a return to the hand), its counters as they last existed, stamped on the stack object
// (CR 608.2h). What is proven: the vocabulary reads the put and the counts and refuses a named kind on a target; a clause
// counts the counter the clause before it put; a sacrificed artifact's counters are read as they last existed; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

/** `name`'s printed activated ability at `index`, resolving `payload` through the vocabulary. */
function activation(name: string, index: number, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    activated: [{
      ref: card.oracleId + '#a' + index,
      text: card.faces[0]?.oracleText ?? '',
      ...(targets.length > 0 ? { targets } : {}),
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

function myMain(g: Game): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
}

describe('D611 - the named counter on its own permanent', () => {
  test('the vocabulary reads the put and the counts, and refuses a named kind on a target', () => {
    const put1 = vocabularyEffects('Put a charge counter on this artifact.', 'Golem Foundry');
    expect(put1.map((e) => [e.kind, e.counterKind, e.amount, e.self])).toEqual([['putCounters', 'charge', 1, true]]);
    const put2 = vocabularyEffects('Put two verse counters on this enchantment.', 'Vile Requiem');
    expect(put2.map((e) => [e.kind, e.counterKind, e.amount])).toEqual([['putCounters', 'verse', 2]]);
    const each = vocabularyEffects('Draw a card for each charge counter on this artifact.', 'Mind Stone');
    expect(each.map((e) => [e.kind, e.per])).toEqual([['draw', { kind: 'selfCounters', counter: 'charge' }]]);
    const wx = vocabularyEffects('Draw X cards, where X is the number of page counters on this artifact.', "Barrin's Codex");
    expect(wx.map((e) => [e.kind, e.per])).toEqual([['draw', { kind: 'selfCounters', counter: 'page' }]]);
    // The `equal to the number of` print (Golden Urn, Shrine of Burning Rage, Time Bomb): the amount is the count.
    const kindPer = (p: string, n: string) => vocabularyEffects(p, n).map((e) => [e.kind, e.per]);
    expect(kindPer('You gain life equal to the number of charge counters on this artifact.', 'Golden Urn')).toEqual([['gainLife', { kind: 'selfCounters', counter: 'charge' }]]);
    expect(kindPer('This artifact deals damage equal to the number of charge counters on it to any target.', 'Shrine of Burning Rage')).toEqual([['damage', { kind: 'selfCounters', counter: 'charge' }]]);
    expect(kindPer('This artifact deals damage equal to the number of time counters on it to each creature and each player.', 'Time Bomb').map((x) => x[1])).toEqual([{ kind: 'selfCounters', counter: 'time' }]);
    // `on it` is the source only when the source deals the damage.
    expect(() => vocabularyEffects('Target creature deals damage equal to the number of charge counters on it to any target.', 'X')).toThrow();
    // `Then` before the counted sentence orders the clauses only (Cephalid Vandal).
    const then = vocabularyEffects('Put a shred counter on this creature. Then mill a card for each shred counter on this creature.', 'Cephalid Vandal');
    expect(then.map((e) => [e.kind, e.per?.kind ?? null])).toEqual([['putCounters', null], ['mill', 'selfCounters']]);
    expect(() => vocabularyEffects('Put a charge counter on target artifact.', 'Coretapper')).toThrow();
  });

  test('a clause counts the counter the clause before it put', () => {
    const staff = ORACLE.byName('Staff of Nin');
    const index = staff?.faces[0]?.activated.findIndex((a) => !a.isManaAbility) ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    const script = activation('Staff of Nin', index, 'Put a charge counter on this artifact. You gain 1 life for each charge counter on this artifact.');
    const g = startedGame({ players: 2, decks: [['Staff of Nin', ...TEN], [...TEN]], scripts: createRegistry([script]) });
    settle(g);
    holdEverywhere(g);
    const id = put(g, 'p1', 'Staff of Nin');
    settle(g);
    myMain(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: id, kind: 'charge', delta: 1 }));
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: index }));
    settle(g);
    expect(g.state.cards[id]?.counters['charge'], 'the put landed').toBe(2);
    expect(g.state.players.p1?.life, 'the count read the counter the first clause put').toBe(life0 + 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a count is read as its clause applies - after the draw before it (CR 608.2h)', () => {
    // Master the Way, on the oracle alone: `Draw a card. Master the Way deals damage to any target equal to the number of
    // cards in your hand.` - the hand is counted with the card the first clause drew.
    const g = startedGame({ players: 2, decks: [['Master the Way', ...TEN], [...TEN]], scripts: createRegistry([]) });
    settle(g);
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Master the Way', 'hand');
    settle(g);
    myMain(g);
    for (const symbol of ['U', 'R'] as const) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const life0 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    const hand = (g.state.zones.hand.p1 ?? []).length;
    expect(g.state.players.p2?.life, 'the damage is the hand after the draw').toBe(life0 - hand);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("a sacrificed artifact's counters are read as they last existed", () => {
    const stone = ORACLE.byName('Mind Stone');
    const index = stone?.faces[0]?.activated.findIndex((a) => a.sacrificesSelf) ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    const script = activation('Mind Stone', index, 'Draw a card for each charge counter on this artifact.');
    const g = startedGame({ players: 2, decks: [['Mind Stone', ...TEN], [...TEN]], scripts: createRegistry([script]) });
    settle(g);
    holdEverywhere(g);
    const id = put(g, 'p1', 'Mind Stone');
    settle(g);
    myMain(g);
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: id, kind: 'charge', delta: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: index }));
    settle(g);
    expect(g.state.cards[id]?.zone.kind, 'the cost sacrificed it').toBe('graveyard');
    expect((g.state.zones.hand.p1 ?? []).length, 'two counters as it last existed - two cards').toBe(hand0 + 2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
