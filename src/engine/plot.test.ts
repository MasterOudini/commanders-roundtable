// D551 - PLOT (CR 702.170a): "Plot [cost]" means "Any time you have priority during your main phase while the stack is
// empty, you may exile this card from your hand and pay [cost]. It becomes a plotted card." Its owner may cast it from
// exile without paying its mana cost during their main phase while the stack is empty on any later turn (CR 702.170d).
// Foretell's shape (D540: the special action, the turn mark on the card, the later cast from exile), face up and free
// (D491's free cast). What is proven here: the reading and the cards complete; Djinn of Fool's Fall plotted for {3}{U} -
// exiled face up, the table seeing it, the log naming it, no stack, the player keeping priority - refused the same turn
// and cast free on a later one; the timing (sorcery speed for the action and for the cast); a plotted Aura's targets
// stage charging nothing, and a back-out leaving it plotted on the turn it was; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import { project } from './project';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';
import type { TargetChoice } from './types/state';
import { poolTotal } from './types/mana';

const LANDS = ['Island', 'Island', 'Island', 'Island', 'Mountain', 'Mountain', 'Mountain', 'Mountain'];
const DJINN = "Djinn of Fool's Fall";
const main = (g: Game, turn: number, who: 'p1' | 'p2' = 'p1') => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === who && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const mana = (g: Game, who: 'p1' | 'p2', sym: 'U' | 'R' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: sym, amount: n }));
const pool = (g: Game) => poolTotal(g.state.players['p1']?.pool ?? { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
const view = (g: Game, who: PlayerId) => project(g.state, deps().oracle, g.deps.scripts, who);
const offers = (g: Game, t: 'Plot' | 'CastSpell', card: InstanceId) => legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').some((a) => a.t === t && a.card === card);
const P2: TargetChoice = { kind: 'player', id: 'p2' };

describe('D551 - plot', () => {
  test('the reading: the plot cost off the keyword line, the cards complete', () => {
    expect(faceNamed(DJINN).plotCost?.raw).toBe('{3}{U}');
    expect(faceNamed('Visage Bandit').plotCost?.raw).toBe('{2}{U}');
    expect(faceNamed('Demonic Ruckus').plotCost?.raw).toBe('{R}');
    expect(faceNamed('Grizzly Bears').plotCost).toBeNull();
    for (const name of [DJINN, 'Visage Bandit']) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('plotted for {3}{U}: face up, the table sees it, no stack - and cast free on a later turn', () => {
    const g = startedGame({ players: 2, decks: [[DJINN, ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const djinn = put(g, 'p1', DJINN, 'hand');
    main(g, 3);
    expect(offers(g, 'Plot', djinn), 'offered in its owner main phase').toBe(true);
    mana(g, 'p1', 'U', 1);
    mana(g, 'p1', 'C', 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'Plot', player: 'p1', card: djinn }));
    expect(g.state.cards[djinn]?.zone.kind).toBe('exile');
    expect(g.state.cards[djinn]?.faceDown ?? false, 'face up').toBe(false);
    expect(g.state.cards[djinn]?.plottedTurn).toBe(3);
    expect(pool(g), 'the plot cost paid').toBe(0);
    expect(g.state.stack, 'a special action: no stack').toHaveLength(0);
    expect(g.state.priority.player, 'the player keeps priority').toBe('p1');
    expect(view(g, 'p2').cards[djinn]?.card?.name, 'the table sees it').toBe(DJINN);
    const told = g.log.slice(n0).filter((e) => e.body.t === 'Narrated').map((e) => (e.body.t === 'Narrated' ? e.body.text : ''));
    expect(told.some((t) => t.includes('plots ' + DJINN)), 'the log names it').toBe(true);
    expect(offers(g, 'CastSpell', djinn), 'not the turn it was plotted').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: djinn }).ok).toBe(false);
    main(g, 5);
    expect(pool(g)).toBe(0);
    expect(offers(g, 'CastSpell', djinn), 'a later turn').toBe(true);
    const n1 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: djinn }));
    settle(g);
    const cast = g.log.slice(n1).find((e) => e.body.t === 'SpellCast');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.castFrom?.kind : null, 'cast from exile').toBe('exile');
    expect(cast?.body.t === 'SpellCast' ? cast.body.obj.freeCast : null, 'without paying its mana cost').toBe(true);
    expect(g.state.cards[djinn]?.zone.kind, 'cast with an empty pool').toBe('battlefield');
    expect(g.state.cards[djinn]?.plottedTurn).toBeUndefined();
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the timing: plotted and cast at sorcery speed only - not on the opponent turn, not over a spell on the stack', () => {
    const g = startedGame({ players: 2, decks: [[DJINN, 'Visage Bandit', 'Lightning Bolt', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const djinn = put(g, 'p1', DJINN, 'hand');
    const bandit = put(g, 'p1', 'Visage Bandit', 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    main(g, 3);
    mana(g, 'p1', 'U', 4);
    must(g.submit({ t: 'Plot', player: 'p1', card: djinn }));
    main(g, 4, 'p2');
    must(g.submit({ t: 'PassPriority', player: 'p2' }));
    expect(g.state.priority.player).toBe('p1');
    mana(g, 'p1', 'U', 3);
    expect(offers(g, 'Plot', bandit), 'no plot on the opponent turn').toBe(false);
    expect(g.submit({ t: 'Plot', player: 'p1', card: bandit }).ok).toBe(false);
    expect(offers(g, 'CastSpell', djinn), 'no plotted cast on the opponent turn').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: djinn }).ok).toBe(false);
    main(g, 5);
    mana(g, 'p1', 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [P2] }));
    expect(g.state.stack).toHaveLength(1);
    expect(g.state.priority.player).toBe('p1');
    mana(g, 'p1', 'U', 3);
    expect(offers(g, 'Plot', bandit), 'no plot over a spell on the stack').toBe(false);
    expect(g.submit({ t: 'Plot', player: 'p1', card: bandit }).ok).toBe(false);
    expect(offers(g, 'CastSpell', djinn), 'no plotted cast over a spell on the stack').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: djinn }).ok).toBe(false);
    settle(g);
    must(g.submit({ t: 'Plot', player: 'p1', card: bandit }));
    expect(g.state.cards[bandit]?.plottedTurn).toBe(5);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: djinn }));
    settle(g);
    expect(g.state.cards[djinn]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("a plotted Aura's targets stage charges nothing; backed out of, it stays plotted on the turn it was", () => {
    const g = startedGame({ players: 2, decks: [['Demonic Ruckus', 'Grizzly Bears', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const ruckus = put(g, 'p1', 'Demonic Ruckus', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears');
    main(g, 3);
    mana(g, 'p1', 'R', 1);
    must(g.submit({ t: 'Plot', player: 'p1', card: ruckus }));
    expect(g.state.cards[ruckus]?.plottedTurn).toBe(3);
    main(g, 5);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ruckus }));
    expect(g.state.pendingCast?.stage).toBe('targets');
    expect(g.state.cards[ruckus]?.zone.kind).toBe('stack');
    must(g.submit({ t: 'CancelPendingCast', player: 'p1' }));
    expect(g.state.cards[ruckus]?.zone.kind).toBe('exile');
    expect(g.state.cards[ruckus]?.plottedTurn, 'the turn it was plotted').toBe(3);
    expect(offers(g, 'CastSpell', ruckus), 'still castable').toBe(true);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: ruckus }));
    expect(g.state.pendingCast?.stage).toBe('targets');
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    expect(g.state.pendingCast, 'nothing left to pay').toBeNull();
    expect(pool(g)).toBe(0);
    settle(g);
    expect(g.state.cards[ruckus]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[ruckus]?.attachedTo).toBe(bears);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
