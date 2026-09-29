// THE SBA GUARD (CR 704.3) - the drain guard's other half (D584): state-based actions are checked only when a player
// would receive priority - never while a question is up, and so never in the middle of a resolution. `advance()` ran
// its SBA pass BEFORE its awaiting check, so an SBA landed under a live prompt: Grim Affliction's -1/-1 counter killed
// the Kami of Empty Graves while the spell's own proliferate was still asked (the Kami could not be proliferated onto,
// and its soulshift triggered mid-resolution); a commander the counter killed raised its command-zone question OVER
// the proliferate, which was lost; an SBA pass under the command-zone question re-raised the legend rule over it, and
// the commander stayed in the graveyard; two legend groups at once re-raised each other until pump's 10,000-iteration
// throw. The SBAs now wait for the answer - the questions the SBAs raise themselves included. Each test here failed
// before the guard.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { createRegistry } from './scripts/registryCore';
import { NIGHT_OF_SOULS_BETRAYAL_SCRIPT } from './scripts/cards/nightOfSoulsBetrayal';
import { replay, stateHash } from './log';
import type { Game } from './game';

const KAMI = 'Kami of Empty Graves';
const URCHIN = 'Bile Urchin';
const BETRAYAL = "Night of Souls' Betrayal";
const main1 = (g: Game) => advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
const firstPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting !== null, 20_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const sbaSince = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'StateBasedActionsApplied');

// p1 casts Grim Affliction at `victim` with the mana added by hand; returns the log index the cast began at.
function afflict(g: Game, victim: string): number {
  const affliction = put(g, 'p1', 'Grim Affliction', 'hand');
  main1(g);
  holdEverywhere(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  const from = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: affliction, targets: [{ kind: 'card', id: victim }] }));
  firstPrompt(g);
  return from;
}

