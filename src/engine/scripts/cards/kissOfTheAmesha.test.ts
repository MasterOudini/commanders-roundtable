// `Kiss of the Amesha` — the target gains 7 and draws two.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { KISS_OF_THE_AMESHA_SCRIPT } from './kissOfTheAmesha';
import { KISS_OF_THE_AMESHA } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blessed(): { g: Game; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Kiss of the Amesha'], ['Grizzly Bears']],
    scripts: createRegistry([KISS_OF_THE_AMESHA_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Kiss of the Amesha', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirs };
}

describe('Kiss of the Amesha', () => {
  test('the target gains 7 and draws two', () => {
    const { g, theirs } = blessed();
    expect(g.state.players['p2']?.life).toBe(47);
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = KISS_OF_THE_AMESHA.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, KISS_OF_THE_AMESHA.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(KISS_OF_THE_AMESHA.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blessed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
