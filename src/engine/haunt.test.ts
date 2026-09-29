// D583 - HAUNT (CR 702.55): the keyword (Scryfall's `Haunt`); the haunt's exile - a creature put into a graveyard from
// the battlefield, or an instant or sorcery put into a graveyard as it resolves, exiled HAUNTING target creature (that
// object and its entry stamp, `CardInstance.haunting`); and the card's abilities that refer to the creature it haunts,
// from exile - an instant's or sorcery's printed line natively (`OracleFace.hauntedDies`), a creature's by its script (a
// def active in exile). What is proven here: the reading (the keyword; the spell's haunted-dies line read apart and
// whole - Seize the Soul and Cry of Contrition complete, their own targets the spell's alone); Belfry Spirit dies and
// haunts the Bears, the Bears die and a test script's def fires from exile; the link is to the OBJECT (the Bears bounced
// and replayed, then dying, fire nothing); Benediction of Moons resolves, haunts the Bears and gains its life again as
// they die; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { engineCompleteness } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { createRegistry } from './scripts/registryCore';
import type { CardScript } from './scripts/api';
import { hauntedDied } from './keywordTriggers';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { EventBody } from './types/events';

const BELFRY = 'Belfry Spirit';
const LANDS = ['Plains', 'Plains', 'Plains', 'Swamp', 'Swamp', 'Swamp', 'Plains', 'Swamp'];
const oracleIdOf = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return c.oracleId; };
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main1 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 1 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
const aimAt = (g: Game, player: 'p1' | 'p2', id: string) => {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player, targets: [{ kind: 'card', id }] }));
  settle(g);
};
const life = (g: Game) => g.state.players.p1?.life ?? 0;

// A test script for Belfry Spirit's haunted-dies half alone: from exile, when the creature it haunts dies, gain 3 life.
const HAUNTED_DEF: CardScript = {
  oracleId: oracleIdOf(BELFRY),
  name: BELFRY,
  triggers: [
    {
      abilityId: 'hauntedDies',
      text: 'TEST: when the creature it haunts dies, you gain 3 life.',
      event: 'CardsMoved',
      activeZones: ['exile'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) => hauntedDied(ctx, self, ev),
      label: () => 'TEST - gain 3 life',
      resolve: (ctx, self): readonly EventBody[] => {
        const who = ctx.state.cards[self]?.owner ?? 'p1';
        const now = ctx.state.players[who]?.life ?? 0;
        return [{ t: 'LifeChanged', player: who, delta: 3, to: now + 3 }];
      },
    },
  ],
};

function haunted(): { g: Game; belfry: string; bears: string } {
  const g = startedGame({ players: 2, decks: [[BELFRY, ...LANDS], ['Grizzly Bears', ...LANDS]], scripts: createRegistry([HAUNTED_DEF]) });
  holdEverywhere(g);
  main1(g);
  const belfry = put(g, 'p1', BELFRY);
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  // It dies: the haunt trigger aims at a creature, and the card is exiled haunting it.
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: belfry, to: { kind: 'graveyard', player: 'p1' } }));
  aimAt(g, 'p1', bears);
  return { g, belfry, bears };
}

