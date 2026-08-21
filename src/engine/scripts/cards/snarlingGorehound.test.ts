// `Snarling Gorehound` — the derived power filter meets the surveil ask:
// a Bears (2 power) asks, a Titan (6) does not, and a batch-mate's Sliver
// TOKEN proves the second def.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SNARLING_GOREHOUND_SCRIPT } from './snarlingGorehound';
import { SLIVER_QUEEN_SCRIPT } from './sliverQueen';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function answerSurveil(g: Game): void {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  const top = revealed[revealed.length - 1];
  if (top === undefined) throw new Error('no revealed card');
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
}

function hounded(): Game {
  const g = startedGame({
    players: 2,
    decks: [
      ['Snarling Gorehound', 'Sliver Queen', 'Grizzly Bears'],
      ['Grave Titan'],
    ],
    scripts: createRegistry([SNARLING_GOREHOUND_SCRIPT, SLIVER_QUEEN_SCRIPT]),
  });
  put(g, 'p1', 'Snarling Gorehound');
  settle(g);
  holdEverywhere(g);
  // A big opposing creature asks nothing: wrong controller AND power 6.
  put(g, 'p2', 'Grave Titan');
  settle(g);
  if (g.state.priority.awaiting !== null) throw new Error('the Titan must ask nothing');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  // My 2-power card entry asks.
  put(g, 'p1', 'Grizzly Bears');
  answerSurveil(g);
  // The Queen's 1/1 Sliver TOKEN asks through the second def; the 7/7
  // Queen's own entry does not.
  const queen = put(g, 'p1', 'Sliver Queen');
  settle(g);
  if (g.state.priority.awaiting !== null) throw new Error('the 7/7 Queen must ask nothing');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: queen, abilityIndex: 0 }));
  answerSurveil(g);
  return g;
}

describe('Snarling Gorehound', () => {
  test('a small card entry and a small token entry each ask; both declines land', () => {
    const g = hounded();
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(2);
  });

  test('replays to the same hash', () => {
    const g = hounded();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
