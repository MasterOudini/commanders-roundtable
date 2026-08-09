// `Font of Vigor` — seven life, the Font spent.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FONT_OF_VIGOR_SCRIPT } from './fontOfVigor';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FONT = 'Font of Vigor';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; font: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FONT], []],
    scripts: createRegistry([FONT_OF_VIGOR_SCRIPT]),
  });
  const font = put(g, 'p1', FONT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  return { g, font };
}

describe('Font of Vigor', () => {
  test('gains 7 with the Font spent at activation', () => {
    const { g, font } = game();
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: font, abilityIndex: 0, targets: [] }));
    expect(g.state.cards[font]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 7);
  });

  test('replays to the same hash', () => {
    const { g, font } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: font, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
