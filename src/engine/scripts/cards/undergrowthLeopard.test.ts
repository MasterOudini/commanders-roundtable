// `Undergrowth Leopard` — the self-sacrifice compound destroy, with BOTH
// arms of the noun list proven (the probe said both kinds are enforced).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UNDERGROWTH_LEOPARD_SCRIPT } from './undergrowthLeopard';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LEOPARD = 'Undergrowth Leopard';
const ARTIFACT = 'Sol Ring';
const ENCHANTMENT = "Ajani's Welcome";
const CREATURE = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pounced(victimName: string): {
  g: Game;
  leopard: InstanceId;
  victim: InstanceId;
  res: { ok: boolean };
} {
  const g = startedGame({
    players: 2,
    decks: [[LEOPARD], [victimName]],
    scripts: createRegistry([UNDERGROWTH_LEOPARD_SCRIPT]),
  });
  const leopard = put(g, 'p1', LEOPARD);
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: leopard, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const res = g.submit({
    t: 'ChooseTargets',
    player: 'p1',
    targets: [{ kind: 'card', id: victim }],
  });
  if (res.ok) settle(g);
  return { g, leopard, victim, res };
}

describe('Undergrowth Leopard', () => {
  test('an ARTIFACT is a legal answer and dies', () => {
    const { g, victim, res } = pounced(ARTIFACT);
    expect(res.ok).toBe(true);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('an ENCHANTMENT is the other arm and dies too', () => {
    const { g, victim, res } = pounced(ENCHANTMENT);
    expect(res.ok).toBe(true);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('a CREATURE is refused — it is in neither arm', () => {
    const { g, victim, res } = pounced(CREATURE);
    expect(res.ok).toBe(false);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = pounced(ARTIFACT);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
