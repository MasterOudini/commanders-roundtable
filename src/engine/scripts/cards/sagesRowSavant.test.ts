// `Sage's Row Savant` — entering asks scry 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SAGES_ROW_SAVANT_SCRIPT } from './sagesRowSavant';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function savanted(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [["Sage's Row Savant"], []],
    scripts: createRegistry([SAGES_ROW_SAVANT_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', "Sage's Row Savant");
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe("Sage's Row Savant", () => {
  test('entering asks scry 2 and the answer clears it', () => {
    const { g, revealed } = savanted();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(2);
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(false);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => (s.priority.awaiting ?? null) === null, 20_000);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = savanted();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
