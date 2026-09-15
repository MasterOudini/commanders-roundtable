// D445 - BACKUP N (CR 702.165): when the creature enters, N +1/+1 counters on target creature; another creature
// gains the keywords printed BELOW the Backup line until end of turn. The reading is gated: a non-keyword line
// below backup refuses the whole keyword, and the card stays a leftover.

import { describe, expect, test } from 'vitest';
import { derive, makeDeriveCache } from './derive';
import { replay, stateHash } from './log';
import { NO_SCRIPTS } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { parseBackup } from '../data/oracleParse';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import type { Game } from './game';

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
function game(p1: readonly string[]): Game {
  const g = startedGame({ players: 2, decks: [[...p1, ...FORESTS], [...FORESTS]], options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
const kw = (g: Game, id: string) => derive(g.state, ORACLE, NO_SCRIPTS, id, makeDeriveCache(g.state)).keywords;
function fixture(name: string) {
  const card = ENGINE_CARDS.find((c) => c.name === name);
  if (!card) throw new Error(`no fixture ${name}`);
  return card;
}

describe('backup (D445)', () => {
  test('the reading: the keywords below the line, a Flash above it left out, a static below it refusing the whole keyword', () => {
    expect(parseBackup(fixture('Boon-Bringer Valkyrie').faces[0]?.oracleText ?? '')).toEqual({ n: 1, grants: ['flying', 'firstStrike', 'lifelink'] });
    expect(parseBackup(fixture('Saiba Cryptomancer').faces[0]?.oracleText ?? '')).toEqual({ n: 1, grants: ['hexproof'] });
    expect(parseBackup(fixture('Gloomfang Mauler').faces[0]?.oracleText ?? '')).toEqual({ n: 2, grants: ['menace'] });
    expect(parseBackup(fixture('Chomping Kavu').faces[0]?.oracleText ?? '')).toBeNull();
    expect(ORACLE.byName('Boon-Bringer Valkyrie')?.faces[0]?.keywords).toContain('backup');
    expect(ORACLE.byName('Chomping Kavu')?.faces[0]?.keywords).not.toContain('backup');
    for (const name of ['Boon-Bringer Valkyrie', 'Saiba Cryptomancer', 'Sigiled Sentinel']) expect(unaccountedLines(fixture(name), 0), name).toEqual([]);
    expect(unaccountedLines(fixture('Chomping Kavu'), 0).map((l) => l.text)).toEqual(['Backup 1', "This creature can't be blocked by creatures with power 2 or less."]);
  });

  test('another creature takes the counter and the keywords until cleanup; the creature itself takes only the counter', () => {
    const g = game(['Boon-Bringer Valkyrie', 'Boon-Bringer Valkyrie', 'Grizzly Bears']);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const first = put(g, 'p1', 'Boon-Bringer Valkyrie');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'chooseTargets') throw new Error(`expected the target prompt, got ${a?.kind ?? 'none'}`);
    expect(a.player).toBe('p1');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(kw(g, bears).has('flying')).toBe(true);
    expect(kw(g, bears).has('firstStrike')).toBe(true);
    expect(kw(g, bears).has('lifelink')).toBe(true);
    expect(g.state.cards[first]?.counters['+1/+1']).toBeUndefined();
    // The second Valkyrie aims at itself: the counter, no grant event.
    const second = put(g, 'p1', 'Boon-Bringer Valkyrie');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const grantsBefore = g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn').length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: second }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect(g.state.cards[second]?.counters['+1/+1']).toBe(1);
    expect(g.log.filter((e) => e.body.t === 'PtModifiedUntilEndOfTurn').length).toBe(grantsBefore);
    // Cleanup ends the grant; the counter stays.
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.turn.step === 'upkeep', 20_000);
    expect(kw(g, bears).has('flying')).toBe(false);
    expect(g.state.cards[bears]?.counters['+1/+1']).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
