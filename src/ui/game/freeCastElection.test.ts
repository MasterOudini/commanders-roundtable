import { describe, expect, test, vi } from 'vitest';
import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { NO_ALT } from '../../engine/altPayment';
import { beginGrantedReview, electCasualty, grantedCastAnswer, onVeilPick } from './aimCommit';
import { fixtureCard, makeTable, settle, type TestTable } from '../../net/testing/table';
import { simplestIntent } from '../../net/testing/script';
import type { GameEvent } from '../../engine/types/events';

// D491 - the payment review opened FOR A GRANTED CAST, end to end: a real host and two loopback clients (the net testing
// table - the production path), and the table store and `aimCommit` driven exactly as the prompt and the review's buttons
// drive them. A card the grant lets the viewer cast that prints an optional cost it may pay (CR 118.9d) opens the review
// instead of being answered at once (`beginGrantedReview`); one that prints none is answered at once, as before. The
// review previews the cast free (no offer exists while the prompt is up: the client prices what the cast adds, and lists
// the casualty's creatures off its own view); the casualty is elected through D585's sacrifice pick, and what the review
// sends (`grantedCastAnswer`) is what the host takes: the Giant sacrificed as the cast completes, the spell copied.
// Sram's Expertise grants `a spell with mana value 3 or less from your hand`; Light 'Em Up ({1}{R}) is `Casualty 2`.

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

const SRAM = "Sram's Expertise";
const LIGHT = "Light 'Em Up";
const entry = (name: string) => {
  const c = fixtureCard(name);
  return { oracleId: c.oracleId, printingId: c.scryfallId };
};
const deck = (commander: string, cards: readonly (readonly [string, number])[]) => ({
  name: `${commander} test deck`,
  commanders: [entry(commander)],
  mainDeck: cards.flatMap(([name, n]) => Array.from({ length: n }, () => entry(name))),
});

/** Every prompt answered and every priority passed until `done` holds - nobody plays or casts on their own. */
function walk(table: TestTable, done: () => boolean): void {
  for (let i = 0; i < 500 && !done(); i++) {
    let moved = false;
    for (const { session: c } of table.clients) {
      const s = c.snapshot();
      const intent = s.awaiting !== null ? simplestIntent(c, s) : s.priority === s.you ? ({ t: 'PassPriority', player: s.you } as const) : null;
      if (intent === null) continue;
      c.submit(intent);
      moved = true;
      break;
    }
    if (!moved) return;
  }
}

