// `Torch the Witness` — twice X, and the Clue only when the damage was
// EXCESS. The boundary is the point: exactly lethal investigates nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TORCH_THE_WITNESS_SCRIPT } from './torchTheWitness';
import { TORCH_THE_WITNESS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Torch the Witness';
const BEARS = 'Grizzly Bears'; // 2/2 — lethal is 2
const TITAN = 'Grave Titan'; // 6/6 — lethal is 6

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function clues(g: Game): number {
  return g.state.zones.battlefield.filter((id) => {
    const inst = g.state.cards[id];
    if (!inst || inst.controller !== 'p1') return false;
    return (g.deps.oracle.byPrinting(inst.printingId)?.name ?? '') === 'Clue';
  }).length;
}

function torched(victimName: string, x: number): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [victimName]],
    scripts: createRegistry([TORCH_THE_WITNESS_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: x + 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Torch the Witness', () => {
  test('X=1 is 2 damage: EXACTLY lethal on a 2/2, so no Clue', () => {
    const { g, victim } = torched(BEARS, 1);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(clues(g)).toBe(0);
  });

  test('X=3 is 6 damage on a 2/2: excess, so a Clue', () => {
    const { g, victim } = torched(BEARS, 3);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(clues(g)).toBe(1);
  });

  test('X=2 is 4 damage on a 6/6: not even lethal, so no Clue and it lives', () => {
    const { g, victim } = torched(TITAN, 2);
    expect(g.state.cards[victim]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[victim]?.damage).toBe(4);
    expect(clues(g)).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TORCH_THE_WITNESS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TORCH_THE_WITNESS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TORCH_THE_WITNESS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = torched(BEARS, 3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
