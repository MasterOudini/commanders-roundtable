// `Incandescent Aria` — 3 to each NONTOKEN creature: the real Bears
// dies, the token twin stands untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INCANDESCENT_ARIA_SCRIPT } from './incandescentAria';
import { INCANDESCENT_ARIA } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sung(): { g: Game; bears: InstanceId; token: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Incandescent Aria'], ['Grizzly Bears']],
    scripts: createRegistry([INCANDESCENT_ARIA_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const soldier = g.deps.oracle.byName?.('Soldier');
  must(
    g.submit({
      t: 'ManualCreateToken',
      player: 'p2',
      printingId: soldier?.printingId ?? '',
      count: 1,
    }),
  );
  settle(g);
  const token = (g.state.zones.battlefield ?? []).find(
    (id) => g.state.cards[id]?.isToken,
  ) as InstanceId;
  expect(token).toBeDefined();
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Incandescent Aria', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, token };
}

describe('Incandescent Aria', () => {
  test('the real 2/2 dies; the TOKEN is exempt and unmarked', () => {
    const { g, bears, token } = sung();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[token]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[token]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INCANDESCENT_ARIA.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INCANDESCENT_ARIA.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INCANDESCENT_ARIA.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sung();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