describe('the payment review, opened for a granted cast', () => {
  test("Sram's Expertise grants Light 'Em Up: the review elects its casualty, and the host takes the answer it sends", async () => {
    const events: GameEvent[] = [];
    const table = makeTable({ onEvents: (e) => events.push(...e) });
    const ada = table.join('Ada');
    const bo = table.join('Bo');
    // Mountains in the deck: a land drop is what stops the seat in its main phase (auto-pass never skips one).
    ada.session.submitDeck(deck('Talrand, Sky Summoner', [[SRAM, 12], [LIGHT, 10], ['Hill Giant', 8], ['Mountain', 10]]));
    bo.session.submitDeck(deck('Krenko, Mob Boss', [['Grizzly Bears', 20], ['Mountain', 20]]));
    await settle();
    ada.session.setReady(true);
    bo.session.setReady(true);
    expect(table.host.start().ok).toBe(true);
    await settle();
    const p1 = ada.session;
    walk(table, () => {
      const s = p1.snapshot();
      return s.turn.active === 'p1' && s.turn.step === 'precombatMain' && s.priority === 'p1' && s.awaiting === null;
    });
    const view = () => p1.currentView();
    const named = (zone: 'hand:p1' | 'bf:p1' | 'gy:p1' | 'hand:p2' | 'bf:p2' | 'gy:p2', name: string) => (view().zones[zone] ?? []).filter((id) => view().cards[id]?.card?.name === name);
    // The board: a creature with power 2 or greater to pay the casualty, a creature of Bo's to aim at, the Expertise's mana.
    p1.submit({ t: 'ManualDraw', player: 'p1', target: 'p1', count: 10 });
    const giant = named('hand:p1', 'Hill Giant')[0];
    const bearsId = (bo.session.currentView().zones['hand:p2'] ?? []).find((id) => bo.session.currentView().cards[id]?.card?.name === 'Grizzly Bears');
    const sram = named('hand:p1', SRAM)[0];
    const light = named('hand:p1', LIGHT)[0];
    if (!giant || !bearsId || !sram || !light) throw new Error('the opening hands hold no Hill Giant, Grizzly Bears, Expertise or Light');
    p1.submit({ t: 'ManualMoveCard', player: 'p1', card: giant, to: { kind: 'battlefield', player: 'p1' } });
    bo.session.submit({ t: 'ManualMoveCard', player: 'p2', card: bearsId, to: { kind: 'battlefield', player: 'p2' } });
    p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 });
    p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 });
    p1.submit({ t: 'CastSpell', player: 'p1', card: sram });
    walk(table, () => {
      const a = p1.snapshot().awaiting;
      return a?.kind === 'chooseFromZone' && a.castFree === true;
    });
    session.beginGuest(p1, 'g-granted-casualty');
    useTable.setState({ viewer: 'p1', mode: { kind: 'idle' } });

    // A card that prints no optional cost is answered at once (the caller sends it): no review.
    const other = named('hand:p1', SRAM)[0];
    if (other !== undefined) {
      expect(beginGrantedReview(other), 'nothing to elect').toBe(false);
      expect(useTable.getState().mode.kind).toBe('idle');
    }
    // Light 'Em Up prints a casualty the board can pay: the review opens, previewing the cast free.
    expect(beginGrantedReview(light), 'a casualty to elect').toBe(true);
    let mode = useTable.getState().mode;
    expect(mode).toMatchObject({ kind: 'payment', card: light, xValue: 0, targets: [] });
    let preview = session.previewCast(light, 0, [], 0, NO_ALT, {});
    expect(preview?.free, 'the granted cast, not a CastSpell').toBe(true);
    expect(preview?.casualty, "the row: the viewer's creatures with power 2 or greater, off its view").toEqual({ candidates: [giant], floor: 2 });
    expect(preview?.plan?.taps ?? null, 'nothing to pay without it').toEqual([]);

    // Elected: D585's sacrifice pick, marked with the review; the Giant picked, back to the review, elected.
    if (mode.kind !== 'payment') throw new Error('not the review: ' + mode.kind);
    electCasualty(mode, LIGHT);
    expect(useTable.getState().mode).toMatchObject({ kind: 'sacrifice', card: light, count: 1 });
    onVeilPick({ kind: 'card', id: giant });
    mode = useTable.getState().mode;
    expect(mode, 'elected, with the pick').toMatchObject({ kind: 'payment', card: light, casualty: true, costPicks: { sacrifice: [giant] } });
    if (mode.kind !== 'payment') throw new Error('not the review: ' + mode.kind);
    preview = session.previewCast(mode.card, 0, [], 0, NO_ALT, mode.costPicks ?? {}, false, false, 0, false, false, 0, [], mode.casualty === true);
    expect(preview?.casualtyPaid, 'the review prices the casualty').toBe(true);
    expect(preview?.plan, 'and has a plan (nothing to tap)').toBeTruthy();
    if (!preview) throw new Error('no preview');

    // Sent as the review sends it: the host takes it; the cast asks for its target; the Giant is sacrificed as it completes.
    const intent = grantedCastAnswer('p1', light, preview);
    expect(intent).toEqual({ t: 'AnswerChooseFromZone', player: 'p1', cards: [light], cast: { casualty: true, sacrifice: [giant] } });
    const seq0 = p1.snapshot().rejectSeq;
    session.submit(intent);
    expect(p1.snapshot().rejectSeq === seq0 ? null : p1.snapshot().message, 'the host takes the answer the review sends').toBeNull();
    expect(p1.snapshot().awaiting?.kind, 'the cast asks for its target').toBe('chooseTargets');
    p1.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bearsId }] });
    walk(table, () => view().stack.length === 0 && p1.snapshot().awaiting === null);
    expect(named('gy:p1', 'Hill Giant'), 'the casualty').toEqual([giant]);
    expect(named('gy:p2', 'Grizzly Bears'), "the spell's target").toEqual([bearsId]);
    expect(events.filter((e) => e.body.t === 'SpellCopied').length, 'the casualty copy').toBe(1);
  });
});
