// `Tail Slash` — the two-controller bite, written by CONTROLLER from the
// first draft (D255).
//
// ⚠️ The second case submits the pair SWAPPED and pins what the ENGINE
// actually does with it — the same measurement D255 took on Swift Kick: the
// AIM accepts the answer (`assignTargets` is a one-for-one matching, D102,
// which proves a legal assignment exists without reordering it) and the
// spell then does NOTHING, because the resolution-time re-check (CR 608.2b)
// evidently reads the def's specs POSITIONALLY and fizzles. Two layers, one
// answer, two verdicts — recorded, not assumed.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { TAIL_SLASH_SCRIPT } from './tailSlash';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TITAN = 'Grave Titan';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function slashed(swap: boolean): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Tail Slash', TITAN], [BEARS]],
    scripts: createRegistry([TAIL_SLASH_SCRIPT]),
  });
  const mine = put(g, 'p1', TITAN);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Tail Slash', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const answer = swap
    ? [
        { kind: 'card' as const, id: theirs },
        { kind: 'card' as const, id: mine },
      ]
    : [
        { kind: 'card' as const, id: mine },
        { kind: 'card' as const, id: theirs },
      ];
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: answer }));
  settle(g);
  return { g, mine, theirs };
}

describe('Tail Slash', () => {
  test('my creature bites theirs for its power, and mine is untouched', () => {
    const { g, mine, theirs } = slashed(false);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('a swapped answer is accepted at the aim and then does nothing', () => {
    const { g, mine, theirs } = slashed(true);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g } = slashed(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
