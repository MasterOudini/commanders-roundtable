import { describe, expect, test, vi } from 'vitest';
import * as session from '../../game/session';
import { useTable } from '../../store/tableStore';
import { NO_ALT } from '../../engine/altPayment';
import { electCasualty, onVeilPick } from './aimCommit';
import { fixtureCard, makeTable, settle, type TestTable } from '../../net/testing/table';
import { simplestIntent } from '../../net/testing/script';

// D585 - the payment review PAYS CASUALTY, end to end: a real host and two loopback clients (the net testing table - the
// production path), and the table store and `aimCommit` driven exactly as the review's buttons drive them. The review's
// casualty row elects the one-creature sacrifice pick (the veil reads the offer's `casualtyCandidates` - the power floor
// applied host-side), a back-out returns to the review unpaid, the pick returns to it elected; and what the preview priced
// is what the host charges (D53): the cast the review sends is taken, the creature is sacrificed and the spell copied.
// Join the Maestros ({4}{B} sorcery): `Casualty 2` + `Create a 4/3 black Ogre Warrior creature token.`

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

const MAESTROS = 'Join the Maestros';
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

describe('the payment review pays casualty', () => {
  test('the sacrifice picked from the review, backed out and picked again; the host charges what the preview priced', async () => {
    const table = makeTable();
    const ada = table.join('Ada');
    const bo = table.join('Bo');
    ada.session.submitDeck(deck('Talrand, Sky Summoner', [[MAESTROS, 13], ['Swamp', 14], ['Hill Giant', 13]]));
    bo.session.submitDeck(deck('Krenko, Mob Boss', [['Mountain', 40]]));
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
    const named = (zone: 'hand:p1' | 'bf:p1' | 'gy:p1', name: string) => (view().zones[zone] ?? []).filter((id) => view().cards[id]?.card?.name === name);
    const maestros = named('hand:p1', MAESTROS)[0];
    const giant = named('hand:p1', 'Hill Giant')[0];
    if (!maestros || !giant) throw new Error('the opening seven holds no Join the Maestros and Hill Giant');
    // The board the cast needs: a creature with power 2 or greater, and the spell's mana.
    p1.submit({ t: 'ManualMoveCard', player: 'p1', card: giant, to: { kind: 'battlefield', player: 'p1' } });
    p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 5 });
    session.beginGuest(p1, 'g-casualty');

    // The review, reached with no targets (the spell has none): the casualty row offers the Giant, unpaid.
    useTable.setState({ viewer: 'p1', mode: { kind: 'payment', card: maestros, xValue: 0, targets: [] } });
    let preview = session.previewCast(maestros, 0, [], 0, NO_ALT, {});
    expect(preview?.casualty, 'the row: the creatures with power 2 or greater, and the floor').toEqual({ candidates: [giant], floor: 2 });
    expect(preview?.casualtyPaid).toBe(false);

    // Elected: the one-creature sacrifice pick, marked with the review; Escape returns to the review, unpaid.
    let mode = useTable.getState().mode;
    if (mode.kind !== 'payment') throw new Error('not the review: ' + mode.kind);
    electCasualty(mode, MAESTROS);
    expect(useTable.getState().mode).toMatchObject({ kind: 'sacrifice', card: maestros, count: 1 });
    useTable.getState().escape();
    mode = useTable.getState().mode;
    expect(mode, 'back to the review, casualty unpaid').toMatchObject({ kind: 'payment', card: maestros });
    expect(mode.kind === 'payment' ? mode.casualty : 'not the review').toBeUndefined();

    // Elected again and the Giant picked: back to the review, elected, the sacrifice its pick.
    if (mode.kind !== 'payment') throw new Error('not the review: ' + mode.kind);
    electCasualty(mode, MAESTROS);
    onVeilPick({ kind: 'card', id: giant });
    mode = useTable.getState().mode;
    expect(mode, 'elected, with the pick').toMatchObject({ kind: 'payment', card: maestros, casualty: true, costPicks: { sacrifice: [giant] } });
    if (mode.kind !== 'payment') throw new Error('not the review: ' + mode.kind);
    preview = session.previewCast(mode.card, mode.xValue, mode.targets, 0, NO_ALT, mode.costPicks ?? {}, false, false, 0, false, false, 0, [], mode.casualty === true);
    expect(preview?.casualtyPaid, 'the review prices the casualty').toBe(true);
    expect(preview?.plan, 'and has a plan for the mana').toBeTruthy();

    // Sent as the review sends it: the host takes it - the Giant sacrificed, the spell copied, two Ogre Warriors.
    const seq0 = p1.snapshot().rejectSeq;
    session.submit({
      t: 'CastSpell',
      player: 'p1',
      card: mode.card,
      ...(preview?.casualtyPaid ? { casualty: true } : {}),
      ...(preview?.costPicks.sacrifice ? { sacrifice: preview.costPicks.sacrifice } : {}),
      ...(preview?.plan ? { plan: preview.plan } : {}),
      targets: mode.targets,
    });
    expect(p1.snapshot().rejectSeq === seq0 ? null : p1.snapshot().message, 'the host takes the cast the review sends').toBeNull();
    walk(table, () => named('bf:p1', 'Ogre Warrior').length >= 2 && named('gy:p1', MAESTROS).length > 0);
    expect(named('gy:p1', 'Hill Giant'), 'the casualty').toEqual([giant]);
    expect(named('bf:p1', 'Ogre Warrior'), 'the spell and its copy').toHaveLength(2);
  });
});
