// D444 - UNLEASH (CR 702.98) AND RIOT (CR 702.132): a creature entering with either keyword asks its controller through
// D136's entry prompt - a +1/+1 counter, or nothing (unleash: it can't block while it has a counter) / haste (riot: the
// object keeps it while it stays). Neither branch taps; a new object chooses again.

import { describe, expect, test } from 'vitest';
import { canBlock } from './combat';
import { derive, makeDeriveCache } from './derive';
import { replay, stateHash } from './log';
import { NO_SCRIPTS } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import type { Game } from './game';

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
function game(p1: readonly string[], p2: readonly string[] = []): Game {
  const g = startedGame({ players: 2, decks: [[...p1, ...FORESTS], [...p2, ...FORESTS]], options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
function asked(g: Game, option: 'unleash' | 'riot') {
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'entersChoice') throw new Error(`expected the entry choice, got ${a?.kind ?? 'none'}`);
  expect(a.option).toBe(option);
  expect(a.life).toBe(0);
  return a;
}
const kw = (g: Game, id: string) => derive(g.state, ORACLE, NO_SCRIPTS, id, makeDeriveCache(g.state)).keywords;

describe('unleash and riot (D444)', () => {
  test('the keywords are read, the keyword-only cards are accounted', () => {
    expect(ORACLE.byName('Gore-House Chainwalker')?.faces[0]?.keywords).toContain('unleash');
    expect(ORACLE.byName('Zhur-Taa Goblin')?.faces[0]?.keywords).toContain('riot');
    for (const name of ['Gore-House Chainwalker', 'Zhur-Taa Goblin', 'Rakdos Cackler', 'Rampaging Rendhorn']) {
      const card = ENGINE_CARDS.find((c) => c.name === name);
      if (!card) throw new Error(`no fixture ${name}`);
      expect(unaccountedLines(card, 0), name).toEqual([]);
    }
  });

  test('unleash: the counter taken keeps it from blocking; declined, it blocks and carries none', () => {
    const g = game(['Gore-House Chainwalker', 'Gore-House Chainwalker'], ['Grizzly Bears']);
    const bears = put(g, 'p2', 'Grizzly Bears');
    const first = put(g, 'p1', 'Gore-House Chainwalker');
    const a = asked(g, 'unleash');
    expect(a.source).toBe(first);
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: first, pay: true }));
    expect(g.state.cards[first]?.counters['+1/+1']).toBe(1);
    expect(g.state.cards[first]?.tapped).toBe(false);
    const second = put(g, 'p1', 'Gore-House Chainwalker');
    asked(g, 'unleash');
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: second, pay: false }));
    expect(g.state.cards[second]?.counters['+1/+1']).toBeUndefined();
    expect(g.state.cards[second]?.tapped).toBe(false);
    // p2's Bears attacks on turn 2: the unleashed one cannot block, the plain one can.
    advanceUntil(g, (s) => s.turn.turnNumber === 2 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p2', attackers: [{ card: bears, defender: { kind: 'player', id: 'p1' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    const deps = { state: g.state, oracle: ORACLE, scripts: NO_SCRIPTS, cache: makeDeriveCache(g.state) };
    expect(canBlock(deps, first, bears)).toBe('unleashed');
    expect(canBlock(deps, second, bears)).toBeNull();
    expect(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: first, attacker: bears }] }).ok).toBe(false);
    must(g.submit({ t: 'DeclareBlockers', player: 'p1', blocks: [{ blocker: second, attacker: bears }] }));
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('riot: haste chosen lets it attack the turn it entered and stays until it leaves; the counter is the other half', () => {
    const g = game(['Zhur-Taa Goblin', 'Zhur-Taa Goblin']);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    const hasty = put(g, 'p1', 'Zhur-Taa Goblin');
    asked(g, 'riot');
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: hasty, pay: false }));
    expect(g.state.cards[hasty]?.riotHaste).toBe(true);
    expect(kw(g, hasty).has('haste')).toBe(true);
    expect(g.state.cards[hasty]?.counters['+1/+1']).toBeUndefined();
    const big = put(g, 'p1', 'Zhur-Taa Goblin');
    asked(g, 'riot');
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: big, pay: true }));
    expect(g.state.cards[big]?.counters['+1/+1']).toBe(1);
    expect(kw(g, big).has('haste')).toBe(false);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    const a = g.state.priority.awaiting;
    if (a?.kind !== 'declareAttackers') throw new Error('no attackers prompt');
    expect(a.attackers).toContain(hasty);
    expect(a.attackers).not.toContain(big);
    // A new object chooses again: bounced and replayed, the flag is gone and the question returns.
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: hasty, to: { kind: 'hand', player: 'p1' } }));
    expect(g.state.cards[hasty]?.riotHaste).toBeUndefined();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: hasty, to: { kind: 'battlefield', player: 'p1' } }));
    asked(g, 'riot');
    must(g.submit({ t: 'AnswerEntersChoice', player: 'p1', source: hasty, pay: true }));
    expect(kw(g, hasty).has('haste')).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
