// D625 - THE PREPARED SPELL. The prepare reminder: "While it's prepared, you may cast a copy of its spell. Doing so
// unprepares it." / "Only creatures with prepare spells can become prepared." What is proven: a permanent that enters
// prepared is prepared (the entry built-in) and offers its spell's copy from the battlefield; the cast makes a COPY OF
// THE CARD on the stack (CR 707.12), unprepares the permanent and leaves it where it is; the copy resolves and ceases to
// exist (CR 704.5e); a back-out leaves the permanent prepared and the copy gone; the spell's own speed (an instant's copy
// with a spell on the stack, a sorcery's not); `becomes prepared` prepares only a creature with a prepare spell; a
// prepared permanent that leaves is a new object, unprepared; the parser's reads; the replay hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { legalActions } from './legal';
import { derive } from './derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { isEngineComplete } from '../data/engineComplete';
import type { CardScript } from './scripts/api';
import type { CardData } from '../data/cardTypes';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SEEKER = 'Spellbook Seeker // Careful Study';
const PAGE = "Honorbound Page // Forum's Favor";
const AVIATOR = 'Encouraging Aviator // Jump';
const STUDENT = 'Studious First-Year // Rampant Growth';
const WAYPOINT = 'Skycoach Waypoint';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const offers = (g: Game, id: InstanceId) => legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').filter((a) => a.t === 'CastSpell' && a.card === id);
const dataOf = (name: string): CardData => {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  return card.data as CardData;
};

/** Skycoach Waypoint's `{3}, {T}: Target creature becomes prepared.` through the vocabulary, as a generated row would run it (its second
 * activated ability - the mana ability is the first, `#a0`). */
function waypointScript(): CardScript {
  const card = dataOf(WAYPOINT);
  const text = 'Target creature becomes prepared.';
  const effects = vocabularyEffects(text, card.name);
  const targets = vocabularyTargets(text);
  const line = (card.faces[0]?.oracleText ?? '').split('\n')[1] as string;
  return { oracleId: card.oracleId, name: card.name, activated: [{ ref: `${card.oracleId}#a1`, text: line, resolve: (ctx, _self, obj) => ctx.vocabulary(obj, effects, targets) }] };
}

function table(scripts: readonly CardScript[] = []): Game {
  const g = startedGame({ players: 2, decks: [[SEEKER, PAGE, AVIATOR, STUDENT, WAYPOINT, 'Grizzly Bears', 'Lightning Bolt'], ['Grizzly Bears']], scripts: createRegistry(scripts) });
  holdEverywhere(g);
  main(g, 3);
  return g;
}

