// `Malevolent Awakening` — {1}{B}{B} and a creature pay to pull a creature
// card back from my graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MALEVOLENT_AWAKENING_SCRIPT } from './malevolentAwakening';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AWAKENING = 'Malevolent Awakening';
const BEARS = 'Grizzly Bears';
const ONULET = 'Onulet';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function returned(): { g: Game; bears: InstanceId; onulet: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[AWAKENING, BEARS, ONULET], []],
    scripts: createRegistry([MALEVOLENT_AWAKENING_SCRIPT]),
  });
  const awakening = put(g, 'p1', AWAKENING);
  const onulet = put(g, 'p1', ONULET);
  const bears = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(
    g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: awakening,
      abilityIndex: 0,
      sacrifice: onulet,
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, onulet };
}

describe('Malevolent Awakening', () => {
  test('a creature and the mana pull the chosen creature card back', () => {
    const { g, bears, onulet } = returned();
    expect(g.state.cards[onulet]?.zone.kind).toBe('graveyard');
    const zone = g.state.cards[bears]?.zone;
    expect(zone?.kind).toBe('hand');
    expect(zone?.kind === 'hand' && zone.player).toBe('p1');
  });

  test('replays to the same hash', () => {
    const { g } = returned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
