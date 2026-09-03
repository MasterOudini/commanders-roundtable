// `Mad Prophet` — Haste lets it tap the turn it enters; the named card is
// discarded and I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { MAD_PROPHET_SCRIPT } from './madProphet';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PROPHET = 'Mad Prophet';

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

function ready(): { g: Game; prophet: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PROPHET], []],
    scripts: createRegistry([MAD_PROPHET_SCRIPT]),
  });
  const prophet = put(g, 'p1', PROPHET);
  settle(g);
  return { g, prophet };
}

describe('Mad Prophet', () => {
  test('haste: taps the turn it enters; the card is discarded and I draw', () => {
    const { g, prophet } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: prophet, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[prophet]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, prophet } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: prophet, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
