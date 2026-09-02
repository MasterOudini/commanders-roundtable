// `Wrecking Ball` — the creature-or-land compound, both halves, and an
// indestructible land survives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WRECKING_BALL_SCRIPT } from './wreckingBall';
import { WRECKING_BALL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wrecking Ball';
const BEARS = 'Grizzly Bears';
const ISLAND = 'Island';
const CITADEL = 'Darksteel Citadel'; // indestructible artifact LAND

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [victimName]],
    scripts: createRegistry([WRECKING_BALL_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Wrecking Ball', () => {
  test('a CREATURE dies', () => {
    const { g, victim } = cast(BEARS);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('a LAND dies to the same line', () => {
    const { g, victim } = cast(ISLAND);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE land survives', () => {
    const { g, victim } = cast(CITADEL);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WRECKING_BALL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WRECKING_BALL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WRECKING_BALL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(BEARS);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
