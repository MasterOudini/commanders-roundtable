// `Sorin's Thirst` — the 2 kills the 2/2 and the caster gains 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SORINS_THIRST_SCRIPT } from './sorinsThirst';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thirsted(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Sorin's Thirst"], ['Grizzly Bears']],
    scripts: createRegistry([SORINS_THIRST_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Sorin's Thirst", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe("Sorin's Thirst", () => {
  test('the Bears dies and the caster gains 2', () => {
    const { g, bears } = thirsted();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const { g } = thirsted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
