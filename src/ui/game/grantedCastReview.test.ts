// Copy to src/ui/game/. D587 - THE GRANTED CAST'S REVIEW AND ITS BACK-OUT, end to end: a real host and two loopback clients
// (the net testing table - the production path), the table store and `aimCommit` driven as the prompt bar and the payment
// review drive them. FIX-LIST 9, 10 and 11 (the review's freecast FC-1 to FC-4): the review previews a granted cast from the
// host's facts for this seat (`SessionState.granted`) - a hand card outside the grant's bound opens no review, though its
// kick is payable (Baloth Gorger is mana value 4 under Sram's Expertise's 3 - FC-4); the casualty's creatures are the host's
// derived list, a face-down 2/2 among them (FC-3); a kick is priced with the board's reduction and charged as previewed
// (Helm of Awakening under Kavu Titan's kicker - FC-2, D53); and Cancel on a granted cast's targets prompt backs the cast
// out to its prompt, where Escape alone re-arms the aim (FC-1, CR 601.2). The host's log replays to its hash on each.
import { describe, expect, test, vi } from 'vitest';
import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { NO_ALT } from '../../engine/altPayment';
import { replay, stateHash } from '../../engine/log';
import { poolTotal } from '../../engine/types/mana';
import { beginGrantedReview, cancelAim, electCasualty, grantedCastAnswer, onVeilPick } from './aimCommit';
import { fixtureCard, makeTable, settle, type TestTable } from '../../net/testing/table';
import { simplestIntent } from '../../net/testing/script';
import type { GameEvent } from '../../engine/types/events';

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

const SEED = 'net-test-seed';
const SRAM = "Sram's Expertise";
const LIGHT = "Light 'Em Up";
type Sym = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
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

/**
 * Ada's main phase with Sram's Expertise and `hand` drawn into her hand, `board` moved onto her battlefield (face down where
 * marked) and a Grizzly Bears onto Bo's, `pay` floating; the Expertise cast and resolved to its grant - the chooser up for
 * Ada, whose client is the session's guest, the table idle.
 */
async function granted(hand: readonly string[], board: readonly { readonly name: string; readonly faceDown?: true }[], pay: readonly (readonly [Sym, number])[]) {
  const events: GameEvent[] = [];
  const table = makeTable({ seed: SEED, onEvents: (e) => events.push(...e) });
  const ada = table.join('Ada');
  const bo = table.join('Bo');
  const names = [...new Set([...hand, ...board.map((b) => b.name)])];
  // Plains in the deck: a land drop is what stops the seat in its main phase (auto-pass never skips one).
  ada.session.submitDeck(deck('Talrand, Sky Summoner', [[SRAM, 10], ...names.map((name) => [name, 6] as const), ['Plains', 30 - 6 * names.length]]));
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
  // Drawn until the hand holds what the scenario needs (the opening seven is the seed's).
  const want = [SRAM, ...hand, ...board.map((b) => b.name)];
  const short = () => want.some((name) => named('hand:p1', name).length < want.filter((n) => n === name).length);
  for (let i = 0; i < 40 && short(); i++) p1.submit({ t: 'ManualDraw', player: 'p1', target: 'p1', count: 1 });
  const taken = new Set<string>();
  const take = (name: string): string => {
    const id = named('hand:p1', name).find((c) => !taken.has(c));
    if (id === undefined) throw new Error(`the hand holds no ${name}`);
    taken.add(id);
    return id;
  };
  const sram = take(SRAM);
  const inHand = hand.map(take);
  const onBoard = board.map((b) => {
    const id = take(b.name);
    p1.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' }, ...(b.faceDown === true ? { faceDown: true } : {}) });
    return id;
  });
  const theirs = bo.session.currentView();
  const bears = (theirs.zones['hand:p2'] ?? []).find((id) => theirs.cards[id]?.card?.name === 'Grizzly Bears');
  if (bears === undefined) throw new Error("Bo's hand holds no Grizzly Bears");
  bo.session.submit({ t: 'ManualMoveCard', player: 'p2', card: bears, to: { kind: 'battlefield', player: 'p2' } });
  for (const [symbol, amount] of pay) p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount });
  p1.submit({ t: 'CastSpell', player: 'p1', card: sram });
  walk(table, () => {
    const a = p1.snapshot().awaiting;
    return a?.kind === 'chooseFromZone' && a.castFree === true;
  });
  const up = p1.snapshot().awaiting;
  if (up?.kind !== 'chooseFromZone' || up.castFree !== true) throw new Error(`no grant up: ${up?.kind ?? 'none'}`);
  session.beginGuest(p1, 'g-granted-review');
  useTable.setState({ viewer: 'p1', mode: { kind: 'idle' } });
  const replays = () => expect(stateHash(replay(events, SEED)), 'the log replays').toBe(table.host.hash());
  return { table, events, p1, view, named, inHand, onBoard, bears, replays };
}

