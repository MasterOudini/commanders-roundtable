// `Ronom Unicorn` — the sacrifice pays and the enchantment dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RONOM_UNICORN_SCRIPT } from './ronomUnicorn';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function horned(): { g: Game; unicorn: InstanceId; flame: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Ronom Unicorn'],
      ['Captive Flame'],
    ],
    scripts: createRegistry([RONOM_UNICORN_SCRIPT]),
  });
  const unicorn = put(g, 'p1', 'Ronom Unicorn');
  const flame = put(g, 'p2', 'Captive Flame');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: unicorn,
      abilityIndex: 0,
      targets: [{ kind: 'card', id: flame }],
    }),
  );
  settle(g);
  return { g, unicorn, flame };
}

describe('Ronom Unicorn', () => {
  test('the Unicorn pays itself and the enchantment dies', () => {
    const { g, unicorn, flame } = horned();
    expect(g.state.cards[unicorn]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flame]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = horned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
