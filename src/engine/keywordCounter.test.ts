// D471 - THE KEYWORD COUNTER (CR 122.1c): a permanent with a keyword counter has that keyword. `derive` reads the
// enforced kinds off `counters` at layer 6 (the printed word is the kind - `first strike` - the engine's id the
// keyword), an addition beside the until-end-of-turn grants; a lose-all-abilities effect still clears it in
// `finish()`, and a kind the engine does not enforce stays inert. Proven on the Bears under manual counters, on
// Humility, and through the vocabulary (Splendor Mare's entry puts a lifelink counter on target creature you control).

import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { createRegistry } from './scripts/registryCore';
import { HUMILITY_SCRIPT } from './testing/cardScripts';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}
function counter(g: Game, id: InstanceId, kind: string, delta: number): void {
  must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: id, kind, delta }));
}
function kw(g: Game, id: InstanceId): ReadonlySet<string> {
  return derive(g.state, g.deps.oracle, g.deps.scripts, id).keywords;
}

function armed(extra: string[] = [], scripts = createRegistry([])): { g: Game; bears: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...extra], ['Cyclops of One-Eyed Pass']], scripts });
  holdEverywhere(g);
  put(g, 'p2', 'Cyclops of One-Eyed Pass');
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  return { g, bears };
}

describe('D471 - the keyword counter', () => {
  test('a flying counter is flying; a first strike counter is first strike; removed, the keyword goes', () => {
    const { g, bears } = armed();
    expect(kw(g, bears).has('flying')).toBe(false);
    counter(g, bears, 'flying', 1);
    expect(kw(g, bears).has('flying')).toBe(true);
    counter(g, bears, 'first strike', 1);
    expect(kw(g, bears).has('firstStrike')).toBe(true);
    counter(g, bears, 'flying', -1);
    expect(kw(g, bears).has('flying')).toBe(false);
    expect(kw(g, bears).has('firstStrike')).toBe(true);
  });

  test('a kind the engine does not enforce is inert (an exalted counter grants nothing it reads)', () => {
    const { g, bears } = armed();
    counter(g, bears, 'exalted', 1);
    expect(kw(g, bears).has('exalted' as never)).toBe(false);
    expect(g.state.cards[bears]?.counters['exalted']).toBe(1);
  });

  test('Humility takes it away with the rest: the counter stays, the keyword does not', () => {
    const { g, bears } = armed(['Humility'], createRegistry([HUMILITY_SCRIPT]));
    counter(g, bears, 'flying', 1);
    expect(kw(g, bears).has('flying')).toBe(true);
    put(g, 'p1', 'Humility');
    settle(g);
    expect(kw(g, bears).has('flying')).toBe(false);
    expect(g.state.cards[bears]?.counters['flying']).toBe(1);
  });

  test('replays to the same hash', () => {
    const { g, bears } = armed();
    counter(g, bears, 'lifelink', 1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(kw(g, bears).has('lifelink')).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
