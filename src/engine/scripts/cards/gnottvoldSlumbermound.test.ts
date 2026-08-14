// `Gnottvold Slumbermound` — enters tapped; the sacrifice destroys the
// target land AND makes the Troll — and an INDESTRUCTIBLE target stops only
// the destruction: the Troll arrives either way (the two-sentence rule).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { GNOTTVOLD_SLUMBERMOUND_SCRIPT } from './gnottvoldSlumbermound';
import { advanceUntil, battlefieldOf, must, nameOf, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const MOUND = 'Gnottvold Slumbermound';
const MOUNTAIN = 'Mountain';
const CITADEL = 'Darksteel Citadel';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function trolls(g: Game): number {
  return battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Troll Warrior').length;
}

function board(target: string): { g: Game; mound: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[MOUND], [MOUNTAIN, CITADEL]],
    scripts: createRegistry([GNOTTVOLD_SLUMBERMOUND_SCRIPT]),
  });
  const mound = put(g, 'p1', MOUND);
  const theirs = put(g, 'p2', target);
  settle(g);
  expect(g.state.cards[mound]?.tapped).toBe(true);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mound], tapped: false }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  return { g, mound, theirs };
}

describe('Gnottvold Slumbermound', () => {
  test('destroys the target land and makes the Troll; the Mound is spent', () => {
    const { g, mound, theirs } = board(MOUNTAIN);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mound,
        abilityIndex: 1,
        targets: [{ kind: 'card', id: theirs }],
      }),
    );
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mound]?.zone.kind).toBe('graveyard');
    expect(trolls(g)).toBe(1);
  });

  test('an INDESTRUCTIBLE land survives — and the Troll STILL arrives', () => {
    const { g, mound, theirs } = board(CITADEL);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mound,
        abilityIndex: 1,
        targets: [{ kind: 'card', id: theirs }],
      }),
    );
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(trolls(g)).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, mound, theirs } = board(MOUNTAIN);
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: mound,
        abilityIndex: 1,
        targets: [{ kind: 'card', id: theirs }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
