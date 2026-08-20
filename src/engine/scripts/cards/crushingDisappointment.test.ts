// `Crushing Disappointment` — everyone loses 2, the caster draws two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CRUSHING_DISAPPOINTMENT_SCRIPT } from './crushingDisappointment';
import { CRUSHING_DISAPPOINTMENT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function disappointed(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Crushing Disappointment'], ['Grizzly Bears']],
    scripts: createRegistry([CRUSHING_DISAPPOINTMENT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Crushing Disappointment', 'hand');
  const before = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, before };
}

describe('Crushing Disappointment', () => {
  test('both players lose 2; the caster draws two', () => {
    const { g, before } = disappointed();
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(38);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(before + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CRUSHING_DISAPPOINTMENT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CRUSHING_DISAPPOINTMENT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CRUSHING_DISAPPOINTMENT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = disappointed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
