// `Dementia Bat` — five mana and the Bat itself: the target player chooses
// two cards of their hand to discard; the Bat is in the graveyard.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { DEMENTIA_BAT_SCRIPT } from './dementiaBat';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BAT = 'Dementia Bat';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fed(): { g: Game; bat: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BAT], []],
    scripts: createRegistry([DEMENTIA_BAT_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bat = put(g, 'p1', BAT);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bat, abilityIndex: 0 }));
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  return { g, bat };
}

describe('Dementia Bat', () => {
  test('the opponent chooses two cards to discard; the Bat is gone', () => {
    const { g, bat } = fed();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    const chosen = hand.slice(0, 2);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: chosen }));
    settle(g);
    for (const id of chosen) expect(g.state.cards[id]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(idsIn(g, 'p2', 'hand').length).toBe(hand.length - 2);
    expect(g.state.cards[bat]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('replays to the same hash', () => {
    const { g } = fed();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone', 20_000);
    const hand = idsIn(g, 'p2', 'hand');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p2', cards: hand.slice(0, 2) }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
