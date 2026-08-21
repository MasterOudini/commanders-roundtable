// `Sage of Lat-Nam` — the artifact pays and the draw arrives, past the
// Sage's summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAGE_OF_LAT_NAM_SCRIPT } from './sageOfLatNam';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function saged(): { g: Game; mid: number; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sage of Lat-Nam', 'Sol Ring'], []],
    scripts: createRegistry([SAGE_OF_LAT_NAM_SCRIPT]),
  });
  const sage = put(g, 'p1', 'Sage of Lat-Nam');
  const ring = put(g, 'p1', 'Sol Ring');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  const mid = (g.state.zones.hand['p1'] ?? []).length;
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: sage,
      abilityIndex: 0,
      sacrifice: ring,
    }),
  );
  settle(g);
  return { g, mid, ring };
}

describe('Sage of Lat-Nam', () => {
  test('the artifact dies and the draw arrives', () => {
    const { g, mid, ring } = saged();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 1);
  });

  test('replays to the same hash', () => {
    const { g } = saged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
