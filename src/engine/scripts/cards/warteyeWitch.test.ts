// `Warteye Witch` — the self-or-other death watcher: another creature of mine
// pays, its OWN death pays, and an opponent's creature does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WARTEYE_WITCH_SCRIPT } from './warteyeWitch';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WITCH = 'Warteye Witch';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; witch: InstanceId; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[WITCH, BEARS], [BEARS]],
    scripts: createRegistry([WARTEYE_WITCH_SCRIPT]),
  });
  const witch = put(g, 'p1', WITCH);
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  return { g, witch, mine, theirs };
}

function kill(g: Game, player: 'p1' | 'p2', card: InstanceId): void {
  must(
    g.submit({
      t: 'ManualMoveCard',
      player,
      card,
      to: { kind: 'graveyard', player },
    }),
  );
}

describe('Warteye Witch', () => {
  test('another creature I control dying asks a scry', () => {
    const { g, mine } = board();
    kill(g, 'p1', mine);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
  });

  test('its OWN death asks one too — the line says "this creature or"', () => {
    const { g, witch } = board();
    kill(g, 'p1', witch);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind).toBe('scryChoice');
  });

  test("an OPPONENT's creature dying asks nothing", () => {
    const { g, theirs } = board();
    kill(g, 'p2', theirs);
    settle(g);
    expect(g.state.priority.awaiting).toBe(null);
  });

  test('replays to the same hash', () => {
    const { g, mine } = board();
    kill(g, 'p1', mine);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
