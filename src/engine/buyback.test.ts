// D535 - BUYBACK (CR 702.27): the face reads `Buyback {M}` (and `Buyback—<cost>.`, by D530's verb-kicker grammar) as an
// optional additional cost; the cast announces it (`CastSpell.buyback`), the payment prices it, the stack object
// remembers it, and a spell that RESOLVES with it paid goes to its owner's hand instead of the graveyard. A spell that
// never resolves - its only target gone - still goes to the graveyard (the buyback returns it only as it resolves).
// What is proven here: the readings and the three spells complete; Searing Touch's offer, its price, its return to
// hand and its unbought cast to the graveyard; the fizzle; Constant Mists' land sacrifice; the replay hash.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const offerFor = (g: Game, card: InstanceId) => legalActions(g.state, deps().oracle, deps().scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const P2 = { kind: 'player', id: 'p2' } as const;

describe('D535 - buyback', () => {
  test('the readings: a mana buyback, a sacrifice and a discard buyback, and the three complete', () => {
    const touch = faceNamed('Searing Touch');
    expect(touch.buybackCost?.raw).toBe('{4}');
    expect(touch.buybackVerb).toBeNull();
    expect(touch.effectMode).toBe('auto');
    const mists = faceNamed('Constant Mists');
    expect(mists.buybackCost).toBeNull();
    expect(mists.buybackVerb?.sacrificeCost?.count).toBe(1);
    expect(mists.buybackVerb?.mana).toBeNull();
    expect(faceNamed('Forbid').buybackVerb?.discardCost?.count).toBe(2);
    expect(faceNamed('Grizzly Bears').buybackCost).toBeNull();
    // A spell is complete when every sentence reads (`effectMode` auto) - the Buyback line left out as a cost, not a clause.
    for (const name of ['Searing Touch', 'Constant Mists', 'Forbid']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('Searing Touch: offered with its buyback, priced {4} more, back in hand as it resolves - and to the graveyard unbought', () => {
    const g = startedGame({ players: 2, decks: [['Searing Touch', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const touch = put(g, 'p1', 'Searing Touch', 'hand');
    main3(g);
    mana(g, 'R', 1);
    const short = offerFor(g, touch);
    expect(short?.t === 'CastSpell' ? short.buyback : null).toBe('mana');
    expect(short?.t === 'CastSpell' ? short.buybackCost : null).toBe('{4}');
    expect(short?.t === 'CastSpell' ? short.buybackAffordable : null, '{R} alone does not buy it back').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: touch, targets: [P2], buyback: true }).ok, 'four more mana are owed').toBe(false);
    mana(g, 'C', 4);
    const offer = offerFor(g, touch);
    expect(offer?.t === 'CastSpell' ? offer.buybackAffordable : null).toBe(true);
    const life0 = g.state.players.p2?.life ?? 0;
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: touch, targets: [P2], buyback: true }));
    settle(g);
    const cast = g.log.slice(n0).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.buyback : null, 'the stack object remembers the buyback').toBe(true);
    expect(g.state.players.p2?.life).toBe(life0 - 1);
    expect(g.state.cards[touch]?.zone.kind, 'back in its owner hand').toBe('hand');
    const resolved = g.log.slice(n0).find((e) => e.body.t === 'StackResolved');
    expect(resolved?.body.t === 'StackResolved' ? resolved.body.buyback : null).toBe(true);
    expect(g.log.slice(n0).some((e) => e.body.t === 'Narrated' && JSON.stringify(e.body).includes('buyback was paid'))).toBe(true);
    // Cast again without it: the ping, and the graveyard.
    mana(g, 'R', 1);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: touch, targets: [P2] }));
    settle(g);
    const plain = g.log.slice(n1).find((e) => e.body.t === 'SpellCast');
    expect(plain?.body.t === 'SpellCast' ? plain.body.obj.buyback : 'no cast').toBeUndefined();
    expect(g.state.players.p2?.life).toBe(life0 - 2);
    expect(g.state.cards[touch]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a bought-back spell that never resolves - its target gone - goes to the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Searing Touch', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const touch = put(g, 'p1', 'Searing Touch', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main3(g);
    mana(g, 'R', 1);
    mana(g, 'C', 4);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: touch, targets: [{ kind: 'card', id: bears }], buyback: true }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    const n0 = g.log.length;
    settle(g);
    expect(g.log.slice(n0).some((e) => e.body.t === 'SpellFizzled')).toBe(true);
    expect(g.state.cards[touch]?.zone.kind, 'no resolution, no buyback').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Constant Mists: the verb buyback sacrifices the land the cast names, and the spell comes back', () => {
    const g = startedGame({ players: 2, decks: [['Constant Mists', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const mists = put(g, 'p1', 'Constant Mists', 'hand');
    const forest = put(g, 'p1', 'Forest');
    main3(g);
    mana(g, 'G', 2);
    const offer = offerFor(g, mists);
    expect(offer?.t === 'CastSpell' ? offer.buyback : null).toBe('verb');
    expect(offer?.t === 'CastSpell' ? offer.buybackPickVerb : null).toBe('sacrifice');
    expect(offer?.t === 'CastSpell' ? offer.buybackPickCandidates : null).toContain(forest);
    expect(offer?.t === 'CastSpell' ? offer.buybackAffordable : null).toBe(true);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: mists, targets: [], buyback: true }).ok, 'the verb wants its land').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: mists, targets: [], sacrifice: [forest] }).ok, 'a sacrifice with no buyback').toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: mists, targets: [], buyback: true, sacrifice: [forest] }));
    settle(g);
    expect(g.state.cards[forest]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mists]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
