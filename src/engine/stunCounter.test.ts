// D470 - THE STUN COUNTER (CR 122.1j): "If a permanent with a stun counter would become untapped, instead remove a stun
// counter from it." A built-in over `PermanentsUntapped`, so the untap step and an untap effect meet one rule. Proven on
// the Bears under a manual counter: tapped with two counters it sits out two untap steps and untaps on the third; an
// untapped stunned creature keeps its counter (nothing would untap); an untap spell spends one; the replay hash.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SCRIPTS = createRegistry([]);

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function stun(g: Game, id: InstanceId, n: number): void {
  must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: id, kind: 'stun', delta: n }));
}
function stuns(g: Game, id: InstanceId): number {
  return g.state.cards[id]?.counters['stun'] ?? 0;
}
function toMain(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 60_000);
}

function armed(): { g: Game; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Ornamental Courage'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  toMain(g, 3);
  return { g, bears };
}

describe('D470 - the stun counter', () => {
  test('tapped with two counters, it sits out two untap steps and untaps on the third', () => {
    const { g, bears } = armed();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    stun(g, bears, 2);
    toMain(g, 5);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(stuns(g, bears)).toBe(1);
    toMain(g, 7);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(stuns(g, bears)).toBe(0);
    toMain(g, 9);
    expect(g.state.cards[bears]?.tapped).toBe(false);
    expect(g.log.filter((e) => e.body.t === 'CountersChanged' && e.body.changes.some((c) => c.card === bears && c.kind === 'stun' && c.delta === -1)).length).toBe(2);
  });

  test('an untapped stunned creature keeps its counter: nothing would untap', () => {
    const { g, bears } = armed();
    stun(g, bears, 1);
    toMain(g, 5);
    expect(g.state.cards[bears]?.tapped).toBe(false);
    expect(stuns(g, bears)).toBe(1);
  });

  test('an untap effect spends a counter too: Ornamental Courage on the tapped, stunned Bears', () => {
    const { g, bears } = armed();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    stun(g, bears, 1);
    const card = put(g, 'p1', 'Ornamental Courage', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.tapped).toBe(true);
    expect(stuns(g, bears)).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, bears } = armed();
    must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [bears], tapped: true }));
    stun(g, bears, 1);
    toMain(g, 5);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
