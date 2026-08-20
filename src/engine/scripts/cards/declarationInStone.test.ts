// `Declaration in Stone` — both same-name Bears leave, the differently
// named creature stays, and the victim's controller gets one Clue per
// NONTOKEN exiled.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DECLARATION_IN_STONE_SCRIPT } from './declarationInStone';
import { DECLARATION_IN_STONE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function declared(): { g: Game; a: InstanceId; b: InstanceId; other: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Declaration in Stone'],
      ['Grizzly Bears', 'Grizzly Bears', 'Colossal Dreadmaw'],
    ],
    scripts: createRegistry([DECLARATION_IN_STONE_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Grizzly Bears');
  const other = put(g, 'p2', 'Colossal Dreadmaw');
  expect(b).not.toBe(a);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Declaration in Stone', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: a }] }));
  settle(g);
  return { g, a, b, other };
}

function cluesOf(g: Game, player: 'p1' | 'p2'): number {
  let n = 0;
  for (const id of g.state.zones.battlefield) {
    const card = g.state.cards[id];
    if (!card || card.controller !== player || !card.isToken) continue;
    const oc = g.deps.oracle.byPrinting(card.printingId);
    if (oc?.name === 'Clue') n++;
  }
  return n;
}

describe('Declaration in Stone', () => {
  test('both same-name Bears are exiled, the Dreadmaw stays, and the owner gets TWO Clues', () => {
    const { g, a, b, other } = declared();
    expect(g.state.cards[a]?.zone.kind).toBe('exile');
    expect(g.state.cards[b]?.zone.kind).toBe('exile');
    expect(g.state.cards[other]?.zone.kind).toBe('battlefield');
    expect(cluesOf(g, 'p2')).toBe(2);
    expect(cluesOf(g, 'p1')).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DECLARATION_IN_STONE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DECLARATION_IN_STONE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DECLARATION_IN_STONE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = declared();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
