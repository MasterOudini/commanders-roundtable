// `Rain of Blades` — one damage to every attacker; the 1/1 dies, the
// 2/2 shrugs.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RAIN_OF_BLADES_SCRIPT } from './rainOfBlades';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rained(): { g: Game; small: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Rain of Blades'], ['Aysen Bureaucrats', 'Grizzly Bears']],
    scripts: createRegistry([RAIN_OF_BLADES_SCRIPT]),
  });
  const small = put(g, 'p2', 'Aysen Bureaucrats');
  const big = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [
        { card: small, defender: { kind: 'player', id: 'p1' } },
        { card: big, defender: { kind: 'player', id: 'p1' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', 'Rain of Blades', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, small, big };
}

describe('Rain of Blades', () => {
  test('the attacking 1/1 dies, the attacking 2/2 survives', () => {
    const { g, small, big } = rained();
    expect(g.state.cards[small]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = rained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
