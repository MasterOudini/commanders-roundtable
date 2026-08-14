// `Jeska, Warrior Adept` — the tap pings the chosen player for 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { JESKA_WARRIOR_ADEPT_SCRIPT } from './jeskaWarriorAdept';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const JESKA = 'Jeska, Warrior Adept';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pinged(): { g: Game; jeska: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[JESKA], []],
    scripts: createRegistry([JESKA_WARRIOR_ADEPT_SCRIPT]),
  });
  const jeska = put(g, 'p1', JESKA);
  settle(g);
  // {T} on a creature — wait out summoning sickness (haste is hers only when
  // the keyword line is derived; the harness plays it safe either way).
  advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: jeska, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, jeska };
}

describe('Jeska, Warrior Adept', () => {
  test('the tap deals 1 to the chosen player', () => {
    const { g, jeska } = pinged();
    expect(g.state.players['p2']?.life).toBe(39);
    expect(g.state.cards[jeska]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = pinged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
