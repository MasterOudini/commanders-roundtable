// `Goblin Picker` — red mana, the tap and a discarded card buy a card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GOBLIN_PICKER_SCRIPT } from './goblinPicker';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const PICKER = 'Goblin Picker';

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

function ready(): { g: Game; picker: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[PICKER], []],
    scripts: createRegistry([GOBLIN_PICKER_SCRIPT]),
  });
  const picker = put(g, 'p1', PICKER);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber >= 3 && s.priority.awaiting === null, 60_000);
  return { g, picker };
}

describe('Goblin Picker', () => {
  test('{R}, {T}, discard a card: draw a card', () => {
    const { g, picker } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: picker, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    expect(g.state.cards[chosen]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[picker]?.tapped).toBe(true);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('without the red mana it is refused', () => {
    const { g, picker } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: picker, abilityIndex: 0, discard: [chosen], targets: [] }).ok).toBe(false);
    expect(g.state.cards[chosen]?.zone.kind).toBe('hand');
  });

  test('replays to the same hash', () => {
    const { g, picker } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: picker, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
