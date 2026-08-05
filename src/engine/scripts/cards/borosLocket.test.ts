// `Boros Locket` — the hybrid cost paid in all-red, the parse pinned.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { BOROS_LOCKET_SCRIPT } from './borosLocket';
import { BOROS_LOCKET } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const LOCKET = 'Boros Locket';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; locket: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[LOCKET], []],
    scripts: createRegistry([BOROS_LOCKET_SCRIPT]),
  });
  const locket = put(g, 'p1', LOCKET);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  return { g, locket };
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log.slice(from).reduce(
    (n, e) =>
      e.body.t === 'CardsMoved'
        ? n +
          e.body.moves.filter(
            (m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player,
          ).length
        : n,
    0,
  );
}

describe('Boros Locket', () => {
  test('the parse says what the def assumes: the hybrid cost is PAYABLE, self-sacrificing', () => {
    const oc = ORACLE.byPrinting(BOROS_LOCKET.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(2);
    expect(abilities[1]?.payable).toBe(true);
    expect(abilities[1]?.sacrificesSelf).toBe(true);
  });

  test('draws two on all-red mana, the Locket spent as part of the cost', () => {
    const { g, locket } = game();
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.cards[locket]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, locket } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: locket, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
