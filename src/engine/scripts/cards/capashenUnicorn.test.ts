// `Capashen Unicorn` — the self-sacrifice destroy against an enchantment,
// with an INDESTRUCTIBLE artifact surviving it and the cost staying paid.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CAPASHEN_UNICORN_SCRIPT } from './capashenUnicorn';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const UNICORN = 'Capashen Unicorn';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(targetName: string): { g: Game; unicorn: InstanceId; target: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[UNICORN], [targetName]],
    scripts: createRegistry([CAPASHEN_UNICORN_SCRIPT]),
  });
  const target = put(g, 'p2', targetName);
  const unicorn = put(g, 'p1', UNICORN);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  return { g, unicorn, target };
}

describe('Capashen Unicorn', () => {
  test('destroys the targeted enchantment, with the Unicorn spent', () => {
    const { g, unicorn, target } = game("Ajani's Mantra");
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: unicorn,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: target }],
      }),
    );
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[unicorn]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE artifact survives, and the cost stays paid', () => {
    const { g, unicorn, target } = game('Darksteel Myr');
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: unicorn,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: target }],
      }),
    );
    settle(g);
    expect(g.state.cards[target]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[unicorn]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, unicorn, target } = game("Ajani's Mantra");
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: unicorn,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: target }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
