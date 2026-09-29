// D585 - CASUALTY (CR 702.153): `Casualty N` on an instant or sorcery - an optional additional cost (sacrifice one creature
// with power N or greater) and a cast trigger that copies the spell once, new targets asked. Conspire's path (D557) one
// keyword over with one new rule, the chooser's per-creature power floor. What is proven here (the D585 measurer's
// prototype proofs, ported - measure585-casualty/proofs585c.cjs): the readings (eight spells complete; three whose other
// line keeps them out still read the verb); per spell, the offer lists exactly the caster's creatures with power N or
// greater, a smaller one is refused, and so is a casualty naming no creature or a sacrifice with no casualty; the paid cast
// sacrifices its creature in the cost batch BEFORE SpellCast, the stack object carries the mark, ONE trigger makes ONE copy
// (new targets asked when the spell has any), and the spell's effect happens twice with the copy's choices (CR 707.10 -
// Cut of the Profits' X rides it); a staged cast sacrifices only when it completes; no casualty paid, no trigger; the
// replay hash on each.
import { describe, expect, test } from 'vitest';
import { legalActions } from './legal';
import { engineCompleteness, isEngineComplete } from '../data/engineComplete';
import { parseFace } from '../data/oracleParse';
import type { CardData } from '../data/cardTypes';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { faceOf } from './oracle';
import { advanceUntil, answer, battlefieldOf, deps, holdEverywhere, must, nameOf, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import type { Game } from './game';
import type { Intent } from './types/intents';
import type { InstanceId } from './types/ids';
import type { Awaiting } from './types/state';
import type { EventBody } from './types/events';

const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, symbol: string, amount: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount } as Intent));
const offerOf = (g: Game, card: InstanceId) => legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === card) as { casualtyCandidates?: readonly InstanceId[] } | undefined;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const since = (g: Game, n0: number): EventBody[] => g.log.slice(n0).map((e) => e.body);
const casTriggers = (g: Game, n0: number) => since(g, n0).filter((b) => b.t === 'AbilityPutOnStack' && String(b.obj.abilityRef ?? '').endsWith('#kw:casualty')).length;
const copies = (g: Game, n0: number) => since(g, n0).filter((b): b is Extract<EventBody, { t: 'SpellCopied' }> => b.t === 'SpellCopied');
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const handN = (g: Game, p: 'p1' | 'p2') => (g.state.zones.hand[p] ?? []).length;
const libN = (g: Game, p: 'p1' | 'p2') => (g.state.zones.library[p] ?? []).length;
const life = (g: Game, p: 'p1' | 'p2') => g.state.players[p]?.life ?? 0;
const refused = (g: Game, intent: Intent) => !g.submit(intent).ok;
const ogres = (g: Game) => battlefieldOf(g, 'p1').filter((id) => nameOf(g, id) === 'Ogre Warrior').length;

/** Settles the stack; `custom` answers a prompt kind (`chooseTargets:copy`, `searchLibrary`) itself; how many of each were asked. */
function drive(g: Game, custom: Record<string, (a: Awaiting, g: Game) => Intent> = {}): Record<string, number> {
  const asked: Record<string, number> = {};
  for (let i = 0; i < 600; i++) {
    const s = g.state;
    const a = s.priority.awaiting;
    if (!a && s.stack.length === 0 && s.pendingTriggers.length === 0) return asked;
    if (a) {
      const key = a.kind + ('forKind' in a && a.forKind ? ':' + a.forKind : '');
      asked[key] = (asked[key] ?? 0) + 1;
      const fn = custom[key] ?? custom[a.kind];
      if (fn) must(g.submit(fn(a, g)));
      else answer(g, a);
      continue;
    }
    const holder = s.priority.player;
    if (!holder) throw new Error('nobody has priority');
    must(g.submit({ t: 'PassPriority', player: holder }));
  }
  throw new Error('drive: the stack never settled');
}
const cardData = (name: string) => {
  const c = ENGINE_CARDS.find((x) => x.name === name);
  if (!c) throw new Error('no fixture ' + name);
  return c;
};
const oracleOf = (name: string) => {
  const c = deps().oracle.byName(name);
  if (!c) throw new Error('no oracle card ' + name);
  return c;
};

