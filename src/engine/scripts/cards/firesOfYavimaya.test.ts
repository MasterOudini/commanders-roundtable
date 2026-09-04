// `Fires of Yavimaya` - haste reaches its controller's creature and not the
// opponent's, ends when it leaves; the sacrifice activation pumps the declared
// creature and the enchantment is gone; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FIRES_OF_YAVIMAYA_SCRIPT } from './firesOfYavimaya';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Fires of Yavimaya';
const EEL = 'Coral Eel'; // blue 2/1, no keywords
const CYCLOPS = 'Cyclops of One-Eyed Pass'; // red 5/2, no keywords

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  const d = deps(createRegistry([FIRES_OF_YAVIMAYA_SCRIPT]));
  return derive(g.state, d.oracle, d.scripts, id).keywords;
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([FIRES_OF_YAVIMAYA_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; yes: InstanceId; no: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, EEL], [CYCLOPS]], scripts: createRegistry([FIRES_OF_YAVIMAYA_SCRIPT]) });
  holdEverywhere(g);
  const yes = put(g, 'p1', EEL);
  const no = put(g, 'p2', CYCLOPS);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, yes, no };
}

describe('Fires of Yavimaya', () => {
  test('Coral Eel is reached, Cyclops of One-Eyed Pass is not', () => {
    const { g, yes, no } = board();
    expect(kw(g, yes).has('haste')).toBe(true);
    expect(kw(g, no).has('haste')).toBe(false);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, yes } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(kw(g, yes).has('haste')).toBe(false);
  });

  test('sacrifice: the declared creature gets +2/+2 until end of turn', () => {
    const { g, self, yes } = board();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: yes }] }));
    settle(g);
    expect(pt(g, yes)).toEqual([4, 3]);
    expect(g.state.cards[self]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
