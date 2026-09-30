// D589 - EMERGE (CR 702.119a): `Emerge {cost}` is "you may cast this spell by paying [cost] and sacrificing a creature
// rather than paying its mana cost", and the total cost is reduced by the sacrificed creature's mana value - generic mana
// only, never below {0} (D312's floor; the reduction rides the tax the stages carry, as D563's harmonize tap does).
// What is proven: the parse (the face's alternative cost - keyword emerge, its mana, one creature to sacrifice; `Emerge
// from artifact` stays unread); the cast (Wretched Gryff {5}{U} sacrificing a mana value 4 creature pays {1}{U}, the
// creature gone before the SpellCast, the cut on `taxApplied`); the coloured floor (a mana value 10 leaves {U}); an
// under-reduced cast refused with nothing paid, the plain cast untouched; the offer priced with the best cut, its
// candidates largest mana value first and each value shipped for the preview (D53); no creature, no emerge; the hash.

import { describe, expect, test } from 'vitest';
import { parseAlternativeCost } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { createRegistry } from './scripts/registryCore';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const mana = (g: Game, sym: 'U' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
function game(p1deck: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [p1deck, ['Grizzly Bears']], scripts: createRegistry([]), options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
const toMain3 = (g: Game) =>
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const offerOf = (g: Game, card: InstanceId) => {
  const a = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((x) => x.t === 'CastSpell' && x.card === card);
  return a?.t === 'CastSpell' ? a : undefined;
};
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

describe('D589 - emerge: an alternative cost with a sacrifice, the total cost less the creature\'s mana value', () => {
  test('the parse: the face carries emerge, its mana and one creature to sacrifice; emerge from an artifact stays unread', () => {
    const pc = (raw: string) => parseManaCost(raw);
    expect(parseAlternativeCost('Emerge {5}{U}', pc)).toMatchObject({ keyword: 'emerge', costText: '{5}{U}', sacrificeCost: { count: 1 } });
    expect(parseAlternativeCost('Emerge {5}{U} (You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature\'s mana value.)', pc)?.keyword).toBe('emerge');
    expect(parseAlternativeCost('Emerge from artifact {5}{B}{B}', pc)).toBeNull();
    const gryff = ORACLE.byName('Wretched Gryff')?.faces[0]?.alternativeCost;
    expect(gryff?.keyword).toBe('emerge');
    expect(gryff?.mana?.raw).toBe('{5}{U}');
  });

  test('Wretched Gryff sacrificing a mana value 4 creature pays {1}{U}: the creature goes as a cost, before the SpellCast', () => {
    const g = game(['Wretched Gryff', 'Cyclops of One-Eyed Pass']);
    const cyc = put(g, 'p1', 'Cyclops of One-Eyed Pass');
    const gryff = put(g, 'p1', 'Wretched Gryff', 'hand');
    settle(g);
    toMain3(g);
    mana(g, 'U', 1);
    mana(g, 'C', 1);
    const before = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: gryff, alternative: true, sacrifice: [cyc] }));
    const evs = g.log.slice(before).map((e) => e.body);
    const sacAt = evs.findIndex((b) => b.t === 'CardsMoved' && b.moves.some((m) => m.card === cyc && m.to.kind === 'graveyard'));
    const castAt = evs.findIndex((b) => b.t === 'SpellCast');
    expect(sacAt, 'the Cyclops is sacrificed in the cost batch').toBeGreaterThanOrEqual(0);
    expect(castAt, 'before the SpellCast').toBeGreaterThan(sacAt);
    const cast = evs[castAt];
    expect(cast?.t === 'SpellCast' ? cast.obj.alternativePaid : null).toBe(true);
    expect(cast?.t === 'SpellCast' ? cast.obj.taxApplied : null, 'the cut rides the tax').toBe(-4);
    settle(g);
    expect(g.state.cards[cyc]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[gryff]?.zone.kind).toBe('battlefield');
    hashHolds(g);
  });

  test('the cut is generic only: a mana value 10 creature leaves the {U}', () => {
    const g = game(['Wretched Gryff', 'Decimator of the Provinces']);
    const big = put(g, 'p1', 'Decimator of the Provinces');
    const gryff = put(g, 'p1', 'Wretched Gryff', 'hand');
    settle(g);
    toMain3(g);
    mana(g, 'C', 1);
    const r0 = g.submit({ t: 'CastSpell', player: 'p1', card: gryff, alternative: true, sacrifice: [big] });
    expect(r0.ok, 'with only {C} the emerge is refused - the cut never pays the {U}').toBe(false);
    expect(g.state.cards[big]?.zone.kind, 'nothing was paid').toBe('battlefield');
    mana(g, 'U', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: gryff, alternative: true, sacrifice: [big] }));
    settle(g);
    expect(g.state.cards[big]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[gryff]?.zone.kind).toBe('battlefield');
    hashHolds(g);
  });

  test('an under-reduced emerge is refused and pays nothing; the plain cast is untouched', () => {
    const g = game(['Wretched Gryff', 'Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const gryff = put(g, 'p1', 'Wretched Gryff', 'hand');
    settle(g);
    toMain3(g);
    mana(g, 'U', 1);
    mana(g, 'C', 1);
    const r = g.submit({ t: 'CastSpell', player: 'p1', card: gryff, alternative: true, sacrifice: [bears] });
    expect(r.ok ? 'accepted' : r.reason).toBe('cannotAfford');
    expect(g.state.cards[bears]?.zone.kind, 'the Bears stay').toBe('battlefield');
    mana(g, 'C', 5);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: gryff }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'the plain cast sacrificed nothing').toBe('battlefield');
    expect(g.state.cards[gryff]?.zone.kind).toBe('battlefield');
    hashHolds(g);
  });

  test('the offer prices the best cut, lists the largest mana value first and ships each value for the preview', () => {
    const g = game(['Wretched Gryff', 'Grizzly Bears', 'Cyclops of One-Eyed Pass']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const cyc = put(g, 'p1', 'Cyclops of One-Eyed Pass');
    const gryff = put(g, 'p1', 'Wretched Gryff', 'hand');
    settle(g);
    toMain3(g);
    mana(g, 'U', 1);
    mana(g, 'C', 1);
    const offer = offerOf(g, gryff);
    expect(offer?.affordable, 'the plain {5}{U} is not').toBe(false);
    expect(offer?.alternativeAvailable).toBe(true);
    expect(offer?.alternativeAffordable, 'priced with the Cyclops (4): {1}{U}').toBe(true);
    expect(offer?.altPickVerb).toBe('sacrifice');
    expect(offer?.altPickCandidates, 'the largest mana value first').toEqual([cyc, bears]);
    expect(offer?.altPickManaValues).toEqual({ [cyc]: 4, [bears]: 2 });
  });

  test('no creature to sacrifice: the alternative is unavailable, and a stranger\'s creature is refused', () => {
    const g = game(['Wretched Gryff']);
    const gryff = put(g, 'p1', 'Wretched Gryff', 'hand');
    settle(g);
    toMain3(g);
    mana(g, 'U', 6);
    expect(offerOf(g, gryff)?.alternativeAvailable).toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: gryff, alternative: true, sacrifice: [] }).ok).toBe(false);
    const theirs = put(g, 'p2', 'Grizzly Bears');
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: gryff, alternative: true, sacrifice: [theirs] }).ok).toBe(false);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });
});
