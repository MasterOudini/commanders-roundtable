// `Blood Pact` — the TARGET draws two and pays 2, whoever they are.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLOOD_PACT_SCRIPT } from './bloodPact';
import { BLOOD_PACT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pacted(): { g: Game; before: number } {
  const g = startedGame({
    players: 2,
    decks: [['Blood Pact'], ['Grizzly Bears']],
    scripts: createRegistry([BLOOD_PACT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const before = (g.state.zones.hand['p2'] ?? []).length;
  const spell = put(g, 'p1', 'Blood Pact', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, before };
}

describe('Blood Pact', () => {
  test('the TARGET draws two and loses 2', () => {
    const { g, before } = pacted();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(before + 2);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLOOD_PACT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLOOD_PACT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLOOD_PACT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = pacted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