describe('D585 - casualty (CR 702.153)', () => {
  test('the readings: eight spells complete - the verb, its floor, the keyword; three still out on their other line', () => {
    for (const name of ['Cut of the Profits', 'Illicit Shipment', 'Make Disappear', 'A Little Chat', "Light 'Em Up", 'Rob the Archives', 'Rooftop Nuisance', 'Join the Maestros']) {
      const face = faceOf(oracleOf(name), 0);
      expect(face.casualtyVerb?.sacrificeCost?.count, name).toBe(1);
      expect(face.casualtyVerb?.sacrificeCost?.powerAtLeast, name).toBeGreaterThanOrEqual(1);
      expect(face.keywords, name).toContain('casualty');
      expect(face.effectMode, name).toBe('auto');
      expect(isEngineComplete(cardData(name)), name).toBe(true);
    }
    for (const name of ['Cut Your Losses', 'Dig Up the Body', 'Grisly Sigil']) {
      expect(faceOf(oracleOf(name), 0).casualtyVerb, name).not.toBeNull();
      expect(isEngineComplete(cardData(name)), name).toBe(false);
    }
  });

  test('Join the Maestros (Casualty 2): the floor, the refusals, the sacrifice before the cast, one trigger, one copy, two Ogres', () => {
    const g = startedGame({ players: 2, decks: [['Join the Maestros', 'Hill Giant', 'Memnite', 'Ornithopter'], []] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Join the Maestros', 'hand');
    const giant = put(g, 'p1', 'Hill Giant');
    const mem = put(g, 'p1', 'Memnite');
    main3(g);
    expect(offerOf(g, spell)?.casualtyCandidates, 'the power-2+ creature alone').toEqual([giant]);
    mana(g, 'B', 1); mana(g, 'C', 4);
    expect(refused(g, { t: 'CastSpell', player: 'p1', card: spell, casualty: true, sacrifice: [mem] } as Intent), 'a power-1 Memnite').toBe(true);
    expect(refused(g, { t: 'CastSpell', player: 'p1', card: spell, casualty: true } as Intent), 'no creature named').toBe(true);
    expect(refused(g, { t: 'CastSpell', player: 'p1', card: spell, sacrifice: [giant] } as Intent), 'a sacrifice with no casualty').toBe(true);
    const ogres0 = ogres(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, casualty: true, sacrifice: [giant] } as Intent));
    const cast = since(g, n0).find((b): b is Extract<EventBody, { t: 'SpellCast' }> => b.t === 'SpellCast');
    expect(cast?.obj.casualty, 'the stack object carries it').toBe(true);
    const sacAt = since(g, n0).findIndex((b) => b.t === 'CardsMoved' && b.moves.some((m) => m.card === giant && m.to.kind === 'graveyard'));
    expect(sacAt, 'sacrificed in the cost batch').toBeGreaterThanOrEqual(0);
    expect(sacAt, 'before SpellCast').toBeLessThan(since(g, n0).findIndex((b) => b.t === 'SpellCast'));
    drive(g);
    expect(casTriggers(g, n0), 'one trigger').toBe(1);
    expect(copies(g, n0), 'one copy').toHaveLength(1);
    expect(ogres(g) - ogres0, 'the spell and its copy').toBe(2);
    expect(zoneOf(g, mem), 'Memnite untouched').toBe('battlefield');
    hashHolds(g);
  });

  test('no casualty paid: no trigger, no copy, one Ogre, the Giant stays', () => {
    const g = startedGame({ players: 2, decks: [['Join the Maestros', 'Hill Giant'], []] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Join the Maestros', 'hand');
    const giant = put(g, 'p1', 'Hill Giant');
    main3(g);
    mana(g, 'B', 1); mana(g, 'C', 4);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell } as Intent));
    drive(g);
    expect(casTriggers(g, n0)).toBe(0);
    expect(copies(g, n0)).toHaveLength(0);
    expect(ogres(g)).toBe(1);
    expect(zoneOf(g, giant)).toBe('battlefield');
    hashHolds(g);
  });

  for (const staged of [false, true]) {
    test("Light 'Em Up (Casualty 2)" + (staged ? ', staged - the sacrifice waits for the cast to complete' : '') + ': the copy aimed anew; never the opponent' + "'" + 's creature', () => {
      const g = startedGame({ players: 2, decks: [["Light 'Em Up", 'Hill Giant', 'Memnite'], ['Grizzly Bears', 'Savannah Lions', 'Hill Giant']] });
      holdEverywhere(g);
      const spell = put(g, 'p1', "Light 'Em Up", 'hand');
      const giant = put(g, 'p1', 'Hill Giant');
      const mem = put(g, 'p1', 'Memnite');
      const bears = put(g, 'p2', 'Grizzly Bears');
      const lions = put(g, 'p2', 'Savannah Lions');
      put(g, 'p2', 'Hill Giant');
      main3(g);
      expect(offerOf(g, spell)?.casualtyCandidates, "p1's power-2+ creature alone").toEqual([giant]);
      mana(g, 'R', 1); mana(g, 'C', 1);
      expect(refused(g, { t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }], casualty: true, sacrifice: [mem] } as Intent)).toBe(true);
      const n0 = g.log.length;
      if (staged) {
        must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, casualty: true, sacrifice: [giant] } as Intent));
        expect(g.state.priority.awaiting?.kind, 'the cast waits on its targets').toBe('chooseTargets');
        expect(zoneOf(g, giant), 'not yet sacrificed').toBe('battlefield');
        must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
      } else {
        must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }], casualty: true, sacrifice: [giant] } as Intent));
      }
      const asked = drive(g, { 'chooseTargets:copy': (a) => ({ t: 'ChooseTargets', player: (a as { player: 'p1' }).player, targets: [{ kind: 'card', id: lions }] }) });
      expect(asked['chooseTargets:copy'], 'the copy asked for a new target once').toBe(1);
      expect(casTriggers(g, n0)).toBe(1);
      expect(copies(g, n0)).toHaveLength(1);
      expect([zoneOf(g, bears), zoneOf(g, lions), zoneOf(g, giant)], 'the spell' + "'" + 's target, the copy' + "'" + 's, the fodder').toEqual(['graveyard', 'graveyard', 'graveyard']);
      hashHolds(g);
    });
  }

  test('Make Disappear (Casualty 1): a power-0 Ornithopter is refused; the spell and its copy counter two spells', () => {
    const g = startedGame({ players: 2, decks: [['Make Disappear', 'Lightning Bolt', 'Opt', 'Memnite', 'Ornithopter'], []] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Make Disappear', 'hand');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    const opt = put(g, 'p1', 'Opt', 'hand');
    const mem = put(g, 'p1', 'Memnite');
    const orni = put(g, 'p1', 'Ornithopter');
    main3(g);
    const p2Life = life(g, 'p2');
    mana(g, 'U', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: opt } as Intent));
    const optStack = g.state.stack[g.state.stack.length - 1]?.id ?? '';
    mana(g, 'R', 1);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] } as Intent));
    const boltStack = g.state.stack[g.state.stack.length - 1]?.id ?? '';
    expect(offerOf(g, spell)?.casualtyCandidates, 'the power-1 Memnite, never the power-0 Ornithopter').toEqual([mem]);
    mana(g, 'U', 1); mana(g, 'C', 1);
    expect(refused(g, { t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'stack', id: boltStack }], casualty: true, sacrifice: [orni] } as Intent)).toBe(true);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'stack', id: boltStack }], casualty: true, sacrifice: [mem] } as Intent));
    const hand0 = handN(g, 'p1');
    const asked = drive(g, { 'chooseTargets:copy': (a) => ({ t: 'ChooseTargets', player: (a as { player: 'p1' }).player, targets: [{ kind: 'stack', id: optStack }] }) });
    expect(casTriggers(g, n0)).toBe(1);
    expect(copies(g, n0)).toHaveLength(1);
    expect(asked['chooseTargets:copy']).toBe(1);
    expect(life(g, 'p2'), 'the Bolt countered').toBe(p2Life);
    expect(handN(g, 'p1'), 'Opt countered - no card drawn').toBe(hand0);
    expect([zoneOf(g, bolt), zoneOf(g, opt), zoneOf(g, mem), zoneOf(g, orni)]).toEqual(['graveyard', 'graveyard', 'graveyard', 'battlefield']);
    hashHolds(g);
  });

  test('A Little Chat (Casualty 1): no target - no new-targets question; two looks, a card from each', () => {
    const g = startedGame({ players: 2, decks: [['A Little Chat', 'Memnite'], []] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'A Little Chat', 'hand');
    const mem = put(g, 'p1', 'Memnite');
    main3(g);
    mana(g, 'U', 1); mana(g, 'C', 1);
    const hand0 = handN(g, 'p1');
    const lib0 = libN(g, 'p1');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, casualty: true, sacrifice: [mem] } as Intent));
    const asked = drive(g);
    expect(casTriggers(g, n0)).toBe(1);
    expect(copies(g, n0)).toHaveLength(1);
    expect(asked['chooseTargets:copy'] ?? 0).toBe(0);
    expect(handN(g, 'p1'), 'one card per look (the spell left the hand)').toBe(hand0 - 1 + 2);
    expect(libN(g, 'p1')).toBe(lib0 - 2);
    hashHolds(g);
  });

  test('Rob the Archives (Casualty 1): four cards exiled, each playable this turn', () => {
    const g = startedGame({ players: 2, decks: [['Rob the Archives', 'Memnite'], []] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Rob the Archives', 'hand');
    const mem = put(g, 'p1', 'Memnite');
    main3(g);
    mana(g, 'R', 1); mana(g, 'C', 1);
    const ex0 = (g.state.zones.exile.p1 ?? []).length;
    const perm0 = g.state.playPermissions.filter((p) => p.player === 'p1').length;
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, casualty: true, sacrifice: [mem] } as Intent));
    drive(g);
    expect(casTriggers(g, n0)).toBe(1);
    expect(copies(g, n0)).toHaveLength(1);
    expect((g.state.zones.exile.p1 ?? []).length - ex0).toBe(4);
    expect(g.state.playPermissions.filter((p) => p.player === 'p1').length - perm0).toBe(4);
    hashHolds(g);
  });

  test('Rooftop Nuisance (Casualty 1): two creatures tapped and frozen, two cards drawn', () => {
    const g = startedGame({ players: 2, decks: [['Rooftop Nuisance', 'Memnite'], ['Grizzly Bears', 'Savannah Lions']] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Rooftop Nuisance', 'hand');
    const mem = put(g, 'p1', 'Memnite');
    const bears = put(g, 'p2', 'Grizzly Bears');
    const lions = put(g, 'p2', 'Savannah Lions');
    main3(g);
    mana(g, 'U', 1); mana(g, 'C', 2);
    const hand0 = handN(g, 'p1');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }], casualty: true, sacrifice: [mem] } as Intent));
    const asked = drive(g, { 'chooseTargets:copy': (a) => ({ t: 'ChooseTargets', player: (a as { player: 'p1' }).player, targets: [{ kind: 'card', id: lions }] }) });
    const frozen = since(g, n0).filter((b): b is Extract<EventBody, { t: 'UntapSkipSet' }> => b.t === 'UntapSkipSet' && b.skip).map((b) => b.card);
    expect(casTriggers(g, n0)).toBe(1);
    expect(copies(g, n0)).toHaveLength(1);
    expect(asked['chooseTargets:copy']).toBe(1);
    expect([g.state.cards[bears]?.tapped, g.state.cards[lions]?.tapped]).toEqual([true, true]);
    expect([...frozen].sort()).toEqual([bears, lions].sort());
    expect(handN(g, 'p1'), 'a card per resolution').toBe(hand0 - 1 + 2);
    hashHolds(g);
  });

  test('Illicit Shipment (Casualty 3): the 2-power Bears is refused; two searches', () => {
    const g = startedGame({ players: 2, decks: [['Illicit Shipment', 'Hill Giant', 'Grizzly Bears', 'Lightning Bolt', 'Opt'], []] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Illicit Shipment', 'hand');
    const giant = put(g, 'p1', 'Hill Giant');
    const bears = put(g, 'p1', 'Grizzly Bears');
    main3(g);
    expect(offerOf(g, spell)?.casualtyCandidates, 'the power-3 Giant alone').toEqual([giant]);
    mana(g, 'B', 2); mana(g, 'C', 3);
    expect(refused(g, { t: 'CastSpell', player: 'p1', card: spell, casualty: true, sacrifice: [bears] } as Intent)).toBe(true);
    const hand0 = handN(g, 'p1');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, casualty: true, sacrifice: [giant] } as Intent));
    const found: InstanceId[] = [];
    drive(g, {
      searchLibrary: (a, gg) => {
        const ask = a as Extract<Awaiting, { kind: 'searchLibrary' }> & { optional?: boolean };
        if (ask.optional) return { t: 'AnswerSearchLibrary', player: ask.player, cards: [], declined: false } as Intent;
        const pick = (gg.state.zones.library[ask.player] ?? [])[0] as InstanceId;
        found.push(pick);
        return { t: 'AnswerSearchLibrary', player: ask.player, cards: [pick], declined: false } as Intent;
      },
    });
    expect(casTriggers(g, n0)).toBe(1);
    expect(copies(g, n0)).toHaveLength(1);
    expect(found).toHaveLength(2);
    expect(found.map((id) => zoneOf(g, id))).toEqual(['hand', 'hand']);
    expect(handN(g, 'p1')).toBe(hand0 - 1 + 2);
    hashHolds(g);
  });

  test('Cut of the Profits (Casualty 3): X = 2 on the spell AND its copy (CR 707.10) - four cards, four life', () => {
    const g = startedGame({ players: 2, decks: [['Cut of the Profits', 'Hill Giant'], []] });
    holdEverywhere(g);
    const spell = put(g, 'p1', 'Cut of the Profits', 'hand');
    const giant = put(g, 'p1', 'Hill Giant');
    main3(g);
    mana(g, 'B', 2); mana(g, 'C', 2);
    const hand0 = handN(g, 'p1');
    const life0 = life(g, 'p1');
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2, casualty: true, sacrifice: [giant] } as Intent));
    drive(g);
    const cp = copies(g, n0);
    expect(casTriggers(g, n0)).toBe(1);
    expect(cp).toHaveLength(1);
    expect(cp[0]?.obj.xValue, 'X rides the copy').toBe(2);
    expect(cp[0]?.obj.casualty, 'the mark rides the copy (CR 707.10) - and triggers nothing again').toBe(true);
    expect(handN(g, 'p1')).toBe(hand0 - 1 + 4);
    expect(life(g, 'p1')).toBe(life0 - 4);
    hashHolds(g);
  });
  // D585 - THE REVIEW (latent - no printed card has one of these shapes): the effect text drops a Casualty line by its words,
  // so the line is the engine's only where the parser read it - once, with its keyword, and with no other cost that takes
  // picks beside it (the host charges one set a cast). Each shape below read COMPLETE before the guard.
  test('a Casualty line the host never charges keeps its spell out: twice, no keyword, beside another picked cost', () => {
    const base = cardData('A Little Chat');
    const synth = (name: string, text: string, keywords: readonly string[] = ['Casualty']): CardData => ({
      ...base,
      name,
      oracleId: 'd585-synthetic-' + name,
      keywords: [...keywords],
      faces: [{ ...(base.faces[0] as CardData['faces'][number]), name, oracleText: text }],
    });
    const lines = (...ls: string[]) => ls.join(String.fromCharCode(10));
    for (const c of [
      synth('Twice Casualty', lines('Casualty 1', 'Casualty 2', 'Draw a card.')),
      synth('Casualty Without Its Keyword', lines('Casualty 2', 'Draw a card.'), []),
      synth('Casualty Beside An Additional Cost', lines('As an additional cost to cast this spell, discard a card.', 'Casualty 2', 'Draw a card.')),
      synth('Casualty Beside A Verb Kicker', lines('Kicker—Sacrifice a creature.', 'Casualty 2', 'Draw a card.')),
      synth('Casualty Beside Conspire', lines('Conspire', 'Casualty 2', 'Draw a card.'), ['Casualty', 'Conspire']),
    ]) {
      expect(parseFace(c, 0).casualtyVerb, c.name).toBeNull();
      expect(engineCompleteness(c).complete, c.name).toBe(false);
    }
    // The control: the line printed once, with its keyword and nothing beside it, reads - and the spell is complete.
    const ok = synth('Casualty Alone', lines('Casualty 2', 'Draw a card.'));
    expect(parseFace(ok, 0).casualtyVerb?.sacrificeCost?.powerAtLeast).toBe(2);
    expect(engineCompleteness(ok).complete).toBe(true);
  });
});
