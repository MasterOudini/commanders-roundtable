// D459 - FABRICATE N (CR 702.122): when this permanent enters, put N +1/+1 counters on it or create N 1/1 colorless
// Servo artifact creature tokens. A keyword trigger with MODES: the keyword table's entry declares the two modes, the
// bus pushes them onto the pending trigger the way a def's ride (D343 - the choice is asked as the trigger goes on
// the stack), and the resolution reads the chosen mode. The Servo is TOKEN_TABLE's, pinned in the fixtures. Proven on
// Weaponcraft Enthusiast (fabricate 2, no script): the counters, the Servos, a granted fabricate 1 through the
// keyword's own amount, the replay hash. `engineComplete` claims the line off the keyword.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { KEYWORD_TRIGGERS } from './keywordTriggers';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function armed(): Game {
  const g = startedGame({ players: 2, decks: [['Weaponcraft Enthusiast', 'Peema Outrider', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: createRegistry([]) });
  holdEverywhere(g);
  return g;
}
function enter(g: Game, name: string): InstanceId {
  const id = put(g, 'p1', name);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseModes', 20_000);
  return id;
}
const servos = (g: Game): number => g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === 'p1' && g.state.cards[id]?.isToken === true).length;

describe('D459 - the parse and the table', () => {
  test('fabricate is a keyword the parser reads with its number, and the table names its two modes', () => {
    const card = ORACLE.byName('Weaponcraft Enthusiast');
    expect(card?.faces[0]?.keywords).toContain('fabricate');
    expect(KEYWORD_TRIGGERS.get('fabricate')?.modes).toBeDefined();
  });
});

describe('D459 - fabricate 2 (Weaponcraft Enthusiast)', () => {
  test('the entry trigger asks for a mode; the counters mode puts two +1/+1 counters on it', () => {
    const g = armed();
    const id = enter(g, 'Weaponcraft Enthusiast');
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseModes');
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    settle(g);
    expect(g.state.cards[id]?.counters['+1/+1'] ?? 0).toBe(2);
    expect(servos(g)).toBe(0);
  });

  test('the Servo mode creates two 1/1 colorless Servo artifact creature tokens and puts no counter', () => {
    const g = armed();
    const id = enter(g, 'Weaponcraft Enthusiast');
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    settle(g);
    expect(g.state.cards[id]?.counters['+1/+1'] ?? 0).toBe(0);
    expect(servos(g)).toBe(2);
    const servo = g.state.zones.battlefield.map((x) => g.state.cards[x]).find((c) => c?.isToken === true);
    expect(servo).toBeDefined();
    expect(ORACLE.byPrinting(servo?.printingId ?? '')?.name).toBe('Servo');
  });

  test('fabricate 1 puts one counter (Peema Outrider) - the amount is the printed number', () => {
    const g = armed();
    const id = enter(g, 'Peema Outrider');
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [0] }));
    settle(g);
    expect(g.state.cards[id]?.counters['+1/+1'] ?? 0).toBe(1);
  });

  test('a creature without the keyword asks nothing on entry', () => {
    const g = armed();
    put(g, 'p1', 'Grizzly Bears');
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(servos(g)).toBe(0);
  });

  test('replays to the same hash', () => {
    const g = armed();
    enter(g, 'Weaponcraft Enthusiast');
    must(g.submit({ t: 'ChooseModes', player: 'p1', modes: [1] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
