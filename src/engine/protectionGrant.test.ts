// D633 - THE PROTECTION GRANT UNTIL END OF TURN. `<target> gains protection from <colour> until end of turn.` (and the self and
// the scoped forms, `artifacts`, `the chosen color`) rides the pump's until-end-of-turn entry (`protection`), merged by `derive`
// at layer 6 beside the gained keywords and gone at cleanup with the rest. `the color of your choice` is read as `Choose a
// color.` before the text: the clause `nameColor` raises D147's colour prompt as the object resolves, the clauses after it ride
// it, and the answer substitutes the colour. What is proven: the parse (the choice and the pump over the sentinel, the fixed
// colours, `artifacts`, the scoped form, a chosen colour with no choice before it unread); Stave Off (the prompt as it resolves,
// the colour named on the creature, gone at cleanup); Akroma's Blessing (every creature you control, none of the opponent's); the
// cards complete; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { faceOf } from './oracle';
import { derive } from './derive';
import { parseEffects } from '../data/effectParse';
import { engineCompleteness } from '../data/engineComplete';
import { CHOSEN_COLOR } from './types/oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SPELLS = ['Stave Off', "Akroma's Blessing", 'Emerge Unscathed', 'Gods Willing', 'Center Soul', 'Shelter', 'Reverent Mantra', 'Tel-Jilad Defiance', 'Blessed Breath', 'Feat of Resistance', 'Redeem the Lost', 'Sejiri Shelter // Sejiri Glacier'];
const FILLER = Array.from({ length: 14 }, () => 'Plains');

const card = (name: string) => {
  const c = deps().oracle.byName(name);
  if (!c) throw new Error('no such fixture: ' + name);
  return c;
};
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const untilColour = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseColor', 20_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const prot = (g: Game, id: InstanceId) => [...derive(g.state, g.deps.oracle, g.deps.scripts, id).protection.colors].sort();

/** The spell in hand, the creatures on the battlefield, p1's precombat main of turn 3. */
function table(spell: string, mine: readonly string[], theirs: readonly string[]): { g: Game; cast: InstanceId; p1: InstanceId[]; p2: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[spell, ...mine, ...FILLER], [...theirs, ...FILLER]], options: { maxHandSize: null } });
  holdEverywhere(g);
  const cast = put(g, 'p1', spell, 'hand');
  const p1 = mine.map((n) => put(g, 'p1', n));
  const p2 = theirs.map((n) => put(g, 'p2', n));
  main(g, 3);
  return { g, cast, p1, p2 };
}

describe('D633 - the parse', () => {
  test('the colour of your choice: the choice an ask, the pump over the sentinel', () => {
    for (const name of SPELLS) expect(faceOf(card(name), 0).effectMode, name).toBe('auto');
    const stave = faceOf(card('Stave Off'), 0);
    expect(stave.effects.map((e) => e.kind)).toEqual(['nameColor', 'pump']);
    expect(stave.effects[1]?.protectionFrom).toEqual({ colors: [CHOSEN_COLOR] });
    const blessing = faceOf(card("Akroma's Blessing"), 0);
    expect(blessing.effects.map((e) => e.kind)).toEqual(['nameColor', 'massPump']);
    expect(blessing.effects[1]?.scopes).toEqual([{ kind: 'creature', controller: 'you' }]);
  });

  test('the fixed colours, artifacts, the self form; a chosen colour with no choice before it stays unread', () => {
    const red = parseEffects('Target creature gains protection from red until end of turn.', 'X', true);
    expect([red.mode, red.effects[0]?.protectionFrom]).toEqual(['auto', { colors: ['R'] }]);
    const two = parseEffects('This creature gains protection from black and from red until end of turn.', 'X', true);
    expect([two.mode, two.effects[0]?.self, two.effects[0]?.protectionFrom]).toEqual(['auto', true, { colors: ['B', 'R'] }]);
    const art = parseEffects('Target creature gains protection from artifacts until end of turn.', 'X', true);
    expect(art.effects[0]?.protectionFrom).toEqual({ colors: [], types: ['Artifact'] });
    expect(parseEffects('Target creature gains protection from the chosen color until end of turn.', 'X', true).mode).toBe('manual');
    expect(parseEffects('You gain protection from the color of your choice until end of turn.', 'X', true).mode).not.toBe('auto');
  });

  test('the cards complete', () => {
    for (const name of SPELLS) expect(engineCompleteness(card(name).data), name).toEqual({ complete: true, leftover: [] });
  });
});

describe('D633 - the grant', () => {
  test('Stave Off: the colour asked as it resolves, protection on the creature, gone at cleanup', () => {
    const { g, cast, p1 } = table('Stave Off', ['Grizzly Bears'], ['Grizzly Bears']);
    const bears = p1[0] as InstanceId;
    mana(g, 'W');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cast, targets: [{ kind: 'card', id: bears }] }));
    untilColour(g);
    const awaiting = g.state.priority.awaiting;
    if (awaiting?.kind !== 'chooseColor') throw new Error('no prompt');
    expect([awaiting.player, awaiting.resolving, awaiting.continuation?.effects.length]).toEqual(['p1', true, 1]);
    expect(prot(g, bears), 'nothing before the answer').toEqual([]);
    must(g.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'R' }));
    settle(g);
    expect(prot(g, bears)).toEqual(['R']);
    expect(g.state.cards[cast]?.chosenColor ?? null, 'nothing remembers the answer').toBeNull();
    advanceUntil(g, (s) => s.turn.turnNumber === 4, 40_000);
    expect(prot(g, bears), 'cleanup ended it').toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("Akroma's Blessing: every creature you control, none of the opponent's", () => {
    const { g, cast, p1, p2 } = table("Akroma's Blessing", ['Grizzly Bears', 'Air Elemental'], ['Grizzly Bears']);
    mana(g, 'WCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: cast }));
    untilColour(g);
    must(g.submit({ t: 'AnswerChooseColor', player: 'p1', color: 'B' }));
    settle(g);
    expect([...p1, ...p2].map((id) => prot(g, id))).toEqual([['B'], ['B'], []]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
