// `Torch Fiend` — the self-sacrifice cost is charged, the artifact dies, and
// an indestructible one survives while the Fiend stays spent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TORCH_FIEND_SCRIPT } from './torchFiend';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FIEND = 'Torch Fiend';
const RING = 'Sol Ring';
const MYR = 'Darksteel Myr'; // indestructible artifact creature

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(victimName: string): { g: Game; fiend: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FIEND, victimName], []],
    scripts: createRegistry([TORCH_FIEND_SCRIPT]),
  });
  const fiend = put(g, 'p1', FIEND);
  const victim = put(g, 'p1', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fiend, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, fiend, victim };
}

describe('Torch Fiend', () => {
  test('the artifact dies and the Fiend was eaten to pay for it', () => {
    const { g, fiend, victim } = fired(RING);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[fiend]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE artifact survives — and the cost is not refunded', () => {
    const { g, fiend, victim } = fired(MYR);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[fiend]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = fired(RING);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
