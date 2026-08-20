// `Irradiate` — two artifacts make it -2/-2: the 2/2 dies of it.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { IRRADIATE_SCRIPT } from './irradiate';
import { IRRADIATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function irradiated(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Irradiate', 'Sol Ring', 'Azorius Locket'], ['Grizzly Bears']],
    scripts: createRegistry([IRRADIATE_SCRIPT]),
  });
  put(g, 'p1', 'Sol Ring');
  put(g, 'p1', 'Azorius Locket');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Irradiate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Irradiate', () => {
  test('two artifacts: the 2/2 takes -2/-2 and dies', () => {
    const { g, bears } = irradiated();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = IRRADIATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, IRRADIATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(IRRADIATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = irradiated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
