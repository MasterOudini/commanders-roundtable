import { describe, expect, test, vi } from 'vitest';
import { DEFAULT_STOPS } from '../engine/types/state';
import type { Intent } from '../engine/types/intents';
import { fixtureCard, makeTable, settle, type TestTable } from './testing/table';
import { simplestIntent } from './testing/script';
import type { ClientSession } from './client';

// D625 - THE PREPARED CAST FROM THE TABLE. A prepared permanent offers its spell's copy (face 1) from the battlefield;
// the client aimed a cast of a battlefield card with the view's face - the creature's, face 0 - so the veil, the bot's
// planner and the random bot read no target where the spell has one. The client now aims a prepared permanent's cast
// with its SPELL's clauses, previews its cost, and the host reads a cast naming the permanent with no face (the table's
// click names none for a one-face offer) as the spell's. A real host and two loopback clients (the production path).

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

const PAGE = "Honorbound Page // Forum's Favor";
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

/** Two seats at p1's first main phase, every stop held. */
async function seated(p1Deck: ReturnType<typeof deck>, p2Deck: ReturnType<typeof deck>): Promise<{ table: TestTable; p1: ClientSession }> {
  const table = makeTable();
  const ada = table.join('Ada');
  const bo = table.join('Bo');
  ada.session.submitDeck(p1Deck);
  bo.session.submitDeck(p2Deck);
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
  p1.submit({ t: 'SetStops', player: 'p1', stops: { ...DEFAULT_STOPS, mode: 'fullControl' } });
  bo.session.submit({ t: 'SetStops', player: 'p2', stops: { ...DEFAULT_STOPS, mode: 'fullControl' } });
  await settle();
  return { table, p1 };
}

const inHand = (c: ClientSession, name: string) => (c.currentView().zones['hand:p1'] ?? []).filter((id) => c.currentView().cards[id]?.card?.name === name);
async function must(c: ClientSession, intent: Intent): Promise<void> {
  const seq = c.snapshot().rejectSeq;
  c.submit(intent);
  await settle();
  if (c.snapshot().rejectSeq !== seq) throw new Error(`the host refused ${intent.t}: ${c.snapshot().message ?? ''}`);
}

describe('D625 - the prepared cast from the table', () => {
  test('a prepared permanent is aimed and priced as its spell, and a cast naming no face casts the spell', async () => {
    const { table, p1 } = await seated(
      deck('Akroma, Angel of Wrath', [[PAGE, 20], ['Plains', 20]]),
      deck('Krenko, Mob Boss', [['Mountain', 40]]),
    );
    const page = inHand(p1, PAGE)[0];
    if (!page) throw new Error('the opening hand holds no Honorbound Page');
    await must(p1, { t: 'ManualMoveCard', player: 'p1', card: page, to: { kind: 'battlefield', player: 'p1' } });
    expect(p1.currentView().cards[page]?.prepared, 'it enters prepared').toBe(true);
    const offer = p1.snapshot().legal.find((a) => a.t === 'CastSpell' && a.card === page);
    expect(offer?.t === 'CastSpell' ? [offer.faceIndex, offer.from.kind, offer.label] : null).toEqual([1, 'battlefield', "Forum's Favor"]);
    expect(p1.targetSpecsFor(page).map((s) => s.text), "Forum's Favor aims, the creature face does not").toEqual(['Target creature']);
    expect(p1.targetSpecsFor(page).length).toBe(1);
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 });
    const p0 = p1.currentView().cards[page]?.power ?? 0;
    const preview = p1.previewCast(page, 0, [{ kind: 'card', id: page }]);
    expect(preview?.name).toBe("Forum's Favor");
    expect(preview?.cost).toBe('{W}');
    await must(p1, { t: 'CastSpell', player: 'p1', card: page, targets: [{ kind: 'card', id: page }], ...(preview?.plan ? { plan: preview.plan } : {}) });
    walk(table, () => p1.currentView().stack.length === 0 && p1.snapshot().awaiting === null);
    expect(p1.currentView().cards[page]?.prepared, 'the cast unprepared it').toBeUndefined();
    expect(p1.currentView().cards[page]?.power, 'Forum' + String.fromCharCode(39) + 's Favor: +1/+0 on the Page').toBe(p0 + 1);
  });
});
