// `Harrowing Journey` — the TARGET draws three and loses 3; the caster
// gets nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HARROWING_JOURNEY_SCRIPT } from './harrowingJourney';
import { HARROWING_JOURNEY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function journeyed(): { g: Game; mine: number; theirs: number } {
  const g = startedGame({
    players: 2,
    decks: [['Harrowing Journey'], ['Grizzly Bears']],
    scripts: createRegistry([HARROWING_JOURNEY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Harrowing Journey', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  const mine = (g.state.zones.hand['p1'] ?? []).length;
  const theirs = (g.state.zones.hand['p2'] ?? []).length;
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, mine, theirs };
}

describe('Harrowing Journey', () => {
  test('the target draws three and pays 3; I draw nothing', () => {
    const { g, mine, theirs } = journeyed();
    expect((g.state.zones.hand['p2'] ?? []).length).toBe(theirs + 3);
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HARROWING_JOURNEY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HARROWING_JOURNEY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HARROWING_JOURNEY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = journeyed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
