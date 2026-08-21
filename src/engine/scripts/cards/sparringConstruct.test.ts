// `Sparring Construct` — its death pays a counter onto my Bears; an
// opponent's creature is refused at the aim.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPARRING_CONSTRUCT_SCRIPT } from './sparringConstruct';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sparred(): { g: Game; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Sparring Construct', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([SPARRING_CONSTRUCT_SCRIPT]),
  });
  const construct = put(g, 'p1', 'Sparring Construct');
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: construct,
      to: { kind: 'graveyard', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  const refused = g.submit({
    t: 'ChooseTargets',
    player: 'p1',
    targets: [{ kind: 'card', id: theirs }],
  });
  if (refused.ok) throw new Error("an opponent's creature must be refused — you control");
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
  settle(g);
  return { g, mine };
}

describe('Sparring Construct', () => {
  test('the death pays a +1/+1 counter onto my Bears', () => {
    const { g, mine } = sparred();
    expect(g.state.cards[mine]?.counters['+1/+1']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g } = sparred();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
