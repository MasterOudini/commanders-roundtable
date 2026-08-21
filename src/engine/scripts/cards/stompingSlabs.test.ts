// `Stomping Slabs` — the self-name census proven BOTH ways. The positive
// engineers a namesake onto the library TOP with the Tier-3 move (the
// library appends, and `drawFromTop` takes from the END, so an appended
// card IS the top — D142's "the bottom is index 0", read from the other
// side); the negative simply never puts one there.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STOMPING_SLABS_SCRIPT } from './stompingSlabs';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function slabbed(seedNamesake: boolean): Game {
  const g = startedGame({
    players: 2,
    decks: [['Stomping Slabs', 'Stomping Slabs'], []],
    scripts: createRegistry([STOMPING_SLABS_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stomping Slabs', 'hand');
  if (seedNamesake) {
    const second = put(g, 'p1', 'Stomping Slabs', 'hand');
    if (second === spell) throw new Error('the deck must hold two distinct copies');
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: second,
        to: { kind: 'library', player: 'p1' },
      }),
    );
  }
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'orderCards', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerOrderCards', player: 'p1', cards: revealed }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  settle(g);
  return g;
}

describe('Stomping Slabs', () => {
  test('a revealed namesake bills p2 for 7', () => {
    const g = slabbed(true);
    expect(g.state.players['p2']?.life).toBe(33);
  });

  test('no namesake, no damage — and the ordering still resolves', () => {
    const g = slabbed(false);
    expect(g.state.players['p2']?.life).toBe(40);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('replays to the same hash', () => {
    const g = slabbed(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
