// `Whisper Agent` — the entry asks a SURVEIL 1 (binned cards reach the
// graveyard, not the bottom).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WHISPER_AGENT_SCRIPT } from './whisperAgent';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const AGENT = 'Whisper Agent';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function entered(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [[AGENT], []],
    scripts: createRegistry([WHISPER_AGENT_SCRIPT]),
  });
  put(g, 'p1', AGENT);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Whisper Agent', () => {
  test('the entry asks a SURVEIL 1 — toGraveyard, not a scry', () => {
    const { g, revealed } = entered();
    expect(revealed).toHaveLength(1);
    expect(
      g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard,
    ).toBe(true);
  });

  test('a binned card reaches the GRAVEYARD', () => {
    const { g, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [top] }));
    settle(g);
    expect(g.state.cards[top]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = entered();
    const [top] = revealed as [InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [top], toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
