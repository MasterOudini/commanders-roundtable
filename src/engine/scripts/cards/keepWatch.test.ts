// `Keep Watch` — cast as the defender with two attackers in: two cards.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { KEEP_WATCH_SCRIPT } from './keepWatch';
import { KEEP_WATCH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function watched(): { g: Game; mid: number } {
  const g = startedGame({
    players: 2,
    decks: [['Keep Watch'], ['Grizzly Bears', 'Elvish Herder']],
    scripts: createRegistry([KEEP_WATCH_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [
        { card: a, defender: { kind: 'player', id: 'p1' } },
        { card: b, defender: { kind: 'player', id: 'p1' } },
      ],
    }),
  );
  advanceUntil(
    g,
    (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0,
    20_000,
  );
  const spell = put(g, 'p1', 'Keep Watch', 'hand');
  const mid = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mid };
}

describe('Keep Watch', () => {
  test('two attackers draw me two', () => {
    const { g, mid } = watched();
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mid + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = KEEP_WATCH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, KEEP_WATCH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(KEEP_WATCH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = watched();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
