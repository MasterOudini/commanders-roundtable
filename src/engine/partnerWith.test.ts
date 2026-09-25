// D544 - PARTNER WITH (CR 702.124j): "When this permanent enters, target player may search their library for a card named
// [name], reveal it, put it into their hand, then shuffle." The pairing is the validator's (D542); the enters trigger is a
// keyword entry fired off the permanent's entry (D541's `fromMove`), its search the vocabulary's own reading of the
// caster's sentence (`OracleFace.partnerWith`) asked of the TARGET player (D507). What is proven here: the reading and
// the line accounted; Blaring Recruiter entering, p1 targeted, the offer accepted and Blaring Captain found into p1's
// hand; the opponent targeted - the search asked of p2 over p2's library, declined; a face-down entry triggers nothing;
// the replay hash on each.
import { describe, expect, test } from 'vitest';
import { linesUnaccounted } from '../data/engineComplete';
import { partnerWithName } from '../data/effectParse';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { faceOf } from './oracle';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const LANDS = ['Plains', 'Plains', 'Plains', 'Plains', 'Swamp', 'Swamp', 'Swamp', 'Swamp'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.pendingAsks === null && s.priority.awaiting === null && s.pendingReplacement === null, 20_000);
const faceNamed = (name: string) => { const c = deps().oracle.byName(name); if (!c) throw new Error('no such fixture: ' + name); return faceOf(c, 0); };
const fixture = (name: string) => { const card = ENGINE_CARDS.find((c) => c.name === name); if (!card) throw new Error(`no fixture ${name}`); return card; };
const nameOf = (g: Game, id: InstanceId) => { const c = g.state.cards[id]; const p = c ? deps().oracle.byPrinting(c.printingId) : undefined; return p ? faceOf(p, 0).name : ''; };

/** p1 moves the Recruiter onto the battlefield and aims its trigger at `who`. */
function enterAndTarget(g: Game, recruiter: InstanceId, who: PlayerId) {
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: recruiter, to: { kind: 'battlefield', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: who }] }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'searchLibrary', 20_000);
}

describe('D544 - partner with', () => {
  test('the reading: the name, the search aimed at a target player, the line accounted', () => {
    expect(partnerWithName('Partner with Blaring Captain (When this creature enters, target player may put Blaring Captain into their hand from their library, then shuffle.)')).toBe('Blaring Captain');
    expect(partnerWithName('Flying')).toBeNull();
    const spec = faceNamed('Blaring Recruiter').partnerWith;
    expect(spec?.kind).toBe('search');
    expect(spec?.targetIndex).toBe(0);
    expect(spec?.self).toBe(false);
    expect(JSON.stringify(spec?.search ?? null)).toContain('Blaring Captain');
    expect(faceNamed('Grizzly Bears').partnerWith).toBeNull();
    const card = fixture('Blaring Recruiter');
    const face = card.faces[0];
    if (!face) throw new Error('no face');
    const open = linesUnaccounted(face.oracleText, faceNamed('Blaring Recruiter'), card.keywords).map((l) => l.text);
    expect(open.some((t) => /^Partner with/.test(t)), 'the Partner with line is the engine\'s').toBe(false);
  });

  test('p1 targeted: the offer accepted, Blaring Captain found into p1 hand', () => {
    const g = startedGame({ players: 2, decks: [['Blaring Recruiter', 'Blaring Captain', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const recruiter = put(g, 'p1', 'Blaring Recruiter', 'hand');
    main3(g);
    // The opening seven may have dealt the Captain: it goes back into the library to be found.
    const captain = (Object.keys(g.state.cards) as InstanceId[]).find((id) => nameOf(g, id) === 'Blaring Captain' && g.state.cards[id]?.owner === 'p1');
    if (captain === undefined) throw new Error('no Blaring Captain in the game');
    if (g.state.cards[captain]?.zone.kind !== 'library') must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: captain, to: { kind: 'library', player: 'p1' } }));
    enterAndTarget(g, recruiter, 'p1');
    const offer = g.state.priority.awaiting;
    expect(offer?.kind === 'searchLibrary' ? offer.player : null).toBe('p1');
    expect(offer?.kind === 'searchLibrary' ? offer.optional : null, 'the offer first').toBe(true);
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [], declined: false }));
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p1', cards: [captain], declined: false }));
    settle(g);
    expect(g.state.cards[captain]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("the opponent targeted: the search is asked of p2 over p2's library, and declined", () => {
    const g = startedGame({ players: 2, decks: [['Blaring Recruiter', ...LANDS], ['Blaring Captain', ...LANDS]] });
    holdEverywhere(g);
    const recruiter = put(g, 'p1', 'Blaring Recruiter', 'hand');
    main3(g);
    enterAndTarget(g, recruiter, 'p2');
    const offer = g.state.priority.awaiting;
    expect(offer?.kind === 'searchLibrary' ? offer.player : null, 'the target player searches').toBe('p2');
    const p2Hand = (g.state.zones.hand.p2 ?? []).length;
    must(g.submit({ t: 'AnswerSearchLibrary', player: 'p2', cards: [], declined: true }));
    settle(g);
    expect((g.state.zones.hand.p2 ?? []).length, 'nothing found').toBe(p2Hand);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a face-down entry triggers nothing', () => {
    const g = startedGame({ players: 2, decks: [['Blaring Recruiter', ...LANDS], [...LANDS]] });
    holdEverywhere(g);
    const recruiter = put(g, 'p1', 'Blaring Recruiter', 'hand');
    main3(g);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: recruiter, to: { kind: 'battlefield', player: 'p1' }, faceDown: true }));
    settle(g);
    expect(g.log.some((e) => e.body.t === 'PendingTriggersAdded' && e.body.triggers.some((t) => t.label.endsWith('partner with'))), 'no partner-with trigger').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
