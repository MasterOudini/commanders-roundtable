// D525 - CASCADE (CR 702.85). A keyword that IS a cast trigger, run from the keyword table off the SPELL ON THE STACK:
// when you cast this spell, exile cards from the top of your library until you exile a nonland card whose mana value is
// less than this spell's; you may cast it without paying its mana cost (D491's cast begun by an answer, from exile
// under a play permission - D417's); put the exiled cards on the bottom of your library in a random order (D389's
// seeded generator, handed back through the ability path as `rngAfter`). What is proven here: the parser's reading; the
// exile-until, the cast above the cascading spell and the passed land under the library; the decline that bottoms the
// candidate too; a library with no candidate; four printings firing four times (Apex Devastator); the replay hash on each.
import { describe, expect, test } from 'vitest';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: 'p1' | 'p2', symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const onTop = (g: Game, card: InstanceId) => must(g.submit({ t: 'ManualMoveCard', player: 'p1', card, to: { kind: 'library', player: 'p1' }, placement: 'top' }));
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const chooser = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseFromZone' && s.priority.awaiting.castFree === true, 20_000);
const cascades = (g: Game) => g.log.reduce((n, e) => n + (e.body.t === 'PendingTriggersAdded' ? e.body.triggers.filter((t) => t.abilityRef.endsWith('#kw:cascade')).length : 0), 0);
const freeFromExile = (g: Game) => g.log.filter((e) => e.body.t === 'SpellCast' && e.body.obj.freeCast === true && e.body.obj.castFrom?.kind === 'exile').length;
const enteredAt = (g: Game, card: InstanceId) => g.log.findIndex((e) => e.body.t === 'CardsMoved' && e.body.moves.some((m) => m.card === card && m.to.kind === 'battlefield'));

/** The Elf in hand, the Bears under a Forest on top of the library, four mana floating: the cast is one intent away. */
function armed(): { g: Game; elf: InstanceId; bears: InstanceId; forest: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Bloodbraid Elf', 'Grizzly Bears', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']], options: { maxHandSize: null } });
  holdEverywhere(g);
  const elf = put(g, 'p1', 'Bloodbraid Elf', 'hand');
  const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
  const forest = put(g, 'p1', 'Forest', 'hand');
  main(g, 3);
  onTop(g, bears);
  onTop(g, forest);
  mana(g, 'p1', 'RRGG');
  return { g, elf, bears, forest };
}

describe('D525 - cascade', () => {
  test('the parser reads the keyword line, once or four times', () => {
    expect(faceNamed('Bloodbraid Elf').keywords).toContain('cascade');
    expect(faceNamed('Ardent Plea').keywords).toContain('cascade');
    expect(faceNamed('Apex Devastator').keywords).toContain('cascade');
    expect(faceNamed('Grizzly Bears').keywords).not.toContain('cascade');
  });

  test('Bloodbraid Elf cascades past a Forest into the Bears, cast for nothing above the Elf, the Forest under the library', () => {
    const { g, elf, bears, forest } = armed();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: elf }));
    chooser(g);
    expect(cascades(g)).toBe(1);
    const aw = g.state.priority.awaiting;
    expect(aw?.kind === 'chooseFromZone' ? aw.pool : null).toEqual([bears]);
    expect(aw?.kind === 'chooseFromZone' ? aw.zone : null).toBe('exile');
    expect(g.state.cards[bears]?.zone.kind, 'the candidate waits in exile').toBe('exile');
    expect(g.state.cards[forest]?.zone.kind, 'the passed land is back in the library').toBe('library');
    expect(g.state.zones.library.p1?.[0], 'on the bottom').toBe(forest);
    expect(g.state.playPermissions.some((p) => p.card === bears)).toBe(true);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bears] }));
    settle(g);
    expect(freeFromExile(g)).toBe(1);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[elf]?.zone.kind).toBe('battlefield');
    expect(enteredAt(g, bears), 'the free cast resolved above the cascading spell').toBeLessThan(enteredAt(g, elf));
    expect(g.state.playPermissions.some((p) => p.card === bears), 'the permission left with the card').toBe(false);
    expect(g.log.some((e) => e.rngAfter !== undefined), 'the random order advanced the generator through the log').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declining puts the candidate on the bottom with the rest, and its permission is gone', () => {
    const { g, elf, bears, forest } = armed();
    must(g.submit({ t: 'CastSpell', player: 'p1', card: elf }));
    chooser(g);
    must(g.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [] }));
    settle(g);
    expect(freeFromExile(g)).toBe(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('library');
    expect(g.state.zones.library.p1?.slice(0, 2), 'the candidate under the passed land, both at the bottom').toEqual([bears, forest]);
    expect(g.state.playPermissions.some((p) => p.card === bears)).toBe(false);
    expect(g.state.cards[elf]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a library of lands alone is exiled whole and put back on the bottom, and nothing is asked', () => {
    const g = startedGame({ players: 2, decks: [['Bloodbraid Elf', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const elf = put(g, 'p1', 'Bloodbraid Elf', 'hand');
    main(g, 3);
    const size = (g.state.zones.library.p1 ?? []).length;
    expect(size).toBeGreaterThan(0);
    mana(g, 'p1', 'RRGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: elf }));
    settle(g);
    expect(cascades(g)).toBe(1);
    expect(freeFromExile(g)).toBe(0);
    expect((g.state.zones.library.p1 ?? []).length, 'every exiled card came back').toBe(size);
    expect(g.log.some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'chooseFromZone'), 'no chooser was raised').toBe(false);
    expect(g.log.some((e) => e.body.t === 'Narrated' && /no nonland card with a lesser mana value/.test(e.body.text))).toBe(true);
    expect(g.state.cards[elf]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Apex Devastator prints the word four times and cascades four times', () => {
    const g = startedGame({ players: 2, decks: [['Apex Devastator', 'Grizzly Bears', 'Lightning Bolt', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']], options: { maxHandSize: null } });
    holdEverywhere(g);
    const devastator = put(g, 'p1', 'Apex Devastator', 'hand');
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    main(g, 3);
    onTop(g, bears);
    onTop(g, bolt);
    mana(g, 'p1', 'GGGGGGGGGG');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: devastator }));
    // The harness answers each chooser by casting its candidate (the Bolt, then the Bears); the last two find only lands.
    settle(g);
    expect(cascades(g)).toBe(4);
    expect(freeFromExile(g)).toBe(2);
    expect(g.state.cards[devastator]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
