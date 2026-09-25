// D540 - FORETELL (CR 702.143a): "Any time a player has priority during their turn, that player may pay {2} and exile a
// card with foretell from their hand face down. That player may look at that card as long as it remains in exile. They
// may cast that card after the current turn has ended by paying any foretell cost it has rather than paying that spell's
// mana cost." Suspend's shape for the special action (D489), flashback's for the cast from another zone (D307), the
// alternative cost's one-at-a-time rule (D408). What is proven here: the reading and the cards complete; Demon Bolt
// foretold for {2} - exiled face down, hidden from the table and seen by its owner, the log naming no card - refused the
// same turn and cast on a later one for {R}; the timing (the owner's own turn only, a spell on the stack no bar); a
// back-out returning the card face down and foretold on the turn it was; a foretold creature entering; a foretold card
// moved out of exile another way foretold no more; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { project } from './project';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';
import type { TargetChoice } from './types/state';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Island', 'Island', 'Island', 'Island'];
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, who: 'p1' | 'p2', sym: 'U' | 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: sym, amount: n }));
const view = (g: Game, who: PlayerId) => project(g.state, deps().oracle, g.deps.scripts, who);
const offers = (g: Game, t: 'Foretell' | 'CastSpell', card: InstanceId) => legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').some((a) => a.t === t && a.card === card);
const P2: TargetChoice = { kind: 'player', id: 'p2' };

