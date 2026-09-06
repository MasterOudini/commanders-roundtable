// D341 - MENTOR (CR 702.121): "Whenever this creature attacks, put a +1/+1
// counter on target attacking creature with lesser power." The clause compares
// against the SOURCE's own power - a numeric restriction with no printed number
// - read off the targeting source at the choice: the attacking 1/1 Goblin is a
// legal target for the 2/3 Challenger, the attacking 2/2 Bears (equal power)
// and the Cyclops at home are refused, and the counter lands on the Goblin.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { BOROS_CHALLENGER_SCRIPT } from './scripts/cards/borosChallenger';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
const at = { kind: 'player', id: 'p2' } as const;

/** p1's Challenger, Goblin and Bears attacking together on turn 3; the Mentor trigger is asking. */
function asking(): { g: Game; mentor: InstanceId; goblin: InstanceId; bears: InstanceId; cyclops: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Boros Challenger', 'Raging Goblin', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([BOROS_CHALLENGER_SCRIPT]),
  });
  holdEverywhere(g);
  const cyclops = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const mentor = put(g, 'p1', 'Boros Challenger');
  const goblin = put(g, 'p1', 'Raging Goblin');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers' && s.priority.awaiting.player === 'p1', 40_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: [
        { card: mentor, defender: at },
        { card: goblin, defender: at },
        { card: bears, defender: at },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, mentor, goblin, bears, cyclops };
}

describe('D341 - mentor: target attacking creature with lesser power', () => {
  test('the equal-power attacker and the creature at home are refused; the lesser attacker takes the counter', () => {
    const { g, goblin, bears, cyclops } = asking();
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: cyclops }] }).ok).toBe(false);
    expect(g.state.priority.awaiting?.kind).toBe('chooseTargets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: goblin }] }));
    settle(g);
    expect(g.state.cards[goblin]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0).toBe(0);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 40_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
