// `Masked Meower` — a discarded card and the Meower itself, both taken in
// the cost batch, buy a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MASKED_MEOWER_SCRIPT } from './maskedMeower';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MEOWER = 'Masked Meower';

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

function placed(): { g: Game; meower: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MEOWER], []],
    scripts: createRegistry([MASKED_MEOWER_SCRIPT]),
  });
  const meower = put(g, 'p1', MEOWER);
  settle(g);
  return { g, meower };
}

describe('Masked Meower', () => {
  test('discard a card, sacrifice it: a card drawn, both in the graveyard', () => {
    const { g, meower } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: meower, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[meower]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, meower } = placed();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: meower, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
