// `Kabira Crossroads` — both printed rules on entry: tapped and the 2 life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { KABIRA_CROSSROADS_SCRIPT } from './kabiraCrossroads';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CROSSROADS = 'Kabira Crossroads';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; crossroads: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CROSSROADS], []],
    scripts: createRegistry([KABIRA_CROSSROADS_SCRIPT]),
  });
  const crossroads = put(g, 'p1', CROSSROADS, 'hand');
  must(g.submit({ t: 'PlayLand', player: 'p1', card: crossroads }));
  settle(g);
  return { g, crossroads };
}

describe('Kabira Crossroads', () => {
  test('enters tapped AND pays 2 life — both printed rules', () => {
    const { g, crossroads } = entered();
    expect(g.state.cards[crossroads]?.tapped).toBe(true);
    expect(g.state.players.p1?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const { g } = entered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
