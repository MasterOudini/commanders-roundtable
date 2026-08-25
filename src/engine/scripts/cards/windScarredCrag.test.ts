// `Wind-Scarred Crag` — the refuge: it enters TAPPED and pays 1 life on the
// way in.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WIND_SCARRED_CRAG_SCRIPT } from './windScarredCrag';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LAND = 'Wind-Scarred Crag';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

// ⚠️ Enter from the GRAVEYARD so the enters-tapped replacement actually fires
// (the shipped family's own test shape).
function game(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LAND], []],
    scripts: createRegistry([WIND_SCARRED_CRAG_SCRIPT]),
  });
  const land = put(g, 'p1', LAND, 'graveyard');
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: land, to: { kind: 'battlefield', player: 'p1' } }),
  );
  settle(g);
  return { g, land };
}

describe('Wind-Scarred Crag', () => {
  test('it enters TAPPED and gains exactly 1', () => {
    const { g, land } = game();
    expect(g.state.cards[land]?.tapped).toBe(true);
    expect(g.state.players['p1']?.life).toBe(41);
  });

  test('the opponent gains nothing', () => {
    const { g } = game();
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('replays to the same hash', () => {
    const { g } = game();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
