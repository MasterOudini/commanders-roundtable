// D490 - THE CONDITIONAL FREE CAST. `If <condition>, you may cast this spell without paying its mana cost.` is an
// ALTERNATIVE COST of nothing (D408's shape: `AlternativeCost` with `mana` null and `free`) under the activation
// grammar's conditions - two the family needed are new: `you control a commander` and the Legate cycle's `an opponent
// controls a Plains and you control a Swamp`. The offer prices it at nothing when the conditions hold, the handler
// re-asks them, and the cast pays nothing; the line leaves the effect text, so the card's other sentences read as
// before. What is proven here: the parser's readings and refusals; a Legate cast free with both boards set and
// refused without the opponent's land; Deadly Rollick free only with a commander on the battlefield; the replay hash.
import { describe, expect, test } from 'vitest';
import { parseAlternativeCost } from '../data/activatedParse';
import { parseManaCost } from '../data/oracleParse';
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

describe('D490 - the conditional free cast', () => {
  test('the parser reads the two conditions, keeps the line out of the effects, and refuses the bare form', () => {
    const legate = faceNamed('Cho-Arrim Legate').alternativeCost;
    expect(legate?.free).toBe(true);
    expect(legate?.mana).toBeNull();
    expect(legate?.conditions).toEqual([{ kind: 'acrossControl', theirs: [{ supertypes: [], types: [], subtypes: ['Swamp'], colors: [] }], yours: [{ supertypes: [], types: [], subtypes: ['Plains'], colors: [] }] }]);
    const rollick = faceNamed('Deadly Rollick');
    expect(rollick.alternativeCost?.free).toBe(true);
    expect(rollick.alternativeCost?.conditions).toEqual([{ kind: 'controlsCommander' }]);
    expect(rollick.effectMode).toBe('auto');
    expect(rollick.effects.map((e) => e.kind)).toEqual(['exile']);
    expect(parseAlternativeCost('You may cast this spell without paying its mana cost.', parseManaCost)).toBeNull();
    expect(parseAlternativeCost("If you've had a very good day, you may cast this spell without paying its mana cost.", parseManaCost)).toBeNull();
  });

  test('a Legate is not free without the opponent land, and is cast free once both boards are set', () => {
    const g = startedGame({ players: 2, decks: [['Cho-Arrim Legate', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    put(g, 'p1', 'Plains');
    const legate = put(g, 'p1', 'Cho-Arrim Legate', 'hand');
    main3(g);
    const before = offerFor(g, legate);
    expect(before?.t === 'CastSpell' ? before.alternativeAvailable : null, 'no Swamp across the table').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: legate, targets: [], alternative: true }).ok, 'not free').toBe(false);
    put(g, 'p2', 'Swamp');
    const offer = offerFor(g, legate);
    expect(offer?.t === 'CastSpell' ? offer.alternativeAvailable : null).toBe(true);
    expect(offer?.t === 'CastSpell' ? offer.alternativeAffordable : null).toBe(true);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: legate, targets: [], alternative: true }));
    settle(g);
    expect(g.state.cards[legate]?.zone.kind).toBe('battlefield');
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === legate);
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.alternativePaid : null).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Deadly Rollick is free only with a commander on the battlefield', () => {
    const g = startedGame({ players: 2, decks: [['Deadly Rollick', 'Grizzly Bears'], ['Grizzly Bears']] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const rollick = put(g, 'p1', 'Deadly Rollick', 'hand');
    main3(g);
    expect(offerFor(g, rollick)?.t === 'CastSpell' ? (offerFor(g, rollick) as { alternativeAvailable?: boolean }).alternativeAvailable : null).toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: rollick, targets: [{ kind: 'card', id: bears }], alternative: true }).ok, 'no commander yet').toBe(false);
    const commander = g.state.zones.command.p1?.[0] as InstanceId;
    expect(g.state.cards[commander]?.isCommander).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: commander, to: { kind: 'battlefield', player: 'p1' } }));
    expect(g.state.cards[commander]?.isCommander, 'the mark rides the card').toBe(true);
    expect(offerFor(g, rollick)?.t === 'CastSpell' ? (offerFor(g, rollick) as { alternativeAvailable?: boolean }).alternativeAvailable : null).toBe(true);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: rollick, targets: [{ kind: 'card', id: bears }], alternative: true }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind, 'exiled for nothing').toBe('exile');
    expect(g.state.cards[rollick]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
