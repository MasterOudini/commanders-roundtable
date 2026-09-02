// `Ravaging Blaze` — X to the creature always; X to its controller too once
// two instants or sorceries sit in my graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { RAVAGING_BLAZE_SCRIPT } from './ravagingBlaze';
import { RAVAGING_BLAZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Ravaging Blaze';
const BEARS = 'Grizzly Bears';
const SPELLS_IN_YARD = ['Cremate', 'Peek']; // two instants

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function blazed(x: number, mastery: boolean): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...SPELLS_IN_YARD], [BEARS]],
    scripts: createRegistry([RAVAGING_BLAZE_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  if (mastery) for (const name of SPELLS_IN_YARD) put(g, 'p1', name, 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: x }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: x }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Ravaging Blaze', () => {
  test('X=3 with an empty graveyard: the 2/2 dies, its controller is untouched', () => {
    const { g, bears } = blazed(3, false);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('X=2 with two instants in my graveyard: the 2/2 dies and its controller takes 2', () => {
    const { g, bears } = blazed(2, true);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = RAVAGING_BLAZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, RAVAGING_BLAZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(RAVAGING_BLAZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = blazed(2, true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
