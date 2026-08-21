// `Rabid Gnaw` — the pump lands first, so a Bears bites for three.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RABID_GNAW_SCRIPT } from './rabidGnaw';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gnawed(): { g: Game; mine: InstanceId; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rabid Gnaw', 'Grizzly Bears'], ['Air Elemental']],
    scripts: createRegistry([RABID_GNAW_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const victim = put(g, 'p2', 'Air Elemental');
  settle(g);
  const spell = put(g, 'p1', 'Rabid Gnaw', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: victim },
      ],
    }),
  );
  settle(g);
  return { g, mine, victim };
}

describe('Rabid Gnaw', () => {
  test('the pumped 3/2 bites a 4/4 for three — one way, no bite back', () => {
    const { g, mine, victim } = gnawed();
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    const marked = g.log.some(
      (e) =>
        e.body.t === 'DamageDealt' &&
        e.body.damages.some((d) => d.target.kind === 'card' && d.target.id === victim && d.amount === 3),
    );
    expect(marked).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = gnawed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
