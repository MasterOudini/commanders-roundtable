// `Uktabi Faerie` — the self-sacrifice artifact destroy, with an
// indestructible artifact proving the cost is not refunded.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UKTABI_FAERIE_SCRIPT } from './uktabiFaerie';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FAERIE = 'Uktabi Faerie';
const RING = 'Sol Ring';
const CITADEL = 'Darksteel Citadel'; // indestructible artifact land

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(victimName: string): { g: Game; faerie: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FAERIE], [victimName]],
    scripts: createRegistry([UKTABI_FAERIE_SCRIPT]),
  });
  const faerie = put(g, 'p1', FAERIE);
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: faerie, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, faerie, victim };
}

describe('Uktabi Faerie', () => {
  test('the artifact dies and the Faerie was eaten to pay for it', () => {
    const { g, faerie, victim } = fired(RING);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[faerie]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE artifact survives and the cost is not refunded', () => {
    const { g, faerie, victim } = fired(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[faerie]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = fired(RING);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
