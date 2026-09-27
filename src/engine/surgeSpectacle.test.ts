// D567 - SURGE (CR 702.117a) and SPECTACLE (CR 702.137a): freerunning's mechanism (D566) - a keyword alternative cost
// with no rider under a condition the turn record already answers. Surge: another spell cast this turn by its caster
// (the free-for-all has no teammate - the turn record's `cast`, the spell itself excluded); spectacle: an opponent
// lost life this turn (the record's `lostLife`). Both conditions are the activation grammar's own reading. What is
// proven here: the reading (the lines are the faces' alternative costs under those conditions, and leave the spells'
// text); Boulder Salvo is not surged before another spell, and is for {1}{R} once Opt is cast - the condition the
// caster's alone; Skewer the Critics is not a spectacle before combat, and is for {R} once Grizzly Bears hits - the
// condition the caster's alone; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { activationConditionsHold } from './activationConditions';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const MOUNTAINS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const offered = (g: Game, card: InstanceId): boolean | null => {
  const offer = legalActions(g.state, deps().oracle, deps().scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);
  return offer?.t === 'CastSpell' ? (offer.alternativeAvailable ?? null) : null;
};
const mana = (g: Game, symbol: 'R' | 'U' | 'C', amount: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));

describe('D567 - surge and spectacle', () => {
  test("the reading: each line is the face's alternative cost under its turn-record condition, and leaves the spell's text", () => {
    const salvo = ORACLE.byName('Boulder Salvo')?.faces[0];
    expect(salvo?.alternativeCost?.keyword).toBe('surge');
    expect(salvo?.alternativeCost?.mana?.raw).toBe('{1}{R}');
    expect(salvo?.alternativeCost?.conditions).toEqual([{ kind: 'turnMemory', what: 'cast', who: 'you', count: 1, any: null, none: null, excludeSelf: true }]);
    expect(salvo?.effectMode).toBe('auto');
    const skewer = ORACLE.byName('Skewer the Critics')?.faces[0];
    expect(skewer?.alternativeCost?.keyword).toBe('spectacle');
    expect(skewer?.alternativeCost?.mana?.raw).toBe('{R}');
    expect(skewer?.alternativeCost?.conditions).toEqual([{ kind: 'turnMemory', what: 'lostLife', who: 'opponent', count: 1, any: null, none: null }]);
    expect(skewer?.effectMode).toBe('auto');
  });

  test("surge: Boulder Salvo for {1}{R} once another spell was cast this turn - the caster's alone", () => {
    const g = startedGame({ players: 2, decks: [['Boulder Salvo', 'Opt', ...MOUNTAINS], ['Grizzly Bears', ...MOUNTAINS]] });
    holdEverywhere(g);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const salvo = put(g, 'p1', 'Boulder Salvo', 'hand');
    const opt = put(g, 'p1', 'Opt', 'hand');
    main3(g);
    expect(offered(g, salvo), 'no other spell yet').toBe(false);
    mana(g, 'C', 1);
    mana(g, 'R', 1);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: salvo, targets: [{ kind: 'card', id: bears }], alternative: true }).ok, 'not surged before another spell').toBe(false);
    mana(g, 'U', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: opt, targets: [] }));
    settle(g);
    expect(offered(g, salvo), 'Opt was cast this turn').toBe(true);
    expect(activationConditionsHold(g.state, deps().oracle, deps().scripts, 'p2', salvo, ORACLE.byName('Boulder Salvo')?.faces[0]?.alternativeCost?.conditions ?? []), "Opt was p1's").toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: salvo, targets: [{ kind: 'card', id: bears }], alternative: true }));
    settle(g);
    const cast = g.log.find((e) => e.body.t === 'SpellCast' && e.body.obj.card === salvo);
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.alternativePaid : null).toBe(true);
    expect(g.state.cards[bears]?.zone.kind, 'four damage to the Bears').toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("spectacle: Skewer the Critics for {R} once an opponent lost life this turn - the caster's opponent", () => {
    const g = startedGame({ players: 2, decks: [['Skewer the Critics', 'Grizzly Bears', ...MOUNTAINS], ['Grizzly Bears', ...MOUNTAINS]] });
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const skewer = put(g, 'p1', 'Skewer the Critics', 'hand');
    main3(g);
    expect(offered(g, skewer), 'no life lost yet').toBe(false);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
    expect(g.state.players.p2?.life, 'the Bears hit').toBe(38);
    expect(offered(g, skewer), 'an opponent lost life this turn').toBe(true);
    expect(activationConditionsHold(g.state, deps().oracle, deps().scripts, 'p2', skewer, ORACLE.byName('Skewer the Critics')?.faces[0]?.alternativeCost?.conditions ?? []), "p2's opponent lost none").toBe(false);
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: skewer, targets: [{ kind: 'player', id: 'p2' }], alternative: true }));
    settle(g);
    expect(g.state.players.p2?.life, 'three to the face for {R}').toBe(35);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
