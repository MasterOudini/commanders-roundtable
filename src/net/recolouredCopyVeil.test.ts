// COPY TO: src/net/recolouredCopyVeil.test.ts (imports are relative to src/net/).
//
// D587 - THE CLIENT VEIL AIMS A RECOLOURED SPELL COPY IN THE COPY'S COLOURS (FIX-LIST 14 - the review's X8 / stc-2).
// `ClientSession.legalTargetsFor` - the aim veil's, the bot's and the net driver's opinion (D81's second adapter) - measured a
// recoloured copy by the copied CARD's printed face, while the host aims with the copy's colours (CR 707.9b / 707.10): D586
// put a Fork copy's red on its reflexive trigger's question (`sourceColors`, CR 603.7d - the copy is the trigger's source),
// and a copy's new targets (CR 707.10c) are validated with the copy's own colours. On D586's own board - p2's pro-red Kor
// Firewalker and pro-blue Scragnoth (CR 702.16b) - the veil and the host did not overlap at all: the veil lit Kor, which the
// host refuses, and hid Scragnoth, the one legal pick - and a trigger's aim has no cancel, so a human could never answer it.
// Now both questions carry the copy's colours and the veil reads them off the live prompt: it lights exactly what the host
// takes; with no recolouring (the blue original's own trigger) it still reads the printed face. A real host and two loopback
// clients (the net testing table - the production path). The cards are put in place by id off the host's own `DeckLoaded`
// (a Tier-3 move, the engine harness's `put`), so no opening hand decides the board. The replay hash on each.
import { describe, expect, test, vi } from 'vitest';
import { replay, stateHash } from '../engine/log';
import type { GameEvent } from '../engine/types/events';
import type { Intent } from '../engine/types/intents';
import { DEFAULT_STOPS } from '../engine/types/state';
import { fixtureCard, makeTable, settle, type TestTable } from './testing/table';
import { simplestIntent } from './testing/script';
import type { ClientSession } from './client';

// A host over the shipped registry walks `legalActions` on every intent (net.test.ts' measured budget).
vi.setConfig({ testTimeout: 120_000 });

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

/** Sends the intent; true when the host refused it (a refusal bumps the client's `rejectSeq`). */
async function refused(c: ClientSession, intent: Intent): Promise<boolean> {
  const seq = c.snapshot().rejectSeq;
  c.submit(intent);
  await settle();
  return c.snapshot().rejectSeq !== seq;
}
async function must(c: ClientSession, intent: Intent): Promise<void> {
  if (await refused(c, intent)) throw new Error(`the host refused ${intent.t}: ${c.snapshot().message ?? ''}`);
}

interface Board {
  readonly table: TestTable;
  readonly p1: ClientSession;
  readonly p2: ClientSession;
  readonly events: GameEvent[];
}

/** Two seats at p1's first main phase, every stop held (the engine suite's `holdEverywhere`), the host's log collected. */
async function seated(seed: string, p1Cards: readonly (readonly [string, number])[], p2Cards: readonly (readonly [string, number])[]): Promise<Board> {
  const events: GameEvent[] = [];
  const table = makeTable({ seed, onEvents: (e) => events.push(...e) });
  const ada = table.join('Ada');
  const bo = table.join('Bo');
  ada.session.submitDeck(deck('Kess, Dissident Mage', p1Cards));
  bo.session.submitDeck(deck('Krenko, Mob Boss', p2Cards));
  await settle();
  ada.session.setReady(true);
  bo.session.setReady(true);
  expect(table.host.start().ok).toBe(true);
  await settle();
  const p1 = ada.session;
  const p2 = bo.session;
  walk(table, () => {
    const s = p1.snapshot();
    return s.turn.active === 'p1' && s.turn.step === 'precombatMain' && s.priority === 'p1' && s.awaiting === null;
  });
  p1.submit({ t: 'SetStops', player: 'p1', stops: { ...DEFAULT_STOPS, mode: 'fullControl' } });
  p2.submit({ t: 'SetStops', player: 'p2', stops: { ...DEFAULT_STOPS, mode: 'fullControl' } });
  await settle();
  return { table, p1, p2, events };
}

/** The seat's first card of that name, by its id off the host's `DeckLoaded`, moved (a Tier-3 move) to where the proof needs it. */
async function put(c: ClientSession, events: readonly GameEvent[], who: 'p1' | 'p2', name: string, to: 'hand' | 'battlefield'): Promise<string> {
  const printing = fixtureCard(name).scryfallId;
  const id = events.flatMap((e) => (e.body.t === 'DeckLoaded' && e.body.player === who ? e.body.cards.filter((x) => x.printingId === printing).map((x) => x.id) : []))[0];
  if (id === undefined) throw new Error(`${who} loaded no ${name}`);
  const there = to === 'hand' ? c.currentView().zones[`hand:${who}`] : c.currentView().zones[`bf:${who}`];
  if (!(there ?? []).includes(id)) await must(c, { t: 'ManualMoveCard', player: who, card: id, to: { kind: to, player: who } });
  return id;
}

