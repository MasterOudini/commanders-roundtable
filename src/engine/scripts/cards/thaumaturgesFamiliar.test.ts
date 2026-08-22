// `Thaumaturge's Familiar` — the ETB scry behind a flying keyword line.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THAUMATURGES_FAMILIAR_SCRIPT } from './thaumaturgesFamiliar';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FAMILIAR = "Thaumaturge's Familiar";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): Game {
  const g = startedGame({
    players: 2,
    decks: [[FAMILIAR], []],
    scripts: createRegistry([THAUMATURGES_FAMILIAR_SCRIPT]),
  });
  put(g, 'p1', FAMILIAR);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  return g;
}

describe("Thaumaturge's Familiar", () => {
  test('entering asks the scry for exactly ONE', () => {
    const g = entered();
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = entered();
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
