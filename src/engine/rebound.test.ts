// D538 - REBOUND (CR 702.88a): "If you cast this spell from your hand, exile it as it resolves. At the beginning of your
// next upkeep, you may cast this card from exile without paying its mana cost." Suspend's shape (D489): the resolution
// exiles a spell cast from the hand and arms a delayed trigger at its controller's next upkeep; the trigger offers the
// free cast over a pool of one (D525's chooser), a declined card staying in exile. What is proven here: the reading and
// the card complete; Staggershock cast from the hand, exiled, offered at the next upkeep and cast for nothing - then to
// the graveyard, since a cast from exile does not rebound; the offer declined, the card left in exile; a countered spell
// never rebounding; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { TargetChoice } from './types/state';

const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, sym: 'U' | 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const life = (g: Game, who: 'p1' | 'p2') => g.state.players[who]?.life ?? 0;
const P2: TargetChoice = { kind: 'player', id: 'p2' };
/** Walks to p1's next upkeep offer: the free-cast chooser over the rebounded card. */
const toOffer = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.castFree === true, 60_000);

describe('D538 - rebound', () => {
  test('the reading: the face flag, the card complete', () => {
    expect(faceNamed('Staggershock').rebound).toBe(true);
    expect(faceNamed('Staggershock').effectMode).toBe('auto');
    expect(faceNamed('Grizzly Bears').rebound).toBe(false);
    expect(isEngineComplete(fixture('Staggershock'))).toBe(true);
  });

  test('cast from the hand: exiled, offered at the next upkeep, cast for nothing - and then to the graveyard', () => {
    const g = startedGame({ players: 2, decks: [['Staggershock', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const shock = put(g, 'p1', 'Staggershock', 'hand');
    main3(g);
    const life0 = life(g, 'p2');
    mana(g, 'R', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shock, targets: [P2] }));
    settle(g);
    expect(life(g, 'p2')).toBe(life0 - 2);
    expect(g.state.cards[shock]?.zone.kind, 'exiled as it resolves').toBe('exile');
    expect(g.state.delayedTriggers.some((d) => d.source === shock), 'the upkeep trigger armed').toBe(true);
    toOffer(g);
    const aw = g.state.priority.awaiting;
    expect(aw?.kind === 'chooseFromZone' ? aw.pool : null).toEqual([shock]);
    expect(aw?.kind === 'chooseFromZone' ? aw.declineStays : null).toBe(true);
    expect(g.state.turn.step, "at the controller's upkeep").toBe('upkeep');
    expect(g.state.turn.activePlayer).toBe('p1');
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [shock] }));
    advanceUntil(g, (s) => s.pendingCast?.stage === 'targets' || (s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null), 20_000);
    if (g.state.pendingCast?.stage === 'targets') must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [P2] }));
    settle(g);
    const cast = g.log.slice(n0).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.castFrom?.kind : null, 'cast from exile').toBe('exile');
    expect(life(g, 'p2'), 'the second 2').toBe(life0 - 4);
    expect(g.state.cards[shock]?.zone.kind, 'a cast from exile does not rebound again').toBe('graveyard');
    expect(g.state.delayedTriggers.some((d) => d.source === shock)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declined at the upkeep: the card stays in exile and its permission goes', () => {
    const g = startedGame({ players: 2, decks: [['Staggershock', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const shock = put(g, 'p1', 'Staggershock', 'hand');
    main3(g);
    mana(g, 'R', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shock, targets: [P2] }));
    settle(g);
    toOffer(g);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    expect(g.state.cards[shock]?.zone.kind, 'left in exile').toBe('exile');
    expect(g.state.playPermissions.some((p) => p.card === shock)).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a spell that never resolves never rebounds', () => {
    const g = startedGame({ players: 2, decks: [['Staggershock', 'Grizzly Bears', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    const shock = put(g, 'p1', 'Staggershock', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    main3(g);
    mana(g, 'R', 1);
    mana(g, 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: shock, targets: [{ kind: 'card', id: bears }] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[shock]?.zone.kind, 'fizzled to the graveyard').toBe('graveyard');
    expect(g.state.delayedTriggers.some((d) => d.source === shock), 'no rebound armed').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
