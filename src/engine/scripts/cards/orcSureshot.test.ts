// `Orc Sureshot` — another of mine entering asks; the opponent's 1/1 dies
// to the -1/-1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ORC_SURESHOT_SCRIPT } from './orcSureshot';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shot(): { g: Game; clerk: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Orc Sureshot', 'Grizzly Bears'], ['Aysen Bureaucrats']],
    scripts: createRegistry([ORC_SURESHOT_SCRIPT]),
  });
  put(g, 'p1', 'Orc Sureshot');
  const clerk = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', 'Grizzly Bears');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: clerk }] }));
  settle(g);
  return { g, clerk };
}

describe('Orc Sureshot', () => {
  test("another of mine entering kills the opponent's 1/1", () => {
    const { g, clerk } = shot();
    expect(g.state.cards[clerk]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = shot();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
