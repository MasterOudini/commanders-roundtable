// `Rune-Sealed Wall` — the {T} surveil, past its summoning sickness.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { RUNE_SEALED_WALL_SCRIPT } from './runeSealedWall';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function walled(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Rune-Sealed Wall'], []],
    scripts: createRegistry([RUNE_SEALED_WALL_SCRIPT]),
  });
  const wall = put(g, 'p1', 'Rune-Sealed Wall');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 3 &&
      s.turn.activePlayer === 'p1' &&
      s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: wall, abilityIndex: 0 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Rune-Sealed Wall', () => {
  test('the surveil asks and the graveyard answer bins the card', () => {
    const { g, revealed } = walled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.toGraveyard).toBe(true);
    const card = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: [card] }));
    settle(g);
    expect(g.state.cards[card]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, revealed } = walled();
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
