// `Castle Ardenvale` — D135's conditional entry answered BOTH ways, and the
// activated Human maker on top.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { CASTLE_ARDENVALE_SCRIPT } from './castleArdenvale';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CASTLE = 'Castle Ardenvale';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function enterCastle(g: Game): InstanceId {
  const castle = put(g, 'p1', CASTLE, 'graveyard');
  must(
    g.submit({ t: 'ManualMoveCard', player: 'p1', card: castle, to: { kind: 'battlefield', player: 'p1' } }),
  );
  settle(g);
  return castle;
}

describe('Castle Ardenvale', () => {
  test('enters TAPPED with no Plains, UNTAPPED with one — D135 both ways', () => {
    const g1 = startedGame({
      players: 2,
      decks: [[CASTLE], []],
      scripts: createRegistry([CASTLE_ARDENVALE_SCRIPT]),
    });
    // ⚠️ The entry must be a SEPARATE statement: in `g.state.cards[f(g)]` the
    // member chain evaluates BEFORE the call, and this engine's state is
    // immutable — that reads the PRE-entry cards map, where nothing is tapped.
    const noPlains = enterCastle(g1);
    expect(g1.state.cards[noPlains]?.tapped).toBe(true);

    const g2 = startedGame({
      players: 2,
      decks: [[CASTLE, 'Plains'], []],
      scripts: createRegistry([CASTLE_ARDENVALE_SCRIPT]),
    });
    put(g2, 'p1', 'Plains');
    settle(g2);
    const withPlains = enterCastle(g2);
    expect(g2.state.cards[withPlains]?.tapped).toBe(false);
  });

  test('the activated ability creates a real 1/1 Human', () => {
    const g = startedGame({
      players: 2,
      decks: [[CASTLE], []],
      scripts: createRegistry([CASTLE_ARDENVALE_SCRIPT]),
    });
    const castle = enterCastle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [castle], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: castle, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Human')).toHaveLength(1);
    expect(g.state.cards[castle]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const g = startedGame({
      players: 2,
      decks: [[CASTLE], []],
      scripts: createRegistry([CASTLE_ARDENVALE_SCRIPT]),
    });
    const castle = enterCastle(g);
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [castle], tapped: false }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: castle, abilityIndex: 1, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
