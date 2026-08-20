// `Cinder Cloud` — the WHITE victim burns its controller for its power;
// a green one just dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CINDER_CLOUD_SCRIPT } from './cinderCloud';
import { CINDER_CLOUD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function clouded(name: 'Angelheart Protector' | 'Grizzly Bears'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Cinder Cloud'], ['Angelheart Protector', 'Grizzly Bears']],
    scripts: createRegistry([CINDER_CLOUD_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Cinder Cloud', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Cinder Cloud', () => {
  test('the WHITE creature dies and its controller takes ITS POWER (3)', () => {
    const { g, victim } = clouded('Angelheart Protector');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    // Angelheart Protector is a 3-power creature — the burn equals its power.
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the GREEN 2/2 just dies — no burn', () => {
    const { g, victim } = clouded('Grizzly Bears');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CINDER_CLOUD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CINDER_CLOUD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CINDER_CLOUD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = clouded('Angelheart Protector');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
