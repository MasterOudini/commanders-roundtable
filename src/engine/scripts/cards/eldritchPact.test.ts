// `Eldritch Pact` — X reads the TARGET's graveyard: three cards there
// means three drawn and three lost.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ELDRITCH_PACT_SCRIPT } from './eldritchPact';
import { ELDRITCH_PACT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pacted(): { g: Game; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Eldritch Pact'], ['Grizzly Bears', 'Mountain', 'Swamp']],
    scripts: createRegistry([ELDRITCH_PACT_SCRIPT]),
  });
  put(g, 'p2', 'Grizzly Bears', 'graveyard');
  put(g, 'p2', 'Mountain', 'graveyard');
  put(g, 'p2', 'Swamp', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Eldritch Pact', 'hand');
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 7 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirs };
}

describe('Eldritch Pact', () => {
  test('X = the target graveyard (3): three drawn, three lost', () => {
    const { g, theirs } = pacted();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 3);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ELDRITCH_PACT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ELDRITCH_PACT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ELDRITCH_PACT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = pacted();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