describe('D625 - the prepared spell', () => {
  test('enters prepared; its spell offered from the battlefield; the cast makes a copy of the card and unprepares it; the copy ceases; the replay hash', () => {
    const g = table();
    const seeker = put(g, 'p1', SEEKER);
    settle(g);
    expect(g.state.cards[seeker]?.prepared).toBe(true);
    const offer = offers(g, seeker);
    expect(offer.map((a) => (a.t === 'CastSpell' ? [a.faceIndex, a.from.kind, a.label] : null))).toEqual([[1, 'battlefield', 'Careful Study']]);
    mana(g, 'U');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: seeker, faceIndex: 1, targets: [] }));
    const top = g.state.stack[g.state.stack.length - 1];
    expect(top?.preparedFrom).toBe(seeker);
    expect(top?.label).toBe('Careful Study (copy)');
    expect(top?.castFrom).toBeNull();
    const copy = top?.card as InstanceId;
    expect(copy).not.toBe(seeker);
    expect(g.state.cards[copy]?.copyCard).toBe(true);
    expect(g.state.cards[copy]?.faceIndex).toBe(1);
    expect(g.state.cards[seeker]?.prepared).toBeUndefined();
    expect(g.state.cards[seeker]?.zone.kind).toBe('battlefield');
    expect(offers(g, seeker), 'unprepared: no copy offered').toEqual([]);
    settle(g);
    expect(g.state.cards[copy], 'the copy ceased (CR 704.5e)').toBeUndefined();
    expect(g.state.zones.graveyard['p1'] ?? []).not.toContain(copy);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a targeted copy: the back-out leaves the permanent prepared and the copy gone; then cast at itself', () => {
    const g = table();
    const page = put(g, 'p1', PAGE);
    settle(g);
    expect(g.state.cards[page]?.prepared).toBe(true);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: page, faceIndex: 1 }));
    const copy = g.state.pendingCast?.card as InstanceId;
    expect(g.state.cards[copy]?.copyCard).toBe(true);
    expect(g.state.cards[page]?.prepared, 'prepared until the cast is done').toBe(true);
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(g.state.pendingCast).toBeNull();
    expect(g.state.cards[copy], 'the copy backed out of ceased').toBeUndefined();
    expect(g.state.cards[page]?.prepared).toBe(true);
    expect(offers(g, page).length).toBe(1);
    const before = derive(g.state, g.deps.oracle, g.deps.scripts, page);
    mana(g, 'W');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: page, faceIndex: 1, targets: [{ kind: 'card', id: page }] }));
    settle(g);
    const after = derive(g.state, g.deps.oracle, g.deps.scripts, page);
    expect(after.power).toBe((before.power ?? 0) + 1);
    expect(after.keywords.has('flying')).toBe(true);
    expect(g.state.cards[page]?.prepared).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the spell is cast at its own speed: an instant copy with a spell on the stack, a sorcery copy not', () => {
    const g = table([waypointScript()]);
    const seeker = put(g, 'p1', SEEKER);
    const aviator = put(g, 'p1', AVIATOR);
    settle(g);
    // the Aviator prepared by the Waypoint (it does not enter prepared)
    expect(g.state.cards[aviator]?.prepared).toBeUndefined();
    const waypoint = put(g, 'p1', WAYPOINT);
    settle(g);
    mana(g, 'CCC');
    const act = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === waypoint);
    expect(act?.t).toBe('ActivateAbility');
    if (act?.t !== 'ActivateAbility') return;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: waypoint, abilityIndex: act.abilityIndex, targets: [{ kind: 'card', id: aviator }] }));
    settle(g);
    expect(g.state.cards[aviator]?.prepared).toBe(true);
    // a spell on the stack: p1 keeps priority after casting a Bolt at p2
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    mana(g, 'R');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    expect(g.state.stack.length).toBe(1);
    expect(offers(g, aviator).map((a) => (a.t === 'CastSpell' ? a.label : null)), 'Jump is an instant').toEqual(['Jump']);
    expect(offers(g, seeker), 'Careful Study is a sorcery').toEqual([]);
    mana(g, 'U');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: aviator, faceIndex: 1, targets: [{ kind: 'card', id: aviator }] }));
    expect(g.state.stack.length).toBe(2);
    settle(g);
    expect(g.state.cards[aviator]?.prepared).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('becomes prepared prepares only a creature with a prepare spell', () => {
    const g = table([waypointScript()]);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const waypoint = put(g, 'p1', WAYPOINT);
    settle(g);
    mana(g, 'CCC');
    const act = legalActions(g.state, g.deps.oracle, g.deps.scripts, 'p1').find((a) => a.t === 'ActivateAbility' && a.card === waypoint);
    if (act?.t !== 'ActivateAbility') throw new Error('no Waypoint activation');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: waypoint, abilityIndex: act.abilityIndex, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[bears]?.prepared).toBeUndefined();
  });

  test('a prepared permanent that leaves is a new object: unprepared, and only an enters-prepared card is prepared again', () => {
    const g = table();
    const student = put(g, 'p1', STUDENT);
    settle(g);
    expect(g.state.cards[student]?.prepared).toBe(true);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: student, to: { kind: 'hand', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[student]?.prepared).toBeUndefined();
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: student, to: { kind: 'battlefield', player: 'p1' } }));
    settle(g);
    expect(g.state.cards[student]?.prepared, 'it enters prepared again').toBe(true);
  });

  test('the reads: enters prepared, becomes (un)prepared; the enters-prepared cards run completely', () => {
    expect(ORACLE.byName(SEEKER)?.faces[0]?.entersPrepared).toBe(true);
    expect(ORACLE.byName(AVIATOR)?.faces[0]?.entersPrepared).toBe(false);
    expect(vocabularyEffects('Target creature becomes prepared.', 'X').map((e) => e.kind)).toEqual(['prepare']);
    expect(vocabularyEffects('Target creature becomes unprepared.', 'X').map((e) => [e.kind, e.unprepare])).toEqual([['prepare', true]]);
    expect(vocabularyEffects('This creature becomes prepared.', 'X').map((e) => [e.kind, e.self])).toEqual([['prepare', true]]);
    expect(vocabularyEffects('It becomes prepared.', 'X').map((e) => [e.kind, e.self])).toEqual([['prepare', true]]);
    for (const name of [SEEKER, PAGE, STUDENT]) expect(isEngineComplete(dataOf(name)), name).toBe(true);
  });
});
