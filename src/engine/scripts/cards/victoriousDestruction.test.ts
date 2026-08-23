// `Victorious Destruction` — the artifact-or-land compound, plus the 1-life
// bill on the target's CONTROLLER, read BEFORE the move.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VICTORIOUS_DESTRUCTION_SCRIPT } from './victoriousDestruction';
import { VICTORIOUS_DESTRUCTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Victorious Destruction';
const RING = 'Sol Ring';
const ISLAND = 'Island';
const CITADEL = 'Darksteel Citadel'; // indestructible artifact LAND

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [victimName]],
    scripts: createRegistry([VICTORIOUS_DESTRUCTION_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 8 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Victorious Destruction', () => {
  test('an ARTIFACT dies and its controller pays 1', () => {
    const { g, victim } = cast(RING);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('a LAND dies to the same line', () => {
    const { g, victim } = cast(ISLAND);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('an INDESTRUCTIBLE target survives and STILL pays the life', () => {
    const { g, victim } = cast(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VICTORIOUS_DESTRUCTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VICTORIOUS_DESTRUCTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VICTORIOUS_DESTRUCTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(RING);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
