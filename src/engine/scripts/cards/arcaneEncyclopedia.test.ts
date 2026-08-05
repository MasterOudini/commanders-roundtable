// `Arcane Encyclopedia` — the first shipped ActivatedDef (D159), driven
// through the REAL `ActivateAbility` intent: the engine offers, charges and
// stacks the ability exactly as it has since M3; the def is the resolution
// that was missing.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARCANE_ENCYCLOPEDIA_SCRIPT } from './arcaneEncyclopedia';
import { ARCANE_ENCYCLOPEDIA } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const BOOK = 'Arcane Encyclopedia';

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[BOOK], []],
    scripts: createRegistry([ARCANE_ENCYCLOPEDIA_SCRIPT]),
  });
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fund(g: Game, amount: number): void {
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount }));
}

describe('Arcane Encyclopedia', () => {
  test('the parse says what the def assumes: one ability, payable, index 0', () => {
    const oc = ORACLE.byPrinting(ARCANE_ENCYCLOPEDIA.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.requiresTap).toBe(true);
  });

  test('activating draws a card, taps the source, and is asserted on the MOVE', () => {
    const g = game();
    const id = put(g, 'p1', BOOK);
    settle(g);
    fund(g, 3);
    const handBefore = idsIn(g, 'p1', 'hand').length;
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 }));
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    expect(g.state.cards[id]?.tapped).toBe(true);
    const drew = g.log
      .slice(logAt)
      .some(
        (e) =>
          e.body.t === 'CardsMoved' &&
          e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand'),
      );
    expect(drew).toBe(true);
  });

  test('a tapped Encyclopedia refuses a second activation — the cost is real', () => {
    const g = game();
    const id = put(g, 'p1', BOOK);
    settle(g);
    fund(g, 6);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 }));
    settle(g);
    const again = g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 });
    expect(again.ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const g = game();
    const id = put(g, 'p1', BOOK);
    settle(g);
    fund(g, 3);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id, abilityIndex: 0 }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
