// `Abzan Ascendancy` - the entering counters land on your creatures only; a nontoken
// creature of yours dying makes a Spirit, the Spirit itself dying makes nothing, the
// opponent's creature dying makes nothing; the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ABZAN_ASCENDANCY_SCRIPT } from './abzanAscendancy';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Abzan Ascendancy';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function tokensOf(g: Game, player: 'p1' | 'p2'): InstanceId[] {
  return Object.values(g.state.cards)
    .filter((c) => c.isToken && c.zone.kind === 'battlefield' && c.controller === player)
    .map((c) => c.id);
}

function armed(): { g: Game; self: InstanceId; yes: InstanceId; no: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CARD, 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']],
    scripts: createRegistry([ABZAN_ASCENDANCY_SCRIPT]),
  });
  holdEverywhere(g);
  const yes = put(g, 'p1', 'Grizzly Bears');
  const no = put(g, 'p2', 'Cyclops of One-Eyed Pass');
  settle(g);
  const self = put(g, 'p1', CARD, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'battlefield', player: 'p1' } }));
  settle(g);
  return { g, self, yes, no };
}

describe(CARD, () => {
  test('entering: a +1/+1 counter on each creature you control, none on the opponent side', () => {
    const { g, yes, no } = armed();
    expect(g.state.cards[yes]?.counters['+1/+1'] ?? 0).toBe(1);
    expect(g.state.cards[no]?.counters['+1/+1'] ?? 0).toBe(0);
  });

  test('a nontoken creature you control dying makes a Spirit; the Spirit dying makes nothing', () => {
    const { g, yes } = armed();
    expect(tokensOf(g, 'p1')).toHaveLength(0);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: yes, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    const spirits = tokensOf(g, 'p1');
    expect(spirits).toHaveLength(1);
    const spirit = spirits[0];
    if (!spirit) throw new Error('no Spirit');
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: spirit, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(tokensOf(g, 'p1')).toHaveLength(0);
  });

  test('the opponent creature dying makes nothing', () => {
    const { g, no } = armed();
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: no, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(tokensOf(g, 'p1')).toHaveLength(0);
    expect(tokensOf(g, 'p2')).toHaveLength(0);
  });

  test('replays to the same hash', () => {
    const { g } = armed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
