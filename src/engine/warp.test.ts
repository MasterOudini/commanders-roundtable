// D547 - WARP: "You may cast this card from your hand for its warp cost. Exile this creature at the beginning of the next
// end step, then you may cast it from exile on a later turn." D449's keyword alternative cost, elected from the HAND
// alone; dash's delayed trigger armed as the spell resolves, exiling instead of returning; and foretell's per-card turn
// mark on that exile (`CardInstance.warpedTurn`), which offers the card's cast from exile, for its mana cost, on a later
// turn. What is proven here: the reading and the lines accounted; Bygone Colossus warped for {3} - on the battlefield,
// exiled at the next end step and marked, castable from exile on p1's next turn for {9} (and not for the warp cost), and
// then it stays; a warped permanent gone before the end step leaves no mark; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { linesUnaccounted } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { castsWarped, legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const LANDS = ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'];
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const castOffer = (g: Game, card: InstanceId) => legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card);

/** Bygone Colossus in hand, p1's third main phase, cast for its warp cost and resolved. */
function warped(): { g: Game; colossus: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Bygone Colossus', ...LANDS], [...LANDS]] });
  holdEverywhere(g);
  const colossus = put(g, 'p1', 'Bygone Colossus', 'hand');
  main(g, 3);
  const offer = castOffer(g, colossus);
  expect(offer && 'alternativeCostText' in offer ? offer.alternativeCostText : null, 'the warp cost offered from the hand').toBe('{3}');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: colossus, alternative: true }));
  settle(g);
  return { g, colossus };
}

describe('D547 - warp', () => {
  test('the reading: the warp cost, the lines accounted', () => {
    for (const [name, raw] of [['Bygone Colossus', '{3}'], ['Red Tiger Mechan', '{1}{R}']] as const) {
      const face = faceNamed(name);
      expect(face.alternativeCost?.keyword, name).toBe('warp');
      expect(face.alternativeCost?.costText, name).toBe(raw);
      const card = ENGINE_CARDS.find((c) => c.name === name);
      const printed = card?.faces[0];
      if (!card || !printed) throw new Error('no fixture ' + name);
      expect(linesUnaccounted(printed.oracleText, face, card.keywords).map((l) => l.text), `${name}: every line the engine's`).toEqual([]);
    }
  });

  test('warped: exiled at the next end step and marked; cast from exile on a later turn for its mana cost, and it stays', () => {
    const { g, colossus } = warped();
    expect(g.state.cards[colossus]?.zone.kind).toBe('battlefield');
    expect(g.state.delayedTriggers.some((d) => d.id.endsWith('-warp')), 'the end-step exile armed').toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(g.state.cards[colossus]?.zone.kind).toBe('exile');
    expect(g.state.cards[colossus]?.warpedTurn).toBe(3);
    main(g, 5);
    expect(castsWarped(g.state, colossus, 'p1'), 'a later turn').toBe(true);
    const offer = castOffer(g, colossus);
    expect(offer, 'offered from exile').toBeDefined();
    expect(offer && 'alternativeCostText' in offer ? offer.alternativeCostText : undefined, 'the warp cost is the hand\'s alone').toBeUndefined();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 9 }));
    const alt = g.submit({ t: 'CastSpell', player: 'p1', card: colossus, alternative: true });
    expect(alt.ok, 'the warp cost refused from exile').toBe(false);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: colossus }));
    settle(g);
    expect(g.state.cards[colossus]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[colossus]?.warpedTurn).toBeUndefined();
    expect(g.state.delayedTriggers.some((d) => d.id.endsWith('-warp')), 'cast for its mana cost, nothing armed').toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber === 6, 40_000);
    expect(g.state.cards[colossus]?.zone.kind, 'it stays').toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a warped permanent gone before the end step: nothing exiled, no mark', () => {
    const { g, colossus } = warped();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: colossus, to: { kind: 'graveyard', player: 'p1' } }));
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(g.state.cards[colossus]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[colossus]?.warpedTurn).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
