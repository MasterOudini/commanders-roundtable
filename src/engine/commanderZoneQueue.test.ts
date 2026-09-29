// CR 903.9a - THE COMMANDER'S QUESTION WAITS ITS TURN. The replacement funnel raised `the command zone?` as an
// `AwaitingSet` right after a commander's move to a graveyard or exile, over whatever else its batch went on to ask -
// and an `AwaitingSet` holds one question, so the later one won: Path to Exile's search offer replaced it, and nothing
// ever asked it again. The reverse lost the other question: a commander an SBA killed under a live prompt replaced it
// (Grim Affliction's proliferate), and the legend rule raised in the same pass was replaced by it. D587 (the merged
// commander rework): 903.9a is a STATE-BASED ACTION after the move - the commander is marked `commanderZoneOwed` and the
// SBA pass asks, only with no question up (the SBA guard, CR 704.3), after the pass's legend rule. These four proofs
// came from the dropped queue branch (fix/commander-zone-queue); each failed on the pre-D587 engine.
import { describe, expect, test } from 'vitest';
import { advanceUntil, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import { createRegistry } from './scripts/registryCore';
import { NIGHT_OF_SOULS_BETRAYAL_SCRIPT } from './scripts/cards/nightOfSoulsBetrayal';
import { replay, stateHash } from './log';
import type { Game } from './game';

const BETRAYAL = "Night of Souls' Betrayal";
const main1 = (g: Game) => advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
const firstPrompt = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting !== null, 20_000);

// p1 casts `spell` from hand at `target` (or at nothing) with the mana added by hand, then runs to the first question.
function cast(g: Game, spell: string, symbol: 'W' | 'B', amount: number, target: string | null): void {
  const card = put(g, 'p1', spell, 'hand');
  main1(g);
  holdEverywhere(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: target === null ? [] : [{ kind: 'card', id: target }] }));
  firstPrompt(g);
}

function commanderQuestion(g: Game, player: string, card: string): void {
  const ask = g.state.priority.awaiting;
  if (ask?.kind !== 'commanderZoneChoice') throw new Error("expected the commander's question, got " + (ask?.kind ?? 'none'));
  expect(ask.player).toBe(player);
  expect(ask.queue[0]?.card).toBe(card);
}

describe("the commander's question (CR 903.9a) is never replaced, and never replaces another", () => {
  test("Path to Exile on a commander: the search offer is asked, then the commander's question", () => {
    const g = startedGame({ players: 2, decks: [['Path to Exile'], []] });
    const krenko = put(g, 'p2', 'Krenko, Mob Boss');
    cast(g, 'Path to Exile', 'W', 1, krenko);
    const offer = g.state.priority.awaiting;
    expect(offer?.kind === 'searchLibrary' && offer.player, "the spell's own question").toBe('p2');
    expect(g.state.cards[krenko]?.zone.kind).toBe('exile');
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: false }));
    const forest = (g.state.zones.library['p2'] ?? []).find((id) => nameOf(g, id) === 'Forest');
    if (forest === undefined) throw new Error("no Forest left in p2's library");
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [forest], declined: false }));
    expect(g.state.cards[forest]?.zone.kind, 'the search finished').toBe('battlefield');
    commanderQuestion(g, 'p2', krenko);
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: true, always: false }));
    expect(g.state.cards[krenko]?.zone.kind).toBe('command');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a commander killed under a live question waits for it: the proliferate, then the commander', () => {
    const g = startedGame({ players: 2, decks: [['Grim Affliction'], []] });
    const krenko = put(g, 'p2', 'Krenko, Mob Boss');
    must(g.submit({ t: 'ManualSetCounter', player: 'p2', card: krenko, kind: '-1/-1', delta: 2 }));
    cast(g, 'Grim Affliction', 'B', 3, krenko);
    expect(g.state.priority.awaiting?.kind, 'the proliferate is not replaced').toBe('proliferateChoice');
    must(g.submit({ t: 'AnswerProliferate', player: 'p1', permanents: [], players: [] }));
    commanderQuestion(g, 'p2', krenko);
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: true, always: false }));
    expect(g.state.cards[krenko]?.zone.kind).toBe('command');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('one pass raises the legend rule and kills a commander: the legend question stands, then the commander', () => {
    const g = startedGame({
      players: 2,
      decks: [[BETRAYAL, BETRAYAL], []],
      commanders: [['Kess, Dissident Mage'], ['Talrand, Sky Summoner']],
      scripts: createRegistry([NIGHT_OF_SOULS_BETRAYAL_SCRIPT]),
    });
    const talrand = put(g, 'p2', 'Talrand, Sky Summoner');
    const first = put(g, 'p1', BETRAYAL);
    // The second Betrayal: in ONE pass Talrand (a 2/2 under two) dies and the legend rule asks p1.
    const second = put(g, 'p1', BETRAYAL);
    expect(g.state.cards[talrand]?.zone.kind).toBe('graveyard');
    const legend = g.state.priority.awaiting;
    expect(legend?.kind === 'chooseLegendKeep' && legend.player, "the legend rule's question stands").toBe('p1');
    must(g.submit({ t: 'ChooseLegendKeep', player: 'p1', keep: second }));
    expect(g.state.cards[first]?.zone.kind).toBe('graveyard');
    commanderQuestion(g, 'p2', talrand);
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: true, always: false }));
    expect(g.state.cards[talrand]?.zone.kind).toBe('command');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("a wrath's two commanders are asked in turn order (APNAP), each owner in turn", () => {
    const g = startedGame({ players: 2, decks: [['Wrath of God'], []] });
    const kess = put(g, 'p1', 'Kess, Dissident Mage');
    const krenko = put(g, 'p2', 'Krenko, Mob Boss');
    cast(g, 'Wrath of God', 'W', 4, null);
    commanderQuestion(g, 'p1', kess);
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p1', toCommandZone: true, always: false }));
    commanderQuestion(g, 'p2', krenko);
    must(g.submit({ t: 'CommanderZoneChoice', player: 'p2', toCommandZone: false, always: false }));
    expect(g.state.cards[kess]?.zone.kind).toBe('command');
    expect(g.state.cards[krenko]?.zone.kind).toBe('graveyard');
    expect(g.state.priority.awaiting?.kind ?? null).not.toBe('commanderZoneChoice');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
