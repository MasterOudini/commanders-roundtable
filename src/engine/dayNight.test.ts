// D577 - DAYBOUND / NIGHTBOUND and DAY AND NIGHT (CR 702.145, 726). A daybound permanent on the battlefield while it is
// neither day nor night makes it day (a state-based check); at each untap step, after the phasing and before the untap,
// day turns to night when the previous turn's active player cast no spells and night to day when they cast two or more
// (CR 502.2), and the daybound permanents transform as night comes, the nightbound ones as day comes; a daybound card
// entering at night enters transformed. What is proven here: the readings (each face's keyword, both proof cards
// complete); the whole cycle - Tavern Ruffian cast makes it day, day holds through a turn with a spell, p2's empty turn
// makes it night and the Ruffian turns into Tavern Smasher (6/5), Fearful Villager cast at night enters as Fearsome
// Werewolf, p1's two spells make the next turn day and both turn back; a game with no daybound card stays neither; the
// replay hash.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';

const RUFFIAN = 'Tavern Ruffian // Tavern Smasher';
const VILLAGER = 'Fearful Villager // Fearsome Werewolf';
const LANDS = ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const mainOf = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.awaiting === null && s.stack.length === 0 && s.priority.player === s.turn.activePlayer, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'R' | 'C', amount: 1 })); };
const cardByName = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return c; };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const name = (g: Game, id: string) => derive(g.state, deps().oracle, g.deps.scripts, id).name;
const power = (g: Game, id: string) => derive(g.state, deps().oracle, g.deps.scripts, id).power;

describe('D577 - day and night', () => {
  test('the readings: Daybound on the front face, Nightbound on the back, both proof cards complete', () => {
    for (const n of [RUFFIAN, VILLAGER]) {
      const c = cardByName(n);
      expect(faceOf(c, 0).keywords, n + ' front').toContain('daybound');
      expect(faceOf(c, 0).keywords, n + ' front').not.toContain('nightbound');
      expect(faceOf(c, 1).keywords, n + ' back').toContain('nightbound');
      expect(isEngineComplete(fixture(n)), n).toBe(true);
    }
    expect(faceOf(cardByName(VILLAGER), 1).keywords).toContain('menace');
  });

  test('the cycle: day with the Ruffian, night after an empty turn, the entry at night, day after two spells', () => {
    const g = startedGame({ players: 2, decks: [[RUFFIAN, VILLAGER, 'Lightning Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const ruffian = put(g, 'p1', RUFFIAN, 'hand');
    const villager = put(g, 'p1', VILLAGER, 'exile');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'exile');
    mainOf(g, 3);
    expect(g.state.dayNight, 'neither before a daybound permanent').toBeUndefined();
    mana(g, 'RCCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ruffian }));
    settle(g);
    expect(g.state.cards[ruffian]?.zone.kind).toBe('battlefield');
    expect(g.state.dayNight, 'a daybound permanent makes it day').toBe('day');
    mainOf(g, 4);
    expect(g.state.dayNight, 'p1 cast a spell in turn 3: still day').toBe('day');
    expect(g.state.cards[ruffian]?.faceIndex).toBe(0);
    mainOf(g, 5);
    expect(g.state.dayNight, 'p2 cast nothing in turn 4: night').toBe('night');
    expect(g.state.cards[ruffian]?.faceIndex, 'the Ruffian transformed').toBe(1);
    expect([name(g, ruffian), power(g, ruffian)]).toEqual(['Tavern Smasher', 6]);
    put(g, 'p1', VILLAGER, 'hand');
    put(g, 'p1', 'Lightning Bolt', 'hand');
    mana(g, 'RCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: villager }));
    settle(g);
    expect(g.state.cards[villager]?.faceIndex, 'cast at night, it enters transformed').toBe(1);
    expect(name(g, villager)).toBe('Fearsome Werewolf');
    mana(g, 'R');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.turn.spellsCast.p1, 'two spells this turn').toBe(2);
    mainOf(g, 6);
    expect(g.state.dayNight, 'p1 cast two spells in turn 5: day').toBe('day');
    expect([g.state.cards[ruffian]?.faceIndex, g.state.cards[villager]?.faceIndex], 'both turned back').toEqual([0, 0]);
    expect([name(g, ruffian), name(g, villager)]).toEqual(['Tavern Ruffian', 'Fearful Villager']);
    expect(g.log.filter((e) => e.body.t === 'DayNightChanged').map((e) => (e.body.t === 'DayNightChanged' ? e.body.to : '')), 'day, night, day').toEqual(['day', 'night', 'day']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a game with no daybound card stays neither, and its turns carry no count', () => {
    const g = startedGame({ players: 2, decks: [[...LANDS], [...LANDS]] });
    holdEverywhere(g);
    mainOf(g, 4);
    expect(g.state.dayNight).toBeUndefined();
    expect(g.log.some((e) => e.body.t === 'TurnBegan' && e.body.dayNightCasts !== undefined)).toBe(false);
    expect(g.state.turn.dayNightCasts).toBeUndefined();
  });
});
