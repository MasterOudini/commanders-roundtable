// `Valakut Invoker` — the {8} any-target ping.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { VALAKUT_INVOKER_SCRIPT } from './valakutInvoker';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const INVOKER = 'Valakut Invoker';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fired(at: 'player' | 'creature'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[INVOKER], [BEARS]],
    scripts: createRegistry([VALAKUT_INVOKER_SCRIPT]),
  });
  const invoker = put(g, 'p1', INVOKER);
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 8 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: invoker, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [at === 'player' ? { kind: 'player', id: 'p2' } : { kind: 'card', id: victim }],
    }),
  );
  settle(g);
  return { g, victim };
}

describe('Valakut Invoker', () => {
  test('3 damage at a player', () => {
    expect(fired('player').g.state.players.p2?.life).toBe(37);
  });

  test('3 damage at a creature kills a 2/2 through the SBA', () => {
    const { g, victim } = fired('creature');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = fired('player');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
