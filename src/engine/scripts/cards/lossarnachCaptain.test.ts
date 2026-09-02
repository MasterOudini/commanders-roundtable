// `Lossarnach Captain` — its own entry taps an opponent's creature, so does
// another Human's (a non-Human asks nothing), and each of my upkeeps makes a
// Human Soldier — which is itself a Human entering.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { LOSSARNACH_CAPTAIN_SCRIPT } from './lossarnachCaptain';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const CAPTAIN = 'Lossarnach Captain';
const HUMAN = 'Zuran Spellcaster'; // Creature — Human Wizard
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan';
const SOLDIER = TOKEN_TABLE['Human Soldier|1/1|W|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function soldiersOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SOLDIER?.printingId;
  }).length;
}

function mustered(): { g: Game; theirBears: InstanceId; theirTitan: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[CAPTAIN, HUMAN, BEARS], [BEARS, TITAN]],
    scripts: createRegistry([LOSSARNACH_CAPTAIN_SCRIPT]),
  });
  const theirBears = put(g, 'p2', BEARS);
  const theirTitan = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  put(g, 'p1', CAPTAIN);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirBears }] }));
  settle(g);
  return { g, theirBears, theirTitan };
}

describe('Lossarnach Captain', () => {
  test("its own entry taps the opponent's creature", () => {
    const { g, theirBears } = mustered();
    expect(g.state.cards[theirBears]?.tapped).toBe(true);
  });

  test('another Human entering asks again; a non-Human asks nothing', () => {
    const { g, theirTitan } = mustered();
    put(g, 'p1', HUMAN);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirTitan }] }));
    settle(g);
    expect(g.state.cards[theirTitan]?.tapped).toBe(true);
    const asksBefore = g.log.filter((e) => e.body.t === 'PermanentsTapped').length;
    put(g, 'p1', BEARS);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.log.filter((e) => e.body.t === 'PermanentsTapped').length).toBe(asksBefore);
  });

  test('my upkeep makes a Human Soldier, and the Soldier entering asks a tap', () => {
    const { g, theirTitan } = mustered();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    expect(soldiersOf(g, 'p1')).toBe(1);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirTitan }] }));
    settle(g);
    expect(g.state.cards[theirTitan]?.tapped).toBe(true);
  });

  test('replays to the same hash', () => {
    const { g, theirTitan } = mustered();
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 60_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirTitan }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 4, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
