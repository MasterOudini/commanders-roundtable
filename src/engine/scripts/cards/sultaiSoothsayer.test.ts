// `Sultai Soothsayer` — the ETB take: one of four to hand, the other
// three binned.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SULTAI_SOOTHSAYER_SCRIPT } from './sultaiSoothsayer';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soothsaid(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Sultai Soothsayer'], []],
    scripts: createRegistry([SULTAI_SOOTHSAYER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  put(g, 'p1', 'Sultai Soothsayer', 'graveyard');
  const sooth = (g.state.zones.graveyard['p1'] ?? [])[0];
  if (sooth === undefined) throw new Error('the Soothsayer must be in the graveyard');
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p1',
      card: sooth,
      to: { kind: 'battlefield', player: 'p1' },
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
  const before = (g.state.zones.hand['p1'] ?? []).length;
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  if (revealed.length !== 4) throw new Error(`expected 4 revealed, got ${revealed.length}`);
  must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: revealed.slice(0, 1) }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return { g, before };
}

describe('Sultai Soothsayer', () => {
  test('one card to hand, three to the graveyard', () => {
    const { g, before } = soothsaid();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 1);
    expect((g.state.zones.graveyard['p1'] ?? []).length).toBe(3);
  });

  test('replays to the same hash', () => {
    const { g } = soothsaid();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
