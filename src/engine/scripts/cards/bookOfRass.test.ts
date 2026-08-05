// `Book of Rass` — the first fixed-life activation cost: the parse is pinned
// payable, the life is genuinely paid, and no {T} means it goes again.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOOK_OF_RASS_SCRIPT } from './bookOfRass';
import { BOOK_OF_RASS } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BOOK = 'Book of Rass';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; book: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BOOK], []],
    scripts: createRegistry([BOOK_OF_RASS_SCRIPT]),
  });
  const book = put(g, 'p1', BOOK);
  settle(g);
  return { g, book };
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some(
          (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
        ),
    ).length;
}

describe('Book of Rass', () => {
  test('the parse says what the def assumes: one payable ability with a life cost', () => {
    const oc = ORACLE.byPrinting(BOOK_OF_RASS.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
  });

  test('draws a card and PAYS the 2 life — twice, because there is no tap', () => {
    const { g, book } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: book, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.players['p1']?.life).toBe(38);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: book, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.players['p1']?.life).toBe(36);
    expect(g.state.cards[book]?.tapped).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, book } = game();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: book, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
