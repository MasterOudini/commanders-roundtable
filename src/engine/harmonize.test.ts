// D563 - HARMONIZE (CR 702.180a): "You may cast this card from your graveyard by paying [cost] rather than paying its mana
// cost. If you do, you may tap an untapped creature you control. If you do, that spell costs {X} less to cast, where X is
// the tapped creature's power. If this spell would be put into a graveyard, exile it instead." Flashback's graveyard cast
// (D307) with the tap as a cost reduction: the creature rides the cast's alternatives (`CastSpell.harmonize`), its power
// folded into the tax. What is proven here: the readings (the Harmonize cost on the face, the line out of the clauses, the
// six complete); the graveyard offer names the creatures it may tap and whether the strongest makes it payable; Unending
// Whisper cast from the graveyard for its full harmonize cost draws and is exiled; cast with Grizzly Bears tapped it
// costs two less - the Bears tapped, the Whisper exiled; the host refuses a tap on a cast from the hand, on an
// opponent's creature and on one not on the battlefield; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { isEngineComplete } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { legalActions } from './legal';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const HARMONIZE = ['Channeled Dragonfire', 'Mammoth Bellow', "Ureni's Rebuff", 'Wild Ride', "Roamer's Routine", 'Unending Whisper'];
const FILL = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const mana = (g: Game, sym: 'U' | 'C', n: number) => must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: sym, amount: n }));
const zoneOf = (g: Game, id: InstanceId): string => g.state.cards[id]?.zone.kind ?? 'gone';
const drew = (g: Game, from: number) => g.log.slice(from).filter((e) => e.body.t === 'DrewCards' && e.body.player === 'p1').length;

/** p1: Unending Whisper in the graveyard and Grizzly Bears on the battlefield from turn 1; p2: a Grizzly Bears. */
function armed(): { g: Game; whisper: InstanceId; bears: InstanceId; theirs: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Unending Whisper', 'Unending Whisper', 'Grizzly Bears', ...FILL], ['Grizzly Bears', ...FILL]] });
  settle(g);
  holdEverywhere(g);
  const whisper = put(g, 'p1', 'Unending Whisper', 'graveyard');
  const bears = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  main3(g);
  return { g, whisper, bears, theirs };
}

describe('D563 - harmonize', () => {
  test('the readings: the Harmonize cost on the face, the line out of the clauses, the six complete', () => {
    expect(faceNamed('Unending Whisper').harmonizeCost?.raw).toBe('{5}{U}');
    expect(faceNamed('Unending Whisper').keywords).toContain('harmonize');
    expect(faceNamed('Unending Whisper').effectMode).toBe('auto');
    expect(faceNamed('Channeled Dragonfire').harmonizeCost?.raw).toBe('{5}{R}{R}');
    expect(faceNamed('Lightning Bolt').harmonizeCost).toBeNull();
    for (const name of HARMONIZE) expect(isEngineComplete(fixture(name)), name).toBe(true);
  });

  test('the graveyard offer names the creatures it may tap and whether the strongest makes it payable', () => {
    const { g, whisper, bears } = armed();
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    const offer = legalActions(g.state, deps().oracle, g.deps.scripts, 'p1').find((a) => a.t === 'CastSpell' && a.card === whisper);
    expect(offer?.t === 'CastSpell' ? offer.from.kind : null).toBe('graveyard');
    expect(offer?.t === 'CastSpell' ? offer.affordable : null, 'four mana is short of {5}{U}').toBe(false);
    expect(offer?.t === 'CastSpell' ? offer.harmonizeCandidates : null).toEqual([bears]);
    expect(offer?.t === 'CastSpell' ? offer.harmonizeAffordable : null, 'the Bears take two off').toBe(true);
  });

  test('cast from the graveyard for the full harmonize cost: a card drawn, the Whisper exiled', () => {
    const { g, whisper, bears } = armed();
    mana(g, 'U', 1);
    mana(g, 'C', 5);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: whisper }));
    settle(g);
    expect(drew(g, n0)).toBe(1);
    expect(zoneOf(g, whisper), 'exiled as it left the stack').toBe('exile');
    expect(g.state.cards[bears]?.tapped).toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('cast with Grizzly Bears tapped: two less - the Bears tapped, a card drawn, the Whisper exiled', () => {
    const { g, whisper, bears } = armed();
    mana(g, 'U', 1);
    mana(g, 'C', 3);
    const n0 = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: whisper, harmonize: bears }));
    settle(g);
    expect(g.state.cards[bears]?.tapped, 'tapped for the harmonize').toBe(true);
    expect(drew(g, n0)).toBe(1);
    expect(zoneOf(g, whisper)).toBe('exile');
    expect(g.log.slice(n0).some((e) => e.body.t === 'SpellCast' && e.body.obj.harmonizeTapped === true)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('the host refuses a tap on a cast from the hand, on an opponent' + "'" + 's creature and on one not on the battlefield', () => {
    const { g, whisper, bears, theirs } = armed();
    const inHand = put(g, 'p1', 'Unending Whisper', 'hand');
    mana(g, 'U', 1);
    mana(g, 'C', 5);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: inHand, harmonize: bears }).ok, 'a cast from the hand').toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: whisper, harmonize: theirs }).ok, "an opponent's creature").toBe(false);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: whisper, harmonize: bears }).ok, 'not on the battlefield').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
