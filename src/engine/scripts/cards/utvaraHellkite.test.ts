// `Utvara Hellkite` — the filtered perItem fan-out: TWO attacking Dragons
// make TWO tokens, a non-Dragon attacker makes none, and an opponent's Dragon
// makes none.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { UTVARA_HELLKITE_SCRIPT } from './utvaraHellkite';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HELLKITE = 'Utvara Hellkite';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dragons(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return c?.isToken && g.deps.oracle.byPrinting(c.printingId)?.name === 'Dragon';
  }).length;
}

/** Attacks with the Hellkite plus `mate`, and reports the Dragons made. */
function swing(mate: string | null): number {
  const deck = [HELLKITE];
  if (mate) deck.push(mate);
  const g = startedGame({
    players: 2,
    decks: [deck, []],
    scripts: createRegistry([UTVARA_HELLKITE_SCRIPT]),
  });
  const hellkite = put(g, 'p1', HELLKITE);
  const other: InstanceId | null = mate ? put(g, 'p1', mate) : null;
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  const attackers = [{ card: hellkite, defender: { kind: 'player' as const, id: 'p2' } }];
  if (other) attackers.push({ card: other, defender: { kind: 'player' as const, id: 'p2' } });
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers }));
  settle(g);
  return dragons(g);
}

describe('Utvara Hellkite', () => {
  test('the Hellkite attacking alone makes ONE Dragon — it is a Dragon itself', () => {
    expect(swing(null)).toBe(1);
  });

  test('a NON-Dragon attacking beside it adds nothing — the filter holds', () => {
    expect(swing(BEARS)).toBe(1);
  });

  test('TWO attacking Dragons make TWO tokens — the fan-out itself', () => {
    // The Hellkite attacks alone on turn 3 and makes a Dragon token. That
    // token has been under my control since, so on turn 5 BOTH can attack —
    // and a single-firing def would make one token where the card makes two.
    const g = startedGame({
      players: 2,
      decks: [[HELLKITE], []],
      scripts: createRegistry([UTVARA_HELLKITE_SCRIPT]),
    });
    const hellkite = put(g, 'p1', HELLKITE);
    settle(g);
    holdEverywhere(g);
    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 3 &&
        s.turn.activePlayer === 'p1' &&
        s.priority.awaiting?.kind === 'declareAttackers',
      120_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: hellkite, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    expect(dragons(g)).toBe(1);
    const first = g.state.zones.battlefield.find((id) => g.state.cards[id]?.isToken) as string;
    expect(first).not.toBe(hellkite);

    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 5 &&
        s.turn.activePlayer === 'p1' &&
        s.priority.awaiting?.kind === 'declareAttackers',
      240_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: hellkite, defender: { kind: 'player', id: 'p2' } },
          { card: first, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    settle(g);
    // 1 from the first swing + 2 from this one.
    expect(dragons(g)).toBe(3);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[HELLKITE], []],
      scripts: createRegistry([UTVARA_HELLKITE_SCRIPT]),
    });
    const hellkite = put(g, 'p1', HELLKITE);
    settle(g);
    holdEverywhere(g);
    advanceUntil(
      g,
      (s) =>
        s.turn.turnNumber >= 3 &&
        s.turn.activePlayer === 'p1' &&
        s.priority.awaiting?.kind === 'declareAttackers',
      120_000,
    );
    must(
      g.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: hellkite, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
