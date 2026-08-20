// `Mind Burst` — one namesake in a graveyard makes the count 2; the ask
// lands on the TARGET; a count covering the whole hand skips the ask.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MIND_BURST_SCRIPT } from './mindBurst';
import { MIND_BURST } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burst(graveCopies: number): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [
      [
        'Mind Burst',
        'Mind Burst',
        'Mind Burst',
        'Mind Burst',
        'Mind Burst',
        'Mind Burst',
        'Mind Burst',
        'Mind Burst',
      ],
      ['Grizzly Bears'],
    ],
    scripts: createRegistry([MIND_BURST_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const seen = new Set<string>();
  for (let i = 0; i < graveCopies; i++) {
    const copy = put(g, 'p1', 'Mind Burst', 'hand');
    if (seen.has(copy)) throw new Error('put returned the same Mind Burst twice');
    seen.add(copy);
    must(
      g.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: copy,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
  }
  const spell = put(g, 'p1', 'Mind Burst', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  const before = (g.state.zones.hand['p2'] ?? []).length;
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return { g, before };
}

describe('Mind Burst', () => {
  test('one namesake in the graveyard asks the TARGET to discard 2', () => {
    const { g, before } = burst(1);
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('chooseFromZone');
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.player).toBe('p2');
    expect(awaiting?.kind === 'chooseFromZone' && awaiting.count).toBe(2);
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    settle(g);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before - 2);
  });

  test('a count covering the whole hand goes CHOICELESSLY (CR 701.8a)', () => {
    const { g } = burst(7);
    // 1 + 7 namesakes = 8 >= the 7-card hand: no ask, the hand is gone.
    expect(g.state.priority.awaiting?.kind).not.toBe('chooseFromZone');
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MIND_BURST.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MIND_BURST.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MIND_BURST.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burst(1);
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