describe('D587 - the granted cast: its review from the host facts, and its back-out', () => {
  test("a hand card outside the grant's bound opens no review, though its kick is payable: Baloth Gorger is mana value 4 (FC-4)", async () => {
    // {W}{W}{C}{C} pay the Expertise; four {C} float - Baloth Gorger's whole Kicker {4}.
    const { inHand, replays } = await granted(['Grizzly Bears', 'Baloth Gorger'], [], [['W', 2], ['C', 6]]);
    const [bears, gorger] = inHand as [string, string];
    expect(session.previewCast(bears)?.free, 'an admitted card previews its granted cast').toBe(true);
    expect(session.previewCast(gorger), "nothing to preview for a card the grant does not admit (the host's own reader)").toBeNull();
    expect(beginGrantedReview(gorger), 'no review for a cast the host would refuse').toBe(false);
    expect(useTable.getState().mode.kind).toBe('idle');
    replays();
  });

  test("the review's casualty creatures are the host's derived list: a face-down Hill Giant is a 2/2 and pays Light 'Em Up's casualty 2 (FC-3)", async () => {
    const { table, events, p1, view, named, inHand, onBoard, bears, replays } = await granted([LIGHT], [{ name: 'Hill Giant', faceDown: true }], [['W', 2], ['C', 2]]);
    const [light] = inHand as [string];
    const [giant] = onBoard as [string];
    expect(view().cards[giant]?.faceDown, 'the Giant is face down').toBe(true);
    expect(session.previewCast(light)?.casualty, "the host's list: the face-down 2/2 (a Servo's power is 1)").toEqual({ candidates: [giant], floor: 2 });
    expect(beginGrantedReview(light), 'a casualty to elect').toBe(true);
    let mode = useTable.getState().mode;
    if (mode.kind !== 'payment') throw new Error('not the review: ' + mode.kind);
    // Elected: D585's sacrifice pick, marked with the review; the Giant picked, back to the review, elected.
    electCasualty(mode, LIGHT);
    onVeilPick({ kind: 'card', id: giant });
    mode = useTable.getState().mode;
    expect(mode, 'elected, with the pick').toMatchObject({ kind: 'payment', card: light, casualty: true, costPicks: { sacrifice: [giant] } });
    if (mode.kind !== 'payment') throw new Error('not the review: ' + mode.kind);
    const preview = session.previewCast(mode.card, 0, [], 0, NO_ALT, mode.costPicks ?? {}, false, false, 0, false, false, 0, [], mode.casualty === true);
    if (!preview) throw new Error('no preview');
    expect(preview.casualtyPaid, 'the review prices the casualty').toBe(true);
    // Sent as the review sends it: the host takes it; the cast asks for its target; the Giant is sacrificed as it completes.
    const seq0 = p1.snapshot().rejectSeq;
    session.submit(grantedCastAnswer('p1', light, preview));
    expect(p1.snapshot().rejectSeq === seq0 ? null : p1.snapshot().message, 'the host takes the answer the review sends').toBeNull();
    expect(p1.snapshot().awaiting?.kind, 'the cast asks for its target').toBe('chooseTargets');
    p1.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] });
    walk(table, () => view().stack.length === 0 && p1.snapshot().awaiting === null);
    expect(named('gy:p1', 'Hill Giant'), 'the casualty').toEqual([giant]);
    expect(events.filter((e) => e.body.t === 'SpellCopied').length, 'the casualty copy').toBe(1);
    replays();
  });

  test("the review prices the board's reduction on a granted kick: Helm of Awakening makes Kavu Titan's {2}{G} kicker {1}{G}, charged as shown (FC-2, D53)", async () => {
    // The Helm cuts the Expertise to {1}{W}{W}: nothing floats.
    const { table, p1, view, inHand, replays } = await granted(['Kavu Titan'], [{ name: 'Helm of Awakening' }], [['W', 2], ['C', 1]]);
    const [titan] = inHand as [string];
    p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 });
    p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 });
    expect(beginGrantedReview(titan), 'a kick the reduced cost can pay: two float').toBe(true);
    const kicked = session.previewCast(titan, 0, [], 1);
    if (!kicked?.plan) throw new Error('the kicked review has no plan');
    expect(poolTotal(kicked.plan.spendFromPool), "the review pays {1}{G} - the Helm's {1} off the kick").toBe(2);
    const seq0 = p1.snapshot().rejectSeq;
    session.submit(grantedCastAnswer('p1', titan, kicked));
    expect(p1.snapshot().rejectSeq === seq0 ? null : p1.snapshot().message, 'the host takes the kicked answer').toBeNull();
    walk(table, () => view().stack.length === 0 && p1.snapshot().awaiting === null);
    expect(view().cards[titan]?.counters['+1/+1'], 'the kicked entry').toBe(3);
    const left = view().seats.p1?.manaPool;
    expect(left ? Object.values(left).reduce((a, b) => a + b, 0) : null, 'the host charged the two the review showed').toBe(0);
    replays();
  });

  test("Cancel on a granted cast's targets prompt backs the cast out to its prompt, the card back in hand (FC-1, CR 601.2)", async () => {
    const { p1, view, inHand, replays } = await granted(['Lightning Bolt'], [], [['W', 2], ['C', 2]]);
    const [bolt] = inHand as [string];
    p1.submit({ t: 'AnswerChooseFromZone', player: 'p1', cards: [bolt] });
    const aim = p1.snapshot().awaiting;
    if (aim?.kind !== 'chooseTargets' || aim.forKind !== 'spell') throw new Error(`no targets prompt: ${aim?.kind ?? 'none'}`);
    // The veil armed as `useEngineTable` arms it for a live targets prompt (D169) - the engine's own question.
    useTable.setState({ mode: { kind: 'targeting', source: { kind: 'stack', card: bolt }, name: aim.label, chosen: [], specs: aim.specs, min: aim.count, max: aim.specs.reduce((n, s) => n + s.max, 0), next: 'answer' } });
    cancelAim();
    expect(useTable.getState().mode.kind, 'the aim dropped').toBe('idle');
    expect(p1.snapshot().awaiting, 'the grant asks again').toMatchObject({ kind: 'chooseFromZone', player: 'p1', castFree: true });
    expect(view().zones['hand:p1'] ?? [], 'the Bolt back in hand').toContain(bolt);
    replays();
  });
});
