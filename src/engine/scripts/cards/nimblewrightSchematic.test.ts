// `Nimblewright Schematic` — BOTH arms in one game: entering builds one
// Construct, dying builds another.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NIMBLEWRIGHT_SCHEMATIC_SCRIPT } from './nimblewrightSchematic';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function constructs(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const card = g.state.cards[id];
    if (!card || !card.isToken) return false;
    return g.deps.oracle.byPrinting(card.printingId)?.name === 'Construct';
  }).length;
}

function schemed(): { g: Game; schematic: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nimblewright Schematic'], []],
    scripts: createRegistry([NIMBLEWRIGHT_SCHEMATIC_SCRIPT]),
  });
  const schematic = put(g, 'p1', 'Nimblewright Schematic');
  settle(g);
  return { g, schematic };
}

describe('Nimblewright Schematic', () => {
  test('entering builds one; dying builds another', () => {
    const { g, schematic } = schemed();
    expect(constructs(g)).toBe(1);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: schematic,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    expect(constructs(g)).toBe(2);
  });

  test('replays to the same hash', () => {
    const { g, schematic } = schemed();
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: schematic,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