const P1_TRICK: readonly (readonly [string, number])[] = [['Faebloom Trick', 2], ['Fork', 2], ['Island', 18], ['Mountain', 18]];
const P1_ROIL: readonly (readonly [string, number])[] = [['Into the Roil', 2], ['Fork', 2], ['Island', 18], ['Mountain', 18]];
const P2_WARDS: readonly (readonly [string, number])[] = [['Kor Firewalker', 2], ['Scragnoth', 2], ['Mountain', 36]];

describe('D587 - the client veil aims a recoloured spell copy in its own colours', () => {
  test("a Fork copy's reflexive trigger: the veil lights exactly what the host takes - Scragnoth, never Kor; the blue original's own lights Kor", async () => {
    const seed = 'd587-colours-veil-trigger';
    const { table, p1, p2, events } = await seated(seed, P1_TRICK, P2_WARDS);
    const trick = await put(p1, events, 'p1', 'Faebloom Trick', 'hand');
    const fork = await put(p1, events, 'p1', 'Fork', 'hand');
    const kor = await put(p2, events, 'p2', 'Kor Firewalker', 'battlefield');
    const scrag = await put(p2, events, 'p2', 'Scragnoth', 'battlefield');
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: trick });
    const trickObj = p1.currentView().stack[0]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: trickObj }] });
    walk(table, () => p1.snapshot().awaiting?.kind === 'chooseTargets');
    const ask = p1.snapshot().awaiting;
    if (ask?.kind !== 'chooseTargets' || ask.forKind !== 'trigger') throw new Error("the red copy's trigger asked for no aim");
    expect(ask.sourceColors, "the question carries the red copy's colours (D586)").toEqual(['R']);
    expect(p1.legalTargetsFor(ask.specs, ask.source), 'the veil lights Scragnoth alone').toEqual([{ kind: 'card', id: scrag }]);
    expect(simplestIntent(p1, p1.snapshot()), 'the net driver aims where the veil lights').toEqual({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: scrag }] });
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: kor }] }), 'the host refuses the pro-red Kor').toBe(true);
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: scrag }] }), 'and takes Scragnoth').toBe(false);
    // The blue original's own trigger, asked with no recolouring: the printed face - Kor alone, as the host rules.
    walk(table, () => p1.snapshot().awaiting?.kind === 'chooseTargets');
    const again = p1.snapshot().awaiting;
    if (again?.kind !== 'chooseTargets' || again.forKind !== 'trigger' || again.stackId === ask.stackId) throw new Error("the blue original's trigger asked for no aim");
    expect(again.sourceColors, 'no recolouring on the original').toBeUndefined();
    expect(p1.legalTargetsFor(again.specs, again.source), 'the veil lights Kor alone').toEqual([{ kind: 'card', id: kor }]);
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: scrag }] }), 'the host refuses the pro-blue Scragnoth').toBe(true);
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: kor }] }), 'and takes Kor').toBe(false);
    expect(stateHash(replay(events, seed)), 'the log replays').toBe(table.host.hash());
  });

  test("a Fork copy's new targets: the veil lights as the red copy - Scragnoth, never Kor - exactly what the host takes", async () => {
    const seed = 'd587-colours-veil-copy';
    const { table, p1, p2, events } = await seated(seed, P1_ROIL, P2_WARDS);
    const roil = await put(p1, events, 'p1', 'Into the Roil', 'hand');
    const fork = await put(p1, events, 'p1', 'Fork', 'hand');
    const kor = await put(p2, events, 'p2', 'Kor Firewalker', 'battlefield');
    const scrag = await put(p2, events, 'p2', 'Scragnoth', 'battlefield');
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: roil, targets: [{ kind: 'card', id: kor }] });
    const roilObj = p1.currentView().stack[0]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: roilObj }] });
    walk(table, () => p1.snapshot().awaiting?.kind === 'chooseTargets');
    const ask = p1.snapshot().awaiting;
    if (ask?.kind !== 'chooseTargets' || ask.forKind !== 'copy') throw new Error('the copy asked for no new targets');
    expect(ask.sourceColors, "the copy's new targets are asked in its red").toEqual(['R']);
    expect(p1.legalTargetsFor(ask.specs, ask.source), 'the veil lights Scragnoth alone').toEqual([{ kind: 'card', id: scrag }]);
    expect(simplestIntent(p1, p1.snapshot()), 'the net driver aims where the veil lights').toEqual({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: scrag }] });
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: kor }] }), 'the host refuses the pro-red Kor').toBe(true);
    expect(await refused(p1, { t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: scrag }] }), 'and takes Scragnoth').toBe(false);
    expect(stateHash(replay(events, seed)), 'the log replays').toBe(table.host.hash());
  });
});
