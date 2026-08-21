// `Stream of Unconsciousness` — the debuff always lands; the draw only
// behind a Wizard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STREAM_OF_UNCONSCIOUSNESS_SCRIPT } from './streamOfUnconsciousness';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function unconscious(withWizard: boolean): { g: Game; bears: InstanceId; before: number } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Stream of Unconsciousness', 'Stern Proctor'],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([STREAM_OF_UNCONSCIOUSNESS_SCRIPT]),
  });
  if (withWizard) put(g, 'p1', 'Stern Proctor');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stream of Unconsciousness', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  const before = (g.state.zones.hand['p1'] ?? []).length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, before };
}

describe('Stream of Unconsciousness', () => {
  test('a Wizard on board pays the draw', () => {
    const { g, bears, before } = unconscious(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(-2);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before);
  });

  test('no Wizard, no draw', () => {
    const { g, before } = unconscious(false);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before - 1);
  });

  test('replays to the same hash', () => {
    const { g } = unconscious(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
