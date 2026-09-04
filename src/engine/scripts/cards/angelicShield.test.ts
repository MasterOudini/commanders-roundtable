// `Angelic Shield` - +0/+1 reaches its controller's creature and not the
// opponent's, ends when it leaves; the sacrifice activation bounces the declared
// creature and the enchantment is gone; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ANGELIC_SHIELD_SCRIPT } from './angelicShield';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Angelic Shield';
const EEL = 'Coral Eel'; // 2/1
const CYCLOPS = 'Cyclops of One-Eyed Pass'; // 5/2

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([ANGELIC_SHIELD_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; yes: InstanceId; no: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, EEL], [CYCLOPS]], scripts: createRegistry([ANGELIC_SHIELD_SCRIPT]) });
  holdEverywhere(g);
  const yes = put(g, 'p1', EEL);
  const no = put(g, 'p2', CYCLOPS);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, yes, no };
}

describe('Angelic Shield', () => {
  test('Coral Eel is reached, Cyclops of One-Eyed Pass is not', () => {
    const { g, yes, no } = board();
    expect(pt(g, yes)).toEqual([2, 2]);
    expect(pt(g, no)).toEqual([5, 2]);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, yes } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, yes)).toEqual([2, 1]);
  });

  test("sacrifice: the declared creature returns to its owner's hand", () => {
    const { g, self, no } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: no }] }));
    settle(g);
    expect(g.state.cards[no]?.zone.kind).toBe('hand');
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
