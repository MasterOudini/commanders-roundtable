// `Thragtusk` — 5 life on entry; a 3/3 Beast whether it leaves for the
// graveyard or for exile.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { THRAGTUSK_SCRIPT } from './thragtusk';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TUSK = 'Thragtusk';
const BEAST = TOKEN_TABLE['Beast|3/3|G|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function beasts(g: Game, player: string): InstanceId[] {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === BEAST?.printingId;
  });
}

function landed(): { g: Game; tusk: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[TUSK], []],
    scripts: createRegistry([THRAGTUSK_SCRIPT]),
  });
  const tusk = put(g, 'p1', TUSK);
  settle(g);
  return { g, tusk };
}

describe('Thragtusk', () => {
  test('entering is 5 life', () => {
    const { g } = landed();
    expect(g.state.players['p1']?.life).toBe(45);
    expect(beasts(g, 'p1').length).toBe(0);
  });

  test('leaving for the graveyard is a 3/3 Beast', () => {
    const { g, tusk } = landed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: tusk, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[tusk]?.zone.kind).toBe('graveyard');
    expect(beasts(g, 'p1').length).toBe(1);
  });

  test('leaving for exile is a Beast too', () => {
    const { g, tusk } = landed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: tusk, to: { kind: 'exile', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[tusk]?.zone.kind).toBe('exile');
    expect(beasts(g, 'p1').length).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, tusk } = landed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: tusk, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
