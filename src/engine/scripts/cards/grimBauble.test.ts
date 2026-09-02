// `Grim Bauble` — the entry shrinks an opponent's 2/2 to death (mine is not
// a legal target); the sacrifice surveils 2 and a bottomed card is a
// graveyard card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GRIM_BAUBLE_SCRIPT } from './grimBauble';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const BAUBLE = 'Grim Bauble';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; bauble: InstanceId; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[BAUBLE, BEARS], [BEARS]],
    scripts: createRegistry([GRIM_BAUBLE_SCRIPT]),
  });
  const theirs = put(g, 'p2', BEARS);
  const mine = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  const bauble = put(g, 'p1', BAUBLE);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  return { g, bauble, theirs, mine };
}

function resolved(): { g: Game; bauble: InstanceId } {
  const { g, bauble, theirs } = aimed();
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
  settle(g);
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, bauble };
}

describe('Grim Bauble', () => {
  test("the entry kills the opponent's 2/2; mine is refused", () => {
    const { g, theirs, mine } = aimed();
    const wrong = g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] });
    expect(wrong.ok).toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('{2}{B}, {T}, sacrifice: surveil 2, a bottomed card goes to the graveyard', () => {
    const { g, bauble } = resolved();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: bauble, abilityIndex: 0, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.priority.awaiting?.kind === 'scryChoice' && g.state.priority.awaiting.toGraveyard).toBe(true);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed.length).toBe(2);
    const [a, b] = revealed as [InstanceId, InstanceId];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(g.state.cards[a]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bauble]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = resolved();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
