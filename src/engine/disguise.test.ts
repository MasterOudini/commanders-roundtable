// D460 - DISGUISE (CR 702.168): "Disguise {cost}" is morph's shape - cast face down as a 2/2 for {3}, turned face up
// for the cost - with one rule more: the face-down permanent has WARD {2}. The parser reads the word beside Morph
// (`OracleFace.disguise`); the host's ward tax charges a face-down disguised permanent {2} off the printing it holds,
// and the client's preview charges the same off the PUBLIC view flag (`CardView.disguised`) - one shared constant
// (D53). A face-down MORPH charges nothing (the printed ward is not on the object, CR 708.2). Proven on Museum
// Nightwatch: the face-down cast, the opponent's Bolt refused short of the ward and accepted with it, the turn face up
// for {1}{W} and the ward gone, the view flag for the opponent, the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { legalActions } from './legal';
import { project } from './project';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function mana(g: Game, player: 'p1' | 'p2', symbol: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player, target: player, symbol, amount }));
}
function armed(): { g: Game; card: InstanceId; bolt: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Museum Nightwatch'], ['Cyclops of One-Eyed Pass', 'Lightning Bolt']], scripts: createRegistry([]) });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  const bolt = put(g, 'p2', 'Lightning Bolt', 'hand');
  settle(g);
  const card = put(g, 'p1', 'Museum Nightwatch', 'hand');
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  mana(g, 'p1', 'C', 3);
  must(g.submit({ t: 'CastSpell', player: 'p1', card, faceDown: true, targets: [] }));
  settle(g);
  return { g, card, bolt };
}
function p2Priority(g: Game): void {
  advanceUntil(g, (s) => s.priority.player === 'p2' && s.priority.awaiting === null && s.stack.length === 0, 20_000);
}

describe('D460 - the parse', () => {
  test('Disguise is read beside Morph: the cost, the flag; a Morph card carries no flag', () => {
    const nightwatch = ORACLE.byName('Museum Nightwatch')?.faces[0];
    expect(nightwatch?.morphCostText).toBe('{1}{W}');
    expect(nightwatch?.disguise).toBe(true);
    expect(nightwatch?.megamorph).toBe(false);
    const craghorn = ORACLE.byName('Battering Craghorn')?.faces[0];
    expect(craghorn?.morphCost).not.toBeNull();
    expect(craghorn?.disguise).toBe(false);
  });
});

describe('D460 - the face-down disguised permanent has ward {2} (Museum Nightwatch)', () => {
  test('cast face down for {3}: a 2/2; the opponent sees the public disguise flag and no identity', () => {
    const { g, card } = armed();
    expect(g.state.cards[card]?.faceDown).toBe(true);
    const theirs = project(g.state, ORACLE, g.deps.scripts, 'p2');
    expect(theirs.cards[card]?.card).toBeNull();
    expect(theirs.cards[card]?.faceDown).toBe(true);
    expect(theirs.cards[card]?.disguised).toBe(true);
    expect(theirs.cards[card]?.power).toBe(2);
  });

  test('the opponent Bolt is refused short of the ward and accepted with {2} more', () => {
    const { g, card, bolt } = armed();
    p2Priority(g);
    mana(g, 'p2', 'R', 1);
    const short = g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'card', id: card }] });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toBe('cannotAfford');
    mana(g, 'p2', 'C', 2);
    must(g.submit({ t: 'CastSpell', player: 'p2', card: bolt, targets: [{ kind: 'card', id: card }] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
  });

  test('turned face up for {1}{W} the ward is gone and the printed card is back', () => {
    const { g, card } = armed();
    const offer = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'TurnFaceUp' && a.card === card);
    expect(offer && offer.t === 'TurnFaceUp' ? offer.costText : '').toBe('{1}{W}');
    mana(g, 'p1', 'C', 1);
    mana(g, 'p1', 'W', 1);
    must(g.submit({ t: 'TurnFaceUp', player: 'p1', card }));
    settle(g);
    expect(g.state.cards[card]?.faceDown).toBe(false);
    const theirs = project(g.state, ORACLE, g.deps.scripts, 'p2');
    expect(theirs.cards[card]?.disguised).toBeUndefined();
    expect(theirs.cards[card]?.card?.name).toBe('Museum Nightwatch');
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
