// `Sea Gate Oracle` — entering asks the take: one of the top two to the
// hand, the other to the bottom.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { SEA_GATE_ORACLE_SCRIPT } from './seaGateOracle';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function oracled(): { g: Game; revealed: InstanceId[] } {
  const g = startedGame({
    players: 2,
    decks: [['Sea Gate Oracle'], []],
    scripts: createRegistry([SEA_GATE_ORACLE_SCRIPT]),
  });
  holdEverywhere(g);
  put(g, 'p1', 'Sea Gate Oracle');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 60_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  return { g, revealed };
}

describe('Sea Gate Oracle', () => {
  test('the pick goes to hand and the other to the BOTTOM', () => {
    const { g, revealed } = oracled();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('chooseFromZone');
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.zone).toBe('library');
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.rest).toBe('bottom');
    expect(revealed).toHaveLength(2);
    const pick = revealed[1] as InstanceId;
    const other = revealed[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [pick] }));
    settle(g);
    expect(g.state.cards[pick]?.zone.kind).toBe('hand');
    const lib = g.state.zones.library['p1'] ?? [];
    expect(lib[0]).toBe(other);
  });

  test('replays to the same hash', () => {
    const { g, revealed } = oracled();
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [revealed[0] as InstanceId] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
