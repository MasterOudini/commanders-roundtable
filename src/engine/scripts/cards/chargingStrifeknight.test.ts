// `Charging Strifeknight` — Haste lets it tap the turn it enters; the named
// card is discarded in the cost batch and I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CHARGING_STRIFEKNIGHT_SCRIPT } from './chargingStrifeknight';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const KNIGHT = 'Charging Strifeknight';

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

function ready(): { g: Game; knight: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[KNIGHT], []],
    scripts: createRegistry([CHARGING_STRIFEKNIGHT_SCRIPT]),
  });
  const knight = put(g, 'p1', KNIGHT);
  settle(g);
  return { g, knight };
}

describe('Charging Strifeknight', () => {
  test('haste: it taps the turn it enters; the card is discarded and I draw', () => {
    const { g, knight } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: knight, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[knight]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('naming nothing is refused', () => {
    const { g, knight } = ready();
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: knight, abilityIndex: 0, targets: [] }).ok).toBe(false);
  });

  test('replays to the same hash', () => {
    const { g, knight } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: knight, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