describe('the SBA guard: no state-based action is performed under a live prompt', () => {
  test('the Kami the counter made 0/0 stays through the proliferate - a legal pick - then dies, and its soulshift is asked', () => {
    const g = startedGame({ players: 2, decks: [['Grim Affliction'], [KAMI, URCHIN]] });
    const kami = put(g, 'p2', KAMI);
    const urchin = put(g, 'p2', URCHIN, 'graveyard');
    const from = afflict(g, kami);
    expect(g.state.priority.awaiting?.kind, "the spell's own question").toBe('proliferateChoice');
    expect(g.state.cards[kami]?.zone.kind, 'the 0-toughness Kami waits on the battlefield').toBe('battlefield');
    expect(g.state.cards[kami]?.counters['-1/-1']).toBe(1);
    expect(sbaSince(g, from), 'no SBA mid-resolution').toHaveLength(0);
    expect(g.state.pendingTriggers, 'nothing has died').toHaveLength(0);
    // Refused before the guard: the Kami was already in the graveyard ("That permanent has no counter on it").
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [kami], players: [] }));
    const proliferated = g.log.findIndex((e, i) => i >= from && e.body.t === 'Proliferated');
    const died = g.log.findIndex((e, i) => i >= from && e.body.t === 'StateBasedActionsApplied');
    expect(proliferated).toBeGreaterThan(-1);
    expect(died, 'the SBA comes after the answer').toBeGreaterThan(proliferated);
    expect(g.state.cards[kami]?.zone.kind).toBe('graveyard');
    firstPrompt(g);
    const aim = g.state.priority.awaiting;
    expect(aim?.kind === 'chooseTargets' && aim.player, "then the dead Kami's soulshift is aimed").toBe('p2');
    must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id: urchin }] }));
    firstPrompt(g);
    const may = g.state.priority.awaiting;
    if (may?.kind !== 'optionalTrigger') throw new Error("expected the soulshift's may, got " + may?.kind);
    must(g.submit({ t: 'AnswerOptionalTrigger', player: may.player, stackId: may.stackId, accept: true }));
    settle(g);
    expect(g.state.cards[urchin]?.zone.kind).toBe('hand');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a commander the counter killed asks its command-zone question after the proliferate, never over it', () => {
    const g = startedGame({ players: 2, decks: [['Grim Affliction'], []] });
    const krenko = put(g, 'p2', 'Krenko, Mob Boss');
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: krenko, kind: '-1/-1', delta: 2 }));
    const from = afflict(g, krenko);
    expect(g.state.priority.awaiting?.kind, 'the proliferate is not replaced').toBe('proliferateChoice');
    expect(g.state.cards[krenko]?.zone.kind).toBe('battlefield');
    expect(sbaSince(g, from)).toHaveLength(0);
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [], players: [] }));
    expect(g.log.slice(from).some((e) => e.body.t === 'Proliferated'), 'the proliferate was answered').toBe(true);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'commanderZoneChoice' && ask.player, "then the commander's question").toBe('p2');
    expect(g.state.cards[krenko]?.zone.kind).toBe('graveyard');
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: true, always: false }));
    expect(g.state.cards[krenko]?.zone.kind).toBe('command');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("one pass raises the legend rule and a commander's question: each is asked in turn, neither lost", () => {
    const g = startedGame({
      players: 2,
      decks: [[BETRAYAL, BETRAYAL], []],
      commanders: [['Kess, Dissident Mage'], ['Talrand, Sky Summoner']],
      scripts: createRegistry([NIGHT_OF_SOULS_BETRAYAL_SCRIPT]),
    });
    const talrand = put(g, 'p2', 'Talrand, Sky Summoner');
    const first = put(g, 'p1', BETRAYAL);
    expect(g.state.cards[talrand]?.zone.kind, 'a 1/1 under one Betrayal').toBe('battlefield');
    // The second Betrayal: in ONE pass Talrand dies (0/0 - a commander, so the funnel asks p2) and the legend rule
    // asks p1. Before the guard the next pass re-raised the legend rule over the commander question.
    const second = put(g, 'p1', BETRAYAL);
    expect(g.state.cards[talrand]?.zone.kind).toBe('graveyard');
    const ask = g.state.priority.awaiting;
    expect(ask?.kind === 'commanderZoneChoice' && ask.player, "the commander's question stands").toBe('p2');
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: true, always: false }));
    expect(g.state.cards[talrand]?.zone.kind).toBe('command');
    const legend = g.state.priority.awaiting;
    expect(legend?.kind === 'chooseLegendKeep' && legend.player, 'then the legend rule, asked again by the next pass').toBe('p1');
    must(g.submit({ t: 'ChooseLegendKeep', player: 'p1', keep: second }));
    expect(g.state.cards[first]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[second]?.zone.kind).toBe('battlefield');
    expect(g.state.priority.awaiting?.kind ?? null).not.toBe('chooseLegendKeep');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('two legend groups: the second waits for the first answer instead of re-raising over it', () => {
    const g = startedGame({ players: 2, decks: [['Krenko, Mob Boss', 'Krenko, Mob Boss', 'Talrand, Sky Summoner', 'Talrand, Sky Summoner'], []] });
    put(g, 'p1', 'Krenko, Mob Boss');
    const t1 = put(g, 'p1', 'Talrand, Sky Summoner');
    const k2 = put(g, 'p1', 'Krenko, Mob Boss');
    const krenkos = g.state.priority.awaiting;
    if (krenkos?.kind !== 'chooseLegendKeep') throw new Error('expected the legend rule, got ' + krenkos?.kind);
    expect(krenkos.name).toBe('Krenko, Mob Boss');
    // A Tier-3 move is accepted under any prompt. Before the guard, the pass after it raised the Talrand question over
    // the Krenko one, the next re-raised Krenko over Talrand, and so on until pump threw.
    const t2 = put(g, 'p1', 'Talrand, Sky Summoner');
    expect(g.state.priority.awaiting, 'the question up is not replaced').toEqual(krenkos);
    must(g.submit({ t: 'ChooseLegendKeep', player: 'p1', keep: k2 }));
    const talrands = g.state.priority.awaiting;
    expect(talrands?.kind === 'chooseLegendKeep' && talrands.name, 'then the next pass asks about the other').toBe('Talrand, Sky Summoner');
    must(g.submit({ t: 'ChooseLegendKeep', player: 'p1', keep: t1 }));
    expect(g.state.cards[k2]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[t1]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[t2]?.zone.kind).toBe('graveyard');
    expect(g.state.zones.battlefield.filter((id) => g.state.cards[id]?.controller === 'p1')).toHaveLength(2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an SBA held by the cleanup discard is performed after the answer, and the cleanup repeats (CR 514.3a)', () => {
    const forests = Array.from({ length: 10 }, () => 'Forest');
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...forests], forests] });
    const bears = put(g, 'p1', 'Grizzly Bears');
    must(g.submit({ t: 'ManualDraw', player: 'p1', target: 'p1', count: 8 - (g.state.zones.hand['p1']?.length ?? 0) }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' || s.turn.turnNumber > 1);
    const discard = g.state.priority.awaiting;
    if (discard?.kind !== 'chooseFromZone') throw new Error('expected the cleanup discard, got ' + discard?.kind);
    expect(g.state.turn.step).toBe('cleanup');
    const from = g.log.length;
    must(g.submit({ t: 'ManualSetCounter', player: 'p1', card: bears, kind: '-1/-1', delta: 2 }));
    expect(g.state.cards[bears]?.zone.kind, 'the 0/0 waits for the discard').toBe('battlefield');
    expect(g.state.priority.awaiting).toEqual(discard);
    expect(sbaSince(g, from)).toHaveLength(0);
    const hand = g.state.zones.hand['p1'] ?? [];
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [hand[0] as string] }));
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    const after = g.log.slice(from).map((e) => e.body);
    expect(after.some((b) => b.t === 'CleanupRepeatSet' && b.value === true), 'players get priority, another cleanup follows').toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber > 1);
    const whole = g.log.slice(from).map((e) => e.body);
    expect(whole.filter((b) => b.t === 'StepBegan' && b.step === 'cleanup'), 'the repeated cleanup step').toHaveLength(1);
    expect(g.state.turn.activePlayer).toBe('p2');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
