// `Urza's Factory` — the activated token at #a1, because a MANA line counts
// as ability 0.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry } from '../registry';
import { URZAS_FACTORY_SCRIPT } from './urzasFactory';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FACTORY = "Urza's Factory";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function built(): { g: Game; factory: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FACTORY], []],
    scripts: createRegistry([URZAS_FACTORY_SCRIPT]),
  });
  const factory = put(g, 'p1', FACTORY);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 3 && s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain',
    120_000,
  );
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 7 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: factory, abilityIndex: 1 }));
  settle(g);
  return { g, factory };
}

describe("Urza's Factory", () => {
  test('#a1 makes one 2/2 colourless Assembly-Worker, and the land survives', () => {
    const { g, factory } = built();
    const token = g.state.zones.battlefield.find((id) => g.state.cards[id]?.isToken);
    expect(token).toBeDefined();
    const d = derive(g.state, ORACLE, g.deps.scripts, token as InstanceId);
    expect(d.power).toBe(2);
    expect(d.toughness).toBe(2);
    expect(d.colors).toHaveLength(0);
    expect(d.typeLine.types).toContain('Artifact');
    expect(d.typeLine.types).toContain('Creature');
    expect(g.state.cards[factory]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[factory]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = built();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
