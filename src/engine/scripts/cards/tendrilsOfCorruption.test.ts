// `Tendrils of Corruption` — the Swamp census spent twice: X damage AND X
// life, from one count.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TENDRILS_OF_CORRUPTION_SCRIPT } from './tendrilsOfCorruption';
import { TENDRILS_OF_CORRUPTION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const TENDRILS = 'Tendrils of Corruption';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(swamps: number): { g: Game; victim: InstanceId } {
  const decks: string[][] = [[TENDRILS], [BEARS]];
  for (let i = 0; i < swamps; i++) decks[0]!.push('Swamp');
  const g = startedGame({
    players: 2,
    decks,
    scripts: createRegistry([TENDRILS_OF_CORRUPTION_SCRIPT]),
  });
  const victim = put(g, 'p2', BEARS);
  for (let i = 0; i < swamps; i++) put(g, 'p1', 'Swamp');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', TENDRILS, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Tendrils of Corruption', () => {
  test('THREE Swamps: 3 damage kills the 2/2 and I gain 3', () => {
    const { g, victim } = cast(3);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p1?.life).toBe(43);
  });

  test('ONE Swamp: 1 damage leaves the 2/2 alive and I gain 1', () => {
    const { g, victim } = cast(1);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(41);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TENDRILS_OF_CORRUPTION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TENDRILS_OF_CORRUPTION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TENDRILS_OF_CORRUPTION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
