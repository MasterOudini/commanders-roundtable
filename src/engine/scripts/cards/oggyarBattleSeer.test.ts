// `Oggyar Battle-Seer` — the tap asks a scry 1 and the Seer turns.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OGGYAR_BATTLE_SEER_SCRIPT } from './oggyarBattleSeer';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function seered(): { g: Game; seer: InstanceId; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Oggyar Battle-Seer'], []],
    scripts: createRegistry([OGGYAR_BATTLE_SEER_SCRIPT]),
  });
  const seer = put(g, 'p1', 'Oggyar Battle-Seer');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: seer, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, seer, revealed };
}

describe('Oggyar Battle-Seer', () => {
  test('the tap asks a scry 1 and the Seer turns', () => {
    const { g, seer, revealed } = seered();
    expect(g.state.cards[seer]?.tapped).toBe(true);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = seered();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
