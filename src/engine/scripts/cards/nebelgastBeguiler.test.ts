// `Nebelgast Beguiler` — the Decoy text on its own id.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NEBELGAST_BEGUILER_SCRIPT } from './nebelgastBeguiler';
import { NEBELGAST_BEGUILER, MASTER_DECOY } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function beguiled(): { g: Game; spirit: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nebelgast Beguiler'], ['Grizzly Bears']],
    scripts: createRegistry([NEBELGAST_BEGUILER_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const spirit = put(g, 'p1', 'Nebelgast Beguiler');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  return { g, spirit, bears };
}

describe('Nebelgast Beguiler', () => {
  test('carries the family text verbatim', () => {
    expect(NEBELGAST_BEGUILER.faces[0]?.oracleText).toBe(MASTER_DECOY.faces[0]?.oracleText);
  });

  test('taps the targeted creature', () => {
    const { g, spirit, bears } = beguiled();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: spirit,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, spirit, bears } = beguiled();
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: spirit,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: bears }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
