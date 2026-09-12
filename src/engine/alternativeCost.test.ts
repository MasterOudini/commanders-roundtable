// D408 - THE ALTERNATIVE COST AT CAST (CR 118.9): "You may <cost> rather than pay this spell's mana
// cost." - read by the cost grammar (D406's) with the mana REPLACED: a mana payment, a life payment, one
// chooser verb or the pitch, under a condition the activation grammar reads. Elected by the cast
// (`CastSpell.alternative`); the offer carries whether it can be elected now and what it needs; the
// line is claimed in the coverage and dropped from a spell's clauses, so Fireblast reads whole.

import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { replay, stateHash } from './log';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { legalActions } from './legal';
import { createRegistry, SHIPPED_SCRIPTS } from './scripts/registry';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
const mana = (g: Game, sym: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', n: number, player: 'p1' | 'p2' = 'p1') =>
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol: sym, amount: n }));
function armed(decks: readonly (readonly string[])[]): Game {
  const g = startedGame({ players: 2, decks, scripts: createRegistry([...SHIPPED_SCRIPTS]) });
  holdEverywhere(g);
  settle(g);
  const t0 = g.state.turn.turnNumber;
  advanceUntil(g, (s) => s.turn.turnNumber === t0 + 2 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return g;
}
const SCRIPTS = createRegistry([...SHIPPED_SCRIPTS]);
const offerOf = (g: Game, card: string) => legalActions(g.state, ORACLE, SCRIPTS, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);

describe('the alternative cost at cast (D408)', () => {
  test('the faces read: Fireblast, Daze, Force of Will, the Borderpost, Ramosian Rally, Snuff Out; the claim', () => {
    const fire = ORACLE.byName('Fireblast');
    expect(fire?.faces[0]?.alternativeCost?.sacrificeCost?.count).toBe(2);
    expect(fire ? engineCompleteness(fire.data) : null, 'Fireblast reads whole').toEqual({ complete: true, leftover: [] });
    expect(ORACLE.byName('Daze')?.faces[0]?.alternativeCost?.returnCost?.count).toBe(1);
    const fow = ORACLE.byName('Force of Will')?.faces[0]?.alternativeCost;
    expect(fow?.lifeCost).toBe(1);
    expect(fow?.exileFromHand).toEqual({ count: 1, colors: ['U'] });
    const post = ORACLE.byName('Mistvein Borderpost')?.faces[0]?.alternativeCost;
    expect(post?.mana?.raw).toBe('{1}');
    expect(post?.returnCost?.count).toBe(1);
    expect(ORACLE.byName('Ramosian Rally')?.faces[0]?.alternativeCost?.conditions.map((c) => c.kind)).toEqual(['board']);
    expect(ORACLE.byName('Snuff Out')?.faces[0]?.alternativeCost?.lifeCost).toBe(4);
  });

  test('Fireblast: the offer carries the alternative and its two Mountains; elected, the Mountains are sacrificed and no mana is spent; without the election the mana cost stands', () => {
    const g = armed([['Fireblast', 'Mountain', 'Mountain', 'Mountain'], ['Cyclops of One-Eyed Pass']]);
    const m1 = put(g, 'p1', 'Mountain');
    const m2 = put(g, 'p1', 'Mountain');
    const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const fire = put(g, 'p1', 'Fireblast', 'hand');
    const offer = offerOf(g, fire);
    expect(offer?.t === 'CastSpell' ? offer.alternativeCostText : null).toBe('sacrifice two Mountains');
    expect(offer?.t === 'CastSpell' ? offer.alternativeAvailable : null).toBe(true);
    expect(offer?.t === 'CastSpell' ? offer.altPickVerb : null).toBe('sacrifice');
    expect(offer?.t === 'CastSpell' ? offer.altPickCandidates?.length : null).toBe(2);
    expect(offer?.t === 'CastSpell' ? offer.affordable : null, '{4}{R}{R} with no mana').toBe(false);
    const one = g.submit({ t: 'CastSpell', player: 'p1', card: fire, targets: [{ kind: 'card', id: cyclops }], alternative: true, sacrifice: [m1] });
    expect(one.ok).toBe(false);
    if (!one.ok) expect(one.reason).toBe('needsSacrifice');
    const plain = g.submit({ t: 'CastSpell', player: 'p1', card: fire, targets: [{ kind: 'card', id: cyclops }] });
    expect(plain.ok).toBe(false);
    const life0 = g.state.players.p2?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fire, targets: [{ kind: 'card', id: cyclops }], alternative: true, sacrifice: [m1, m2] }));
    expect(g.state.cards[m1]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[m2]?.zone.kind).toBe('graveyard');
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === fire);
    expect(cast && cast.body.t === 'SpellCast' ? cast.body.obj.alternativePaid : null).toBe(true);
    settle(g);
    expect(g.state.cards[cyclops]?.zone.kind, 'four damage to the 5/2').toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(life0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Ramosian Rally needs a Plains on the board and taps the creature; Snuff Out pays four life under a Swamp; Force of Will pitches a blue card and a life on the opponent\'s turn', () => {
    const g = armed([['Force of Will', 'Counterspell', 'Ramosian Rally', 'Snuff Out', 'Grizzly Bears', 'Plains', 'Swamp'], ['Cyclops of One-Eyed Pass', 'Grizzly Bears']]);
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const rally = put(g, 'p1', 'Ramosian Rally', 'hand');
    const offer0 = offerOf(g, rally);
    expect(offer0?.t === 'CastSpell' ? offer0.alternativeAvailable : null, 'no Plains: the alternative cannot be elected').toBe(false);
    const refused = g.submit({ t: 'CastSpell', player: 'p1', card: rally, targets: [], alternative: true, tap: [bears] });
    expect(refused.ok).toBe(false);
    put(g, 'p1', 'Plains');
    settle(g);
    const offer1 = offerOf(g, rally);
    expect(offer1?.t === 'CastSpell' ? offer1.alternativeAvailable : null).toBe(true);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rally, targets: [], alternative: true, tap: [bears] }));
    expect(g.state.cards[bears]?.tapped, 'tapped to pay').toBe(true);
    settle(g);
    put(g, 'p1', 'Swamp');
    settle(g);
    const theirs = put(g, 'p2', 'Cyclops of One-Eyed Pass');
    settle(g);
    const snuff = put(g, 'p1', 'Snuff Out', 'hand');
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: snuff, targets: [{ kind: 'card', id: theirs }], alternative: true }));
    expect(g.state.players.p1?.life).toBe(life0 - 4);
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    const fow = put(g, 'p1', 'Force of Will', 'hand');
    const blue = put(g, 'p1', 'Counterspell', 'hand');
    const tNow = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber === tNow + 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p2' && s.priority.awaiting === null, 20_000);
    const bearsSpell = put(g, 'p2', 'Grizzly Bears', 'hand');
    mana(g, 'G', 2, 'p2');
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bearsSpell, targets: [] }));
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    const offer2 = offerOf(g, fow);
    expect(offer2?.t === 'CastSpell' ? offer2.altPickVerb : null).toBe('exileFromHand');
    expect(offer2?.t === 'CastSpell' ? offer2.altPickCandidates : null, 'the blue card, never Force itself').toEqual([blue]);
    const top = g.state.stack[g.state.stack.length - 1]?.id as string;
    const self = g.submit({ t: 'CastSpell', player: 'p1', card: fow, targets: [{ kind: 'stack', id: top }], alternative: true, exileFromHand: [fow] });
    expect(self.ok).toBe(false);
    const life1 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: fow, targets: [{ kind: 'stack', id: top }], alternative: true, exileFromHand: [blue] }));
    expect(g.state.cards[blue]?.zone.kind).toBe('exile');
    expect(g.state.players.p1?.life).toBe(life1 - 1);
    settle(g);
    expect(g.state.cards[bearsSpell]?.zone.kind, 'countered').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
