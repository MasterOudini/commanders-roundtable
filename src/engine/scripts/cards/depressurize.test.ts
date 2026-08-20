// `Depressurize` — a 2/2 at -3/-0 is 0 power or less and dies; a 6/6 takes
// the debuff and stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DEPRESSURIZE_SCRIPT } from './depressurize';
import { DEPRESSURIZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function vented(name: 'Grizzly Bears' | 'Colossal Dreadmaw'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Depressurize'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([DEPRESSURIZE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Depressurize', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Depressurize', () => {
  test('the 2/2 goes to 0 power or less and is destroyed', () => {
    const { g, victim } = vented('Grizzly Bears');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('the 6/6 takes -3/-0 and stands at 3 power', () => {
    const { g, victim } = vented('Colossal Dreadmaw');
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, victim).power).toBe(3);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DEPRESSURIZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DEPRESSURIZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DEPRESSURIZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = vented('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