describe('D540 - foretell', () => {
  test('the reading: the foretell cost off the keyword line, the cards complete', () => {
    expect(faceNamed('Behold the Multiverse').foretellCost?.raw).toBe('{1}{U}');
    expect(faceNamed('Demon Bolt').foretellCost?.raw).toBe('{R}');
    expect(faceNamed('Augury Raven').foretellCost?.raw).toBe('{1}{U}');
    expect(faceNamed('Doomskar').foretellCost?.raw).toBe('{1}{W}{W}');
    expect(faceNamed('Grizzly Bears').foretellCost).toBeNull();
    expect(faceNamed('Demon Bolt').effectMode, 'the Foretell line no clause of the spell').toBe('auto');
    for (const name of ['Behold the Multiverse', 'Demon Bolt', 'Augury Raven', 'Doomskar']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('foretold for {2}: face down, hidden from the table, seen by its owner - and cast on a later turn for {R}', () => {
    const g = startedGame({ players: 2, decks: [['Demon Bolt', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    const bolt = put(g, 'p1', 'Demon Bolt', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main(g, 3);
    expect(offers(g, 'Foretell', bolt), 'offered on its owner turn').toBe(true);
    mana(g, 'p1', 'C', 2);
    const n0 = g.log.length;
    must(g.submit({ t: 'Foretell', player: 'p1', card: bolt }));
    expect(g.state.cards[bolt]?.zone.kind).toBe('exile');
    expect(g.state.cards[bolt]?.faceDown).toBe(true);
    expect(g.state.cards[bolt]?.foretoldTurn).toBe(3);
    expect(g.state.stack, 'a special action: no stack').toHaveLength(0);
    expect(g.state.priority.player, 'the player keeps priority').toBe('p1');
    expect(view(g, 'p2').cards[bolt]?.card ?? null, 'the table sees a face-down card').toBeNull();
    expect(view(g, 'p1').cards[bolt]?.card?.name, 'its owner looks at it').toBe('Demon Bolt');
    const told = g.log.slice(n0).filter((e) => e.body.t === 'Narrated').map((e) => (e.body.t === 'Narrated' ? e.body.text : ''));
    expect(told.some((t) => /foretells a card/.test(t))).toBe(true);
    expect(told.some((t) => /Demon Bolt/.test(t)), 'the log names no card').toBe(false);
    mana(g, 'p1', 'R', 3);
    expect(offers(g, 'CastSpell', bolt), 'not the turn it was foretold').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    main(g, 5);
    mana(g, 'p1', 'R', 1);
    expect(offers(g, 'CastSpell', bolt), 'a later turn').toBe(true);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    const cast = g.log.slice(n1).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.castFrom?.kind : null, 'cast from exile').toBe('exile');
    const spent = g.log.slice(n1).find((e) => e.body.t === 'ManaSpent');
    expect(spent?.body.t === 'ManaSpent' ? spent.body.mana : null, 'the foretell cost, not {2}{R}').toMatchObject({ W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 });
    expect(g.state.cards[bears]?.zone.kind, 'four damage').toBe('graveyard');
    expect(g.state.cards[bolt]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bolt]?.foretoldTurn).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the timing: only during its owner turn - and a spell on the stack is no bar', () => {
    const g = startedGame({ players: 2, decks: [['Demon Bolt', 'Lightning Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const demon = put(g, 'p1', 'Demon Bolt', 'hand');
    const shock = put(g, 'p1', 'Lightning Bolt', 'hand');
    main(g, 4, 'p2');
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    mana(g, 'p1', 'C', 2);
    expect(offers(g, 'Foretell', demon), 'not offered on the opponent turn').toBe(false);
    expect(g.submit({ t: 'Foretell', player: 'p1', card: demon }).ok, 'not on the opponent turn').toBe(false);
    main(g, 5);
    mana(g, 'p1', 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shock, targets: [P2] }));
    expect(g.state.stack).toHaveLength(1);
    expect(g.state.priority.player).toBe('p1');
    mana(g, 'p1', 'C', 2);
    expect(offers(g, 'Foretell', demon), 'offered with the Bolt on the stack').toBe(true);
    must(g.submit({ t: 'Foretell', player: 'p1', card: demon }));
    expect(g.state.cards[demon]?.zone.kind).toBe('exile');
    expect(g.state.stack, 'the Bolt alone').toHaveLength(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('backed out of: face down again, foretold on the turn it was, and cast after all', () => {
    const g = startedGame({ players: 2, decks: [['Demon Bolt', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    const bolt = put(g, 'p1', 'Demon Bolt', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main(g, 3);
    mana(g, 'p1', 'C', 2);
    must(g.submit({ t: 'Foretell', player: 'p1', card: bolt }));
    main(g, 5);
    mana(g, 'p1', 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt }));
    expect(g.state.pendingCast?.stage).toBe('targets');
    expect(g.state.cards[bolt]?.zone.kind).toBe('stack');
    expect(g.state.cards[bolt]?.faceDown, 'cast face up').toBe(false);
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(g.state.cards[bolt]?.zone.kind).toBe('exile');
    expect(g.state.cards[bolt]?.faceDown).toBe(true);
    expect(g.state.cards[bolt]?.foretoldTurn, 'the turn it was foretold').toBe(3);
    expect(view(g, 'p2').cards[bolt]?.card ?? null).toBeNull();
    expect(view(g, 'p1').cards[bolt]?.card?.name).toBe('Demon Bolt');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a foretold creature enters for its foretell cost; a foretold card moved out of exile another way is foretold no more', () => {
    const g = startedGame({ players: 2, decks: [['Augury Raven', 'Demon Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const raven = put(g, 'p1', 'Augury Raven', 'hand');
    const bolt = put(g, 'p1', 'Demon Bolt', 'hand');
    main(g, 3);
    mana(g, 'p1', 'C', 4);
    must(g.submit({ t: 'Foretell', player: 'p1', card: raven }));
    must(g.submit({ t: 'Foretell', player: 'p1', card: bolt }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    expect(g.state.cards[bolt]?.foretoldTurn, 'no longer foretold').toBeUndefined();
    main(g, 5);
    mana(g, 'p1', 'U', 1);
    mana(g, 'p1', 'C', 1);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: raven }));
    settle(g);
    const spent = g.log.slice(n0).find((e) => e.body.t === 'ManaSpent');
    expect(spent?.body.t === 'ManaSpent' ? spent.body.mana : null, '{1}{U}, not {3}{U}').toMatchObject({ U: 1, C: 1 });
    expect(g.state.cards[raven]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[raven]?.faceDown).toBe(false);
    expect(g.state.cards[raven]?.foretoldTurn).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
