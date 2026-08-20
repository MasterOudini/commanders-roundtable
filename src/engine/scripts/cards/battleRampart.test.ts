// `Battle Rampart` — Axgard Cavalry's grant behind a Defender header.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { BATTLE_RAMPART_SCRIPT } from './battleRampart';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Battle Rampart', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([BATTLE_RAMPART_SCRIPT]),
  });
  const rampart = put(g, 'p1', 'Battle Rampart');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    60_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: rampart, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Battle Rampart', () => {
  test('the tap buys derived haste; the def claims only its own line', () => {
    const { g, bears } = granted();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).keywords.has('haste')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
