// `War Chariot` — the trample grant, gone at cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WAR_CHARIOT_SCRIPT } from './warChariot';
import { advanceUntil, deps, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CHARIOT = 'War Chariot';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function granted(): { g: Game; bears: InstanceId; chariot: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CHARIOT, BEARS], []],
    scripts: createRegistry([WAR_CHARIOT_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  const chariot = put(g, 'p1', CHARIOT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: chariot, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, chariot };
}

function keywords(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([WAR_CHARIOT_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

describe('War Chariot', () => {
  test('the Chariot taps and the target gains trample', () => {
    const { g, bears, chariot } = granted();
    expect(keywords(g, bears).has('trample')).toBe(true);
    expect(g.state.cards[chariot]?.tapped).toBe(true);
  });

  test('cleanup takes it back (CR 514.2)', () => {
    const { g, bears } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(keywords(g, bears).has('trample')).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g } = granted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
