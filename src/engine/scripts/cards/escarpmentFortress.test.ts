// `Escarpment Fortress` - +1/+0 reaches its controller's OTHER creature and not
// the opponent's; attacking with two creatures draws a card, with one does not;
// replay equal.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ESCARPMENT_FORTRESS_SCRIPT } from './escarpmentFortress';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CARD = 'Escarpment Fortress';
const EEL = 'Coral Eel'; // 2/1
const CYCLOPS = 'Cyclops of One-Eyed Pass'; // 5/2
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): [number | null, number | null] {
  const d = deps(createRegistry([ESCARPMENT_FORTRESS_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return [got.power, got.toughness];
}

function board(): { g: Game; self: InstanceId; yes: InstanceId; no: InstanceId; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [[CARD, EEL, BEARS], [CYCLOPS, BEARS]], scripts: createRegistry([ESCARPMENT_FORTRESS_SCRIPT]) });
  holdEverywhere(g);
  const yes = put(g, 'p1', EEL);
  const bears = put(g, 'p1', BEARS);
  const no = put(g, 'p2', CYCLOPS);
  settle(g);
  const self = put(g, 'p1', CARD);
  settle(g);
  return { g, self, yes, no, bears };
}

function attacked(with2: boolean): { g: Game; handBefore: number } {
  const { g, yes, bears } = board();
  // p2's creature stays home in its library-less world: it is on the battlefield but blocks nothing here
  // because the holds stop before blockers and the draw fires at declaration.
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  const handBefore = (g.state.zones.hand.p1 ?? []).length;
  const attackers = with2 ? [yes, bears] : [yes];
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: attackers.map((card) => ({ card, defender: { kind: 'player' as const, id: 'p2' as const } })) }));
  settle(g);
  return { g, handBefore };
}

describe('Escarpment Fortress', () => {
  test('Coral Eel is reached, Cyclops of One-Eyed Pass is not, and the Fortress itself is not', () => {
    const { g, self, yes, no } = board();
    expect(pt(g, yes)).toEqual([3, 1]);
    expect(pt(g, no)).toEqual([5, 2]);
    expect(pt(g, self)).toEqual([3, 5]);
  });

  test('the effect ends when the source leaves the battlefield', () => {
    const { g, self, yes } = board();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: self, to: { kind: 'graveyard', player: 'p1' } }));
    settle(g);
    expect(pt(g, yes)).toEqual([2, 1]);
  });

  test('attacking with two creatures draws a card', () => {
    const { g, handBefore } = attacked(true);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore + 1);
  });

  test('attacking with one creature draws nothing', () => {
    const { g, handBefore } = attacked(false);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(handBefore);
  });

  test('replays to the same hash', () => {
    const { g } = attacked(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
