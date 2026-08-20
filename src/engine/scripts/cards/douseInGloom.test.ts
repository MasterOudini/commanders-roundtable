// `Douse in Gloom` — 2 kills the 2/2 and the caster gains 2.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DOUSE_IN_GLOOM_SCRIPT } from './douseInGloom';
import { DOUSE_IN_GLOOM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function doused(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Douse in Gloom'], ['Grizzly Bears']],
    scripts: createRegistry([DOUSE_IN_GLOOM_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Douse in Gloom', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Douse in Gloom', () => {
  test('2 damage kills the 2/2; the caster gains 2', () => {
    const { g, bears } = doused();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DOUSE_IN_GLOOM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DOUSE_IN_GLOOM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DOUSE_IN_GLOOM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = doused();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
