// `Daring Apprentice` — the FIRST script counterspell: a real cast is held
// in the response window, the Apprentice eats itself, and the spell leaves
// the stack for the graveyard without ever resolving.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DARING_APPRENTICE_SCRIPT } from './daringApprentice';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const APPRENTICE = 'Daring Apprentice';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/**
 * p1's Apprentice past summoning sickness, p2 mid-cast with the spell HELD on
 * the stack and p1 holding priority to respond — the counterspell moment.
 */
function game(): { g: Game; apprentice: InstanceId; bears: InstanceId; stackId: string } {
  const g = startedGame({
    players: 2,
    decks: [[APPRENTICE], [BEARS]],
    scripts: createRegistry([DARING_APPRENTICE_SCRIPT]),
  });
  holdEverywhere(g);
  const apprentice = put(g, 'p1', APPRENTICE);
  const bears = put(g, 'p2', BEARS, 'hand');
  settle(g);
  // p2's main phase, past the Apprentice's summoning sickness (CR 302.6).
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 4 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.player === 'p2' &&
      s.priority.awaiting === null &&
      (s.turn.phase === 'precombatMain' || s.turn.phase === 'postcombatMain'),
    20_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: bears }));
  // The response window: the spell on the stack, p1 to act.
  advanceUntil(g, (s) => s.stack.length === 1 && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  const stackId = g.state.stack[0]?.id as string;
  return { g, apprentice, bears, stackId };
}

describe('Daring Apprentice', () => {
  test('counters the held spell: the Bears never resolves, the Apprentice is spent', () => {
    const { g, apprentice, bears, stackId } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    // The cost was paid on the answer: the Apprentice is already gone.
    expect(g.state.cards[apprentice]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.log.some((e) => e.body.t === 'SpellCountered')).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, apprentice, stackId } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: apprentice, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 5, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
