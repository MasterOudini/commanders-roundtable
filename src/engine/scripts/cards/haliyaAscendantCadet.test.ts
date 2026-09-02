// `Haliya, Ascendant Cadet` — a counter on entry and on attack (aimed at my
// own creature), and a card when a COUNTERED creature of mine connects —
// Haliya herself, counterless, connects for nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { HALIYA_ASCENDANT_CADET_SCRIPT } from './haliyaAscendantCadet';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const HALIYA = 'Haliya, Ascendant Cadet';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Haliya entered on turn 1 with the Bears already there; the entry counter answered onto the Bears. */
function entered(): { g: Game; haliya: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[HALIYA, BEARS], []],
    scripts: createRegistry([HALIYA_ASCENDANT_CADET_SCRIPT]),
  });
  const bears = put(g, 'p1', BEARS);
  settle(g);
  holdEverywhere(g);
  const haliya = put(g, 'p1', HALIYA);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, haliya, bears };
}

function attackWith(g: Game, attackers: readonly InstanceId[]): void {
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 60_000);
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p1',
      attackers: attackers.map((card) => ({ card, defender: { kind: 'player' as const, id: 'p2' } })),
    }),
  );
}

describe('Haliya, Ascendant Cadet', () => {
  test('entering puts a +1/+1 counter on my creature', () => {
    const { g, bears } = entered();
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
  });

  test('the countered Bears connects: a card', () => {
    const { g, bears } = entered();
    attackWith(g, [bears]);
    const before = idsIn(g, 'p1', 'hand').length;
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before + 1);
  });

  test('Haliya attacks: a second counter is aimed, and her own counterless hit is no card', () => {
    const { g, haliya, bears } = entered();
    attackWith(g, [haliya]);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(2);
    const before = idsIn(g, 'p1', 'hand').length;
    advanceUntil(g, (s) => s.turn.phase === 'postcombatMain', 20_000);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(idsIn(g, 'p1', 'hand').length).toBe(before);
  });

  test('replays to the same hash', () => {
    const { g, bears } = entered();
    attackWith(g, [bears]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
