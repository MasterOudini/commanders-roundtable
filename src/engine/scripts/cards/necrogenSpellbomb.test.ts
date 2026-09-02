// `Necrogen Spellbomb` — the black sacrifice asks the TARGETED player for a
// card of their hand and bins it; the generic sacrifice draws me one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { NECROGEN_SPELLBOMB_SCRIPT } from './necrogenSpellbomb';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELLBOMB = 'Necrogen Spellbomb';

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

function board(): { g: Game; bomb: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELLBOMB], []],
    scripts: createRegistry([NECROGEN_SPELLBOMB_SCRIPT]),
  });
  const bomb = put(g, 'p1', SPELLBOMB);
  settle(g);
  return { g, bomb };
}

describe('Necrogen Spellbomb', () => {
  test('{B}, sacrifice: the opponent picks a card of their hand to discard', () => {
    const { g, bomb } = board();
    const before = (g.state.zones.hand['p2'] ?? []).length;
    expect(before).toBeGreaterThan(0);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.player === 'p2' && awaiting.count === 1).toBe(true);
    const pick = (g.state.zones.hand['p2'] ?? [])[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [pick] }));
    settle(g);
    expect(g.state.cards[pick]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before - 1);
    expect(g.state.cards[bomb]?.zone.kind).toBe('graveyard');
  });

  test('{1}, sacrifice: I draw', () => {
    const { g, bomb } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 1, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[bomb]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, bomb } = board();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bomb, abilityIndex: 0 }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const pick = (g.state.zones.hand['p2'] ?? [])[0] as InstanceId;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: [pick] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
