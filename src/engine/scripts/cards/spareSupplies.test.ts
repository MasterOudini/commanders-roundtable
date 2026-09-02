// `Spare Supplies` — enters tapped and draws; once untapped, two mana and
// the sacrifice draw again.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SPARE_SUPPLIES_SCRIPT } from './spareSupplies';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SUPPLIES = 'Spare Supplies';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function placed(): { g: Game; supplies: InstanceId; entryDraws: number; tappedOnEntry: boolean } {
  const g = startedGame({
    players: 2,
    decks: [[SUPPLIES], []],
    scripts: createRegistry([SPARE_SUPPLIES_SCRIPT]),
  });
  settle(g);
  const logAt = g.log.length;
  const supplies = put(g, 'p1', SUPPLIES);
  settle(g);
  const tappedOnEntry = g.state.cards[supplies]?.tapped === true;
  const entryDraws = drawsFor(g, 'p1', logAt);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, supplies, entryDraws, tappedOnEntry };
}

describe('Spare Supplies', () => {
  test('it enters tapped and draws one', () => {
    const { tappedOnEntry, entryDraws } = placed();
    expect(tappedOnEntry).toBe(true);
    expect(entryDraws).toBe(1);
  });

  test('{2}, {T}, sacrifice: a card, the Supplies gone', () => {
    const { g, supplies } = placed();
    expect(g.state.cards[supplies]?.tapped).toBe(false);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: supplies, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[supplies]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, supplies } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: supplies, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
