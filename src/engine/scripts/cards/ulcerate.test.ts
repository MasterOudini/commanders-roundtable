// `Ulcerate` — -3/-3 kills a 2/2 through the SBA, and the 3 life comes off
// the CASTER whether or not the creature dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ULCERATE_SCRIPT } from './ulcerate';
import { ULCERATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Ulcerate';
const SMALL = 'Grizzly Bears'; // 2/2 — dies
const BIG = 'Grave Titan'; // 6/6 — survives at 3/3

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ulcerated(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [victimName]],
    scripts: createRegistry([ULCERATE_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Ulcerate', () => {
  test('a 2/2 dies and the caster pays 3', () => {
    const { g, victim } = ulcerated(SMALL);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(37);
  });

  test('a 6/6 SURVIVES and the caster pays 3 anyway', () => {
    const { g, victim } = ulcerated(BIG);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ULCERATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ULCERATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ULCERATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ulcerated(SMALL);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
