// `Lord of the Undead` - +1/+1 reaches ANY other Zombie (the opponent's too) and
// not a non-Zombie nor itself; the activation returns a Zombie card from the
// graveyard and refuses a non-Zombie card; replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LORD_OF_THE_UNDEAD_SCRIPT } from './lordOfTheUndead';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Lord of the Undead';
const CORPSE = 'Walking Corpse'; // Zombie 2/2
const EEL = 'Coral Eel'; // Fish 2/1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([LORD_OF_THE_UNDEAD_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; theirCorpse: InstanceId; eel: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, EEL, CORPSE], [CORPSE]], scripts: createRegistry([LORD_OF_THE_UNDEAD_SCRIPT]) });
  holdEverywhere(g);
  const theirCorpse = put(g, 'p2', CORPSE);
  const eel = put(g, 'p1', EEL);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, theirCorpse, eel };
}

describe('Lord of the Undead', () => {
  test("the opponent's Walking Corpse is reached, Coral Eel is not, the Lord itself is not", () => {
    const { g, self, theirCorpse, eel } = board();
    expect(pt(g, theirCorpse)).toEqual([3, 3]);
    expect(pt(g, eel)).toEqual([2, 1]);
    expect(pt(g, self)).toEqual([2, 2]);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, theirCorpse } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, theirCorpse)).toEqual([2, 2]);
  });

  test('{1}{B}, {T}: a Zombie card returns from the graveyard; a Fish card is refused', () => {
    const { g, self } = board();
    const corpse = put(g, 'p1', CORPSE, 'graveyard');
    const eelCard = put(g, 'p1', EEL, 'graveyard');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: self, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: eelCard }] }).ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: corpse }] }));
    settle(g);
    expect(g.state.cards[corpse]?.zone.kind).toBe('hand');
    expect(g.state.cards[self]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
