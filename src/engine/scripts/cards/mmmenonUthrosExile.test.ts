// `Mm'menon, Uthros Exile` — an artifact CARD entering asks; a TOKEN
// entering asks; a creature entering pays nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MMMENON_UTHROS_EXILE_SCRIPT } from './mmmenonUthrosExile';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function exiled(): { g: Game; jelly: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Mm'menon, Uthros Exile", 'Sol Ring', 'Grizzly Bears'], []],
    scripts: createRegistry([MMMENON_UTHROS_EXILE_SCRIPT]),
  });
  const jelly = put(g, 'p1', "Mm'menon, Uthros Exile");
  settle(g);
  holdEverywhere(g);
  return { g, jelly };
}

function plusOnes(g: Game, card: InstanceId): number {
  return g.state.cards[card]?.counters['+1/+1'] ?? 0;
}

describe("Mm'menon, Uthros Exile", () => {
  test('an artifact card entering asks and the counter lands', () => {
    const { g, jelly } = exiled();
    put(g, 'p1', 'Sol Ring');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: jelly }] }));
    settle(g);
    expect(plusOnes(g, jelly)).toBe(1);
  });

  test('a Treasure TOKEN entering asks too; a creature pays nothing', () => {
    const { g, jelly } = exiled();
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(plusOnes(g, jelly)).toBe(0);
    expect(bears).toBeDefined();
    const treasure = g.deps.oracle.byName?.('Treasure');
    if (!treasure?.printingId) throw new Error('no Treasure printing in the test oracle');
    must(
      g.submit({ t: 'ManualCreateToken', player: 'p1', printingId: treasure.printingId, count: 1 }),
    );
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: jelly }] }));
    settle(g);
    expect(plusOnes(g, jelly)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, jelly } = exiled();
    put(g, 'p1', 'Sol Ring');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: jelly }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
