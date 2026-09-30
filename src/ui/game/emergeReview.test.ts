import { describe, expect, test, vi } from 'vitest';
import * as session from '../../game/session';
import { NO_ALT } from '../../engine/altPayment';
import { DEFAULT_STOPS } from '../../engine/types/state';
import { fixtureCard, makeTable, settle, type TestTable } from '../../net/testing/table';
import { simplestIntent } from '../../net/testing/script';

// D589 - the payment review PRICES EMERGE as the host charges it (D53), end to end: a real host and two loopback clients
// (the net testing table - the production path). Wretched Gryff (`Emerge {5}{U}`, mana value 7): with {1}{U} floating,
// the preview picking Grizzly Bears (mana value 2) has no plan ({3}{U} is due), picking Hill Giant (mana value 4) has one
// ({1}{U}); the cast the review sends with that plan is taken - the Giant sacrificed, the Gryff on the battlefield.

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

const GRYFF = 'Wretched Gryff';
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

describe('the payment review prices emerge', () => {
  test("the sacrificed creature's mana value comes off the preview's cost; the host charges what the preview priced", async () => {
    const table = makeTable();
    const ada = table.join('Ada');
    const bo = table.join('Bo');
    ada.session.submitDeck(deck('Talrand, Sky Summoner', [[GRYFF, 13], ['Hill Giant', 13], ['Grizzly Bears', 14]]));
    bo.session.submitDeck(deck('Krenko, Mob Boss', [['Mountain', 40]]));
    await settle();
    ada.session.setReady(true);
    bo.session.setReady(true);
    expect(table.host.start().ok).toBe(true);
    await settle();
    const p1 = ada.session;
    // Full control: a hand with no land auto-passes every main phase otherwise.
    p1.submit({ t: 'SetStops', player: 'p1', stops: { ...DEFAULT_STOPS, mode: 'fullControl' } });
    await settle();
    walk(table, () => {
      const s = p1.snapshot();
      return s.turn.active === 'p1' && s.turn.step === 'precombatMain' && s.priority === 'p1' && s.awaiting === null;
    });
    const view = () => p1.currentView();
    const named = (zone: 'hand:p1' | 'bf:p1' | 'gy:p1', name: string) => (view().zones[zone] ?? []).filter((id) => view().cards[id]?.card?.name === name);
    const gryff = named('hand:p1', GRYFF)[0];
    const giant = named('hand:p1', 'Hill Giant')[0];
    const bears = named('hand:p1', 'Grizzly Bears')[0];
    if (!gryff || !giant || !bears) throw new Error('the opening seven holds no Wretched Gryff, Hill Giant and Grizzly Bears');
    // The board the emerge needs: two creatures to choose between, and {1}{U}.
    p1.submit({ t: 'ManualMoveCard', player: 'p1', card: giant, to: { kind: 'battlefield', player: 'p1' } });
    p1.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'battlefield', player: 'p1' } });
    p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 });
    p1.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 });
    await settle();
    session.beginGuest(p1, 'g-emerge');

    const plain = session.previewCast(gryff, 0, [], 0, NO_ALT, {});
    expect(plain?.plan, 'the plain {5}{U} has no plan').toBeNull();
    expect(plain?.alternativeCost?.candidates, 'the offer lists the Giant (4) before the Bears (2)').toEqual([giant, bears]);
    const withBears = session.previewCast(gryff, 0, [], 0, NO_ALT, { sacrifice: [bears] }, true);
    expect(withBears?.plan, 'the Bears take 2 off: {3}{U} is due').toBeNull();
    const withGiant = session.previewCast(gryff, 0, [], 0, NO_ALT, { sacrifice: [giant] }, true);
    expect(withGiant?.alternative).toBe(true);
    expect(withGiant?.plan, 'the Giant takes 4 off: {1}{U} is paid').toBeTruthy();

    // Sent as the review sends it: the host takes it - the Giant sacrificed, the Gryff resolved.
    const seq0 = p1.snapshot().rejectSeq;
    session.submit({ t: 'CastSpell', player: 'p1', card: gryff, alternative: true, sacrifice: [giant], ...(withGiant?.plan ? { plan: withGiant.plan } : {}), targets: [] });
    expect(p1.snapshot().rejectSeq === seq0 ? null : p1.snapshot().message, 'the host takes the cast the review sends').toBeNull();
    walk(table, () => named('bf:p1', GRYFF).length > 0);
    expect(named('gy:p1', 'Hill Giant'), 'the emerge sacrifice').toEqual([giant]);
    expect(named('bf:p1', GRYFF)).toEqual([gryff]);
    expect(named('bf:p1', 'Grizzly Bears'), 'the Bears stay').toEqual([bears]);
  });
});
