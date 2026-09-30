// Copy to src/engine/. D587 - BACKING OUT OF A GRANTED CAST, and the answer's honest check (FIX-LIST 9 - the review's
// freecast FC-1). A spell cast off cascade, discover, rebound or a from-hand grant is begun by the prompt's ANSWER and stops
// for its targets like any staged cast; the ward its targets meet rides the problem there (CR 601.2c then 601.2f, D68).
// Two rules proven here: the answer's check prices the elections beside the ward of the cheapest aim the targets stage
// could take, so a kick only a warded target would strand is refused where the prompt can be answered again; and backing
// out at the targets stage returns the game to the moment before the cast began (CR 601.2) - the card back where the grant
// found it with its play permission, the very prompt up again, answered anew (plain, or nothing - the cascade card then to
// the bottom of the library, never stranded in exile). Bloodbraid Elf cascades into Into the Roil (`Kicker {1}{U}`,
// `Return target nonland permanent to its owner's hand`); Toadstool Admirer is the opponent's `Ward {2}`; Memnite is a
// nonland permanent of the caster's own, which no ward guards; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { poolTotal } from './types/mana';
import type { Game } from './game';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';
import type { TargetChoice } from './types/state';

const FORESTS = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const onTop = (g: Game, card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null && s.pendingCast === null, 20_000);
const grant = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.castFree === true, 20_000);
const granted = (g: Game) => { const a = g.state.priority.awaiting; return a?.kind === 'chooseFromZone' && a.castFree === true; };
const pool = (g: Game) => poolTotal(g.state.players.p1?.pool ?? { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const castOf = (g: Game, card: InstanceId, from = 0) => g.log.slice(from).map((e) => e.body).find((b): b is Extract<EventBody, { t: 'SpellCast' }> => b.t === 'SpellCast' && b.obj.card === card);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const card = (id: InstanceId): TargetChoice => ({ kind: 'card', id });

/**
 * Bloodbraid Elf cast for exactly its {2}{R}{G} with `candidate` under a Forest on top of the library, `mine` and `theirs`
 * on the battlefield: cascade's chooser is up, offering the candidate for free, and nothing floats.
 */
function cascaded(candidate: string, mine: readonly string[] = [], theirs: readonly string[] = []) {
  const g = startedGame({ players: 2, decks: [['Bloodbraid Elf', candidate, 'Forest', ...mine, ...FORESTS], ['Grizzly Bears', ...theirs, ...FORESTS]], options: { maxHandSize: null } });
  holdEverywhere(g);
  const elf = put(g, 'p1', 'Bloodbraid Elf', 'hand');
  const pick = put(g, 'p1', candidate, 'hand');
  const forest = put(g, 'p1', 'Forest', 'hand');
  const ours = mine.map((name) => put(g, 'p1', name));
  const foes = theirs.map((name) => put(g, 'p2', name));
  main(g, 3);
  onTop(g, pick);
  onTop(g, forest);
  mana(g, 'RRGG');
  must(g.submit({ t: 'CastSpell', player: 'p1', card: elf }));
  grant(g);
  const aw = g.state.priority.awaiting;
  expect(aw?.kind === 'chooseFromZone' ? aw.pool : null, 'cascade offers the candidate').toEqual([pick]);
  expect(pool(g), 'the Elf took all four').toBe(0);
  return { g, pick, ours, foes };
}

describe('D587 - a granted cast is checked against the ward it would meet, and backs out to its prompt - CR 601.2', () => {
  test("a kick only a warded target would strand is refused at the answer; the plain cast then pays the Admirer's ward", () => {
    const { g, pick: roil, foes } = cascaded('Into the Roil', [], ['Toadstool Admirer']);
    const [admirer] = foes as [InstanceId];
    mana(g, 'UCC');
    // The Admirer is the only nonland permanent: the kick {1}{U} and its ward {2} are four, and three float.
    const kicked = g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [roil], cast: { kicked: 1 } });
    expect(kicked.ok, 'refused at the answer, not stranded at the targets stage').toBe(false);
    if (!kicked.ok) expect(kicked.message).toMatch(/ward/);
    expect(granted(g), 'the chooser is still up, to be answered again').toBe(true);
    expect(zoneOf(g, roil), 'the candidate waits in exile').toBe('exile');
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [roil] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(admirer)] }));
    settle(g);
    expect(castOf(g, roil, n0)?.obj.freeCast, 'cast without paying its mana cost').toBe(true);
    expect(castOf(g, roil, n0)?.obj.kicked, 'and unkicked').toBeUndefined();
    expect(zoneOf(g, admirer), "bounced to its owner's hand").toBe('hand');
    expect(pool(g), 'the ward {2} paid of the three').toBe(1);
    hashHolds(g);
  });

  test('backing out at the targets stage returns the card to exile with its permission and asks the very prompt again; the plain cast follows', () => {
    const { g, pick: roil, ours, foes } = cascaded('Into the Roil', ['Memnite'], ['Toadstool Admirer']);
    const [memnite] = ours as [InstanceId];
    const [admirer] = foes as [InstanceId];
    mana(g, 'UCC');
    const prompt = g.state.priority.awaiting;
    // The cheapest aim - my own Memnite, which no ward guards - leaves the kick payable: the answer is taken.
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [roil], cast: { kicked: 1 } }));
    expect(g.state.pendingCast, 'the kicked cast stops for its target').toMatchObject({ card: roil, stage: 'targets', free: true, kicked: 1 });
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(admirer)] }).ok, "the kick and the Admirer's ward are four; three float").toBe(false);
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(g.state.pendingCast).toBeNull();
    expect(g.state.priority.awaiting, 'the prompt the cast answered, up again').toEqual(prompt);
    expect(zoneOf(g, roil), 'back where cascade left it').toBe('exile');
    expect(g.state.playPermissions.some((p) => p.card === roil && p.player === 'p1'), 'with the permission it held there').toBe(true);
    expect(pool(g), 'nothing was paid').toBe(3);
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [roil] }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [card(admirer)] }));
    settle(g);
    expect(castOf(g, roil, n0)?.obj.freeCast, 'cast again, free').toBe(true);
    expect(castOf(g, roil, n0)?.obj.kicked, 'and unkicked').toBeUndefined();
    expect([zoneOf(g, admirer), zoneOf(g, memnite)], 'the Admirer bounced, the Memnite untouched').toEqual(['hand', 'battlefield']);
    expect(pool(g), 'the ward {2} paid').toBe(1);
    hashHolds(g);
  });

  test('backed out of, the cascade card is declined from its prompt: to the bottom of the library, never stranded in exile', () => {
    const { g, pick: roil } = cascaded('Into the Roil', [], ['Toadstool Admirer']);
    mana(g, 'CC');
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [roil] }));
    expect(g.state.priority.awaiting?.kind, 'the cast asks for its target').toBe('chooseTargets');
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(granted(g), 'the prompt again').toBe(true);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    expect(zoneOf(g, roil), "cascade's decline").toBe('library');
    expect(g.state.zones.library.p1?.[0], 'on the bottom').toBe(roil);
    expect(g.state.playPermissions.some((p) => p.card === roil), 'its permission gone').toBe(false);
    settle(g);
    hashHolds(g);
  });
});
