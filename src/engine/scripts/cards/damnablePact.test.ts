// `Damnable Pact` — the TARGET draws X and loses X: aimed at the opponent,
// their hand grows by two and their life falls by two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DAMNABLE_PACT_SCRIPT } from './damnablePact';
import { DAMNABLE_PACT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pacted(): { g: Game; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Damnable Pact'], ['Grizzly Bears']],
    scripts: createRegistry([DAMNABLE_PACT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Damnable Pact', 'hand');
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirs };
}

describe('Damnable Pact', () => {
  test('the target draws X and loses X', () => {
    const { g, theirs } = pacted();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 2);
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DAMNABLE_PACT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DAMNABLE_PACT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DAMNABLE_PACT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = pacted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
