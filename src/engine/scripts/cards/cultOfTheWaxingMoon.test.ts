// `Cult of the Waxing Moon` — the FIRST transform-watcher: flipping a
// werewolf FORWARD (into a non-Human Werewolf) pays a Wolf; flipping it BACK
// (into a Human Advisor) pays nothing — one card, both branches, and the
// filter provably reads the DESTINATION face.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CULT_OF_THE_WAXING_MOON_SCRIPT } from './cultOfTheWaxingMoon';
import { WOLF_TOKEN } from '../../../data/fixtures/engineCards';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CULT = 'Cult of the Waxing Moon';
const WEREWOLF = 'Duskwatch Recruiter // Krallenhorde Howler';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function wolves(g: Game): readonly InstanceId[] {
  return Object.keys(g.state.cards).filter(
    (id) => g.state.cards[id]?.isToken && g.state.cards[id]?.printingId === WOLF_TOKEN.scryfallId,
  ) as InstanceId[];
}

function game(): { g: Game; wolfman: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CULT, WEREWOLF], []],
    scripts: createRegistry([CULT_OF_THE_WAXING_MOON_SCRIPT]),
  });
  put(g, 'p1', CULT);
  const wolfman = put(g, 'p1', WEREWOLF);
  settle(g);
  return { g, wolfman };
}

describe('Cult of the Waxing Moon', () => {
  test('transforming INTO the non-Human Werewolf pays a Wolf; back to the Human pays nothing', () => {
    const { g, wolfman } = game();
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: wolfman }));
    settle(g);
    expect(wolves(g)).toHaveLength(1);
    // Back to the front face — a transform too (CR 701.28), but into a HUMAN.
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: wolfman }));
    settle(g);
    expect(wolves(g)).toHaveLength(1);
  });

  test("an OPPONENT's transform pays nothing — 'you control'", () => {
    const g = startedGame({
      players: 2,
      decks: [[CULT], [WEREWOLF]],
      scripts: createRegistry([CULT_OF_THE_WAXING_MOON_SCRIPT]),
    });
    put(g, 'p1', CULT);
    const theirs = put(g, 'p2', WEREWOLF);
    settle(g);
    must(g.submit({ t: 'ManualFlipFace', player: 'p2', card: theirs }));
    settle(g);
    expect(wolves(g)).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g, wolfman } = game();
    must(g.submit({ t: 'ManualFlipFace', player: 'p1', card: wolfman }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
