// `Sagittars' Volley` — the targeted flyer dies; every other flyer my
// opponents control takes 1; my own flyer is untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SAGITTARS_VOLLEY_SCRIPT } from './sagittarsVolley';
import { SAGITTARS_VOLLEY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = "Sagittars' Volley";
const HAWK = 'Vampire Nighthawk';
const AVEN = 'Aven Fateshaper';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; hawk: InstanceId; aven: InstanceId; myHawk: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, HAWK], [HAWK, AVEN, BEARS]],
    scripts: createRegistry([SAGITTARS_VOLLEY_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const hawk = put(g, 'p2', HAWK);
  const aven = put(g, 'p2', AVEN);
  const bears = put(g, 'p2', BEARS);
  const myHawk = put(g, 'p1', HAWK);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, hawk, aven, myHawk, bears };
}

describe("Sagittars' Volley", () => {
  test('the target dies; their other flyer takes 1; mine and their ground creature are untouched', () => {
    const { g, hawk, aven, myHawk, bears } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    expect(g.state.cards[hawk]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[aven]?.damage).toBe(1);
    expect(g.state.cards[myHawk]?.damage).toBe(0);
    expect(g.state.cards[bears]?.damage).toBe(0);
  });

  test('a ground creature is refused at the aim (D289)', () => {
    const { g, bears } = aimed();
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }).ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SAGITTARS_VOLLEY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SAGITTARS_VOLLEY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SAGITTARS_VOLLEY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, hawk } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: hawk }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