describe('D583 - haunt', () => {
  test('the reading: the keyword, and a spell' + "'" + 's haunted-dies line read apart and whole', () => {
    expect(faceNamed(BELFRY).keywords).toContain('haunt');
    const cry = faceNamed('Cry of Contrition');
    expect(cry.keywords).toContain('haunt');
    expect(cry.hauntedDies?.text).toBe('Target player discards a card.');
    expect(cry.hauntedDies?.targets, 'the trigger' + "'" + 's own clause').toHaveLength(1);
    expect(cry.targets, 'the cast aims at its own clause alone').toHaveLength(1);
    expect(cry.effectMode).toBe('auto');
    const seize = faceNamed('Seize the Soul');
    expect(seize.hauntedDies?.text).toBe('Destroy target nonwhite, nonblack creature. Create a 1/1 white Spirit creature token with flying.');
    for (const name of ['Cry of Contrition', 'Seize the Soul', 'Benediction of Moons']) {
      const card = ENGINE_CARDS.find((c) => c.name === name);
      if (!card) throw new Error('no fixture ' + name);
      expect(engineCompleteness(card), name + ': the whole spell the engine' + "'" + 's').toEqual({ complete: true, leftover: [] });
    }
  });

  test('Belfry Spirit dies and haunts the Bears; they die, and its haunted-dies def fires from exile', () => {
    const { g, belfry, bears } = haunted();
    const card = g.state.cards[belfry];
    expect(card?.zone.kind).toBe('exile');
    expect(card?.haunting).toEqual({ card: bears, entry: g.state.cards[bears]?.entries ?? 0 });
    const life0 = life(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(life(g), 'the def from exile').toBe(life0 + 3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the haunt is of the OBJECT: the Bears bounced and replayed, then dying, fire nothing', () => {
    const { g, bears } = haunted();
    const life0 = life(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'hand', player: 'p2' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'battlefield', player: 'p2' } }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(life(g), 'a new object - nothing haunted it').toBe(life0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  // The review (wf_6f955501-cf4) caught both of these: a delayed-effects trigger that declared targets skipped CR 608.2b,
  // and the haunt's narration named a face-down creature.
  test('the haunted-dies trigger whose target left in response does nothing (CR 608.2b - no Spirit)', () => {
    const g = startedGame({ players: 2, decks: [['Seize the Soul', ...LANDS], ['Grizzly Bears', 'Grizzly Bears', 'Llanowar Elves', ...LANDS]] });
    holdEverywhere(g);
    main1(g);
    const spell = put(g, 'p1', 'Seize the Soul', 'hand');
    const first = put(g, 'p2', 'Grizzly Bears');
    const hauntedBears = put(g, 'p2', 'Grizzly Bears');
    const elves = put(g, 'p2', 'Llanowar Elves');
    settle(g);
    const spirits = () => Object.values(g.state.cards).filter((c) => c.zone.kind === 'battlefield' && c.controller === 'p1' && c.oracleId !== g.state.cards[spell]?.oracleId).length;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: first }] }));
    aimAt(g, 'p1', hauntedBears);
    expect(g.state.cards[first]?.zone.kind, 'the spell destroyed its target').toBe('graveyard');
    expect(g.state.cards[spell]?.haunting?.card).toBe(hauntedBears);
    const spirits0 = spirits();
    // The haunted creature dies: the line again, aimed at the Elves - and the Elves leave in response.
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: hauntedBears, to: { kind: 'graveyard', player: 'p2' } }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: elves }] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: elves, to: { kind: 'hand', player: 'p2' } }));
    settle(g);
    expect(spirits(), 'every target illegal: the ability does nothing - no Spirit').toBe(spirits0);
    expect(g.state.narration.some((l) => l.text.includes('no legal target left, so it does not resolve')), 'CR 608.2b said').toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the haunt names a face-down creature as the table sees it', () => {
    const g = startedGame({ players: 2, decks: [[BELFRY, ...LANDS], ['Grizzly Bears', ...LANDS]], scripts: createRegistry([HAUNTED_DEF]) });
    holdEverywhere(g);
    main1(g);
    const belfry = put(g, 'p1', BELFRY);
    const bears = put(g, 'p2', 'Grizzly Bears');
    must(g.submit({ t: 'ManualSetFaceDown', player: 'p2', card: bears, faceDown: true }));
    settle(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: belfry, to: { kind: 'graveyard', player: 'p1' } }));
    aimAt(g, 'p1', bears);
    expect(g.state.cards[belfry]?.haunting?.card).toBe(bears);
    const said = g.state.narration.map((l) => l.text).filter((t) => t.includes(' haunts '));
    expect(said, 'the haunt is said').toHaveLength(1);
    expect(said[0], 'and names no hidden card').not.toContain('Grizzly Bears');
    expect(said[0]).toContain('a face-down creature');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Benediction of Moons resolves, haunts the Bears, and gains its life again as they die (the native trigger)', () => {
    const g = startedGame({ players: 2, decks: [['Benediction of Moons', ...LANDS], ['Grizzly Bears', ...LANDS]] });
    holdEverywhere(g);
    main1(g);
    const spell = put(g, 'p1', 'Benediction of Moons', 'hand');
    const bears = put(g, 'p2', 'Grizzly Bears');
    settle(g);
    const life0 = life(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    // It resolves (one life for each of two players), then its haunt aims at a creature from the graveyard.
    aimAt(g, 'p1', bears);
    expect(life(g), 'the spell').toBe(life0 + 2);
    expect(g.state.cards[spell]?.zone.kind).toBe('exile');
    expect(g.state.cards[spell]?.haunting?.card).toBe(bears);
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'graveyard', player: 'p2' } }));
    settle(g);
    expect(life(g), 'the haunted creature died: the line again, from exile').toBe(life0 + 4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
