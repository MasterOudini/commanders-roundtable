// `Quagmire Druid` — a creature goes in, an enchantment goes down.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { QUAGMIRE_DRUID_SCRIPT } from './quagmireDruid';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drained(): { g: Game; druid: string; bears: string; enchantment: string } {
  const g = startedGame({
    players: 2,
    decks: [['Quagmire Druid', 'Grizzly Bears'], ['Contemplation']],
    scripts: createRegistry([QUAGMIRE_DRUID_SCRIPT]),
  });
  const druid = put(g, 'p1', 'Quagmire Druid');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const enchantment = put(g, 'p2', 'Contemplation');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: druid,
      abilityIndex: 0,
      sacrifice: bears,
      targets: [{ kind: 'card', id: enchantment }],
    }),
  );
  settle(g);
  return { g, druid, bears, enchantment };
}

describe('Quagmire Druid', () => {
  test('the Bears pays, the enchantment dies, the Druid stays', () => {
    const { g, druid, bears, enchantment } = drained();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[enchantment]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[druid]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = drained();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
