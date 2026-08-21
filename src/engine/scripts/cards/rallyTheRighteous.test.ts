// `Rally the Righteous` — the radiance set untaps and pumps; an
// off-colour bystander is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { RALLY_THE_RIGHTEOUS_SCRIPT } from './rallyTheRighteous';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function righteous(): { g: Game; target: InstanceId; kin: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Rally the Righteous', 'Grizzly Bears', 'Colossal Dreadmaw'],
      ['Air Elemental'],
    ],
    scripts: createRegistry([RALLY_THE_RIGHTEOUS_SCRIPT]),
  });
  const target = put(g, 'p1', 'Grizzly Bears');
  const kin = put(g, 'p1', 'Colossal Dreadmaw');
  const other = put(g, 'p2', 'Air Elemental');
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [target, kin], tapped: true }));
  const spell = put(g, 'p1', 'Rally the Righteous', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(
    g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: target }] }),
  );
  settle(g);
  return { g, target, kin, other };
}

describe('Rally the Righteous', () => {
  test('the green pair untaps at +2/+0; the blue bystander is untouched', () => {
    const { g, target, kin, other } = righteous();
    expect(g.state.cards[target]?.tapped).toBe(false);
    expect(g.state.cards[kin]?.tapped).toBe(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, target).power).toBe(4);
    expect(derive(g.state, ORACLE, g.deps.scripts, kin).power).toBe(8);
    expect(derive(g.state, ORACLE, g.deps.scripts, other).power).toBe(4);
  });

  test('replays to the same hash', () => {
    const { g } = righteous();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
