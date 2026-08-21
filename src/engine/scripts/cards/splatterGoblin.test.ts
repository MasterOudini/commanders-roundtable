// `Splatter Goblin` — the dies-debuff: an opponent's 1/1 dies to it, and my
// own creature is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPLATTER_GOBLIN_SCRIPT } from './splatterGoblin';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function splattered(): { g: Game; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Splatter Goblin', 'Grizzly Bears'], ['Aysen Bureaucrats']],
    scripts: createRegistry([SPLATTER_GOBLIN_SCRIPT]),
  });
  const goblin = put(g, 'p1', 'Splatter Goblin');
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: goblin,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const refused = g.submit({
    t: 'ChooseTargets',
    player: 'p1',
    targets: [{ kind: 'card', id: mine }],
  });
  if (refused.ok) throw new Error('my own creature must be refused — an opponent controls');
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  return { g, theirs };
}

describe('Splatter Goblin', () => {
  test("the opponent's 1/1 dies to the -1/-1", () => {
    const { g, theirs } = splattered();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = splattered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
