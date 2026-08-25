// `Whirlermaker` — one Thopter per activation, and the {T} in the cost stops
// a second in the same turn.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WHIRLERMAKER_SCRIPT } from './whirlermaker';
import { advanceUntil, battlefieldOf, deps, must, nameOf, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MAKER = 'Whirlermaker';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thopters(g: Game): InstanceId[] {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Thopter');
}

function board(): { g: Game; maker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MAKER], []],
    scripts: createRegistry([WHIRLERMAKER_SCRIPT]),
  });
  const maker = put(g, 'p1', MAKER);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 12 }));
  return { g, maker };
}

describe('Whirlermaker', () => {
  test('one activation makes one FLYING Thopter and taps the maker', () => {
    const { g, maker } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: maker, abilityIndex: 0, targets: [] }));
    settle(g);
    const made = thopters(g);
    expect(made).toHaveLength(1);
    expect(g.state.cards[maker]?.tapped).toBe(true);
    const d = deps(createRegistry([WHIRLERMAKER_SCRIPT]));
    expect(derive(g.state, d.oracle, d.scripts, made[0] as InstanceId).keywords.has('flying')).toBe(
      true,
    );
  });

  test('the {T} stops a second in the same turn', () => {
    const { g, maker } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: maker, abilityIndex: 0, targets: [] }));
    settle(g);
    const again = g.submit({
      t: 'ActivateAbility',
      player: 'p1',
      card: maker,
      abilityIndex: 0,
      targets: [],
    });
    expect(again.ok).toBe(false);
    expect(thopters(g)).toHaveLength(1);
  });

  test('replays to the same hash', () => {
    const { g, maker } = board();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: maker, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
