// COPY TO: src/bot/botRecolouredCopy.test.ts (imports are relative to src/bot/).
//
// D587 - THE BOT AIMS A RECOLOURED SPELL COPY IN THE COPY'S COLOURS (FIX-LIST 14 - the review's X8 / stc-2). Over the REAL
// host and loopback clients (the net testing table - the production path), p1's level-1 runner answers the two questions a
// Fork copy raises: its reflexive trigger's aim (D586's own board - Faebloom Trick copied by Fork: the red copy's `When you
// do, tap target creature an opponent controls` may tap the pro-blue Scragnoth and never the pro-red Kor Firewalker - CR
// 603.7d, 702.16b) and a copy's new targets (Into the Roil copied by Fork - CR 707.10c). The bot plans through the client's
// veil (`planTargets` over `legalTargetsFor`), which read the copied card's printed blue: the trigger's first pick (Kor) was
// refused and D586's next-candidate retry found nothing (`noIntentForAwaiting` - the seat stopped); the copy's pick was
// refused. Now the veil reads the copy's colours off the question, and the host takes the bot's first answer both times; the
// blue original's own trigger is still aimed by its printed face (Kor). The test casts for p1 by hand and steps the runner at
// p1's aims only; the cards are put in place by id off the host's own `DeckLoaded`. The log replays.
import { describe, expect, test, vi } from 'vitest';
import { replay, stateHash } from '../engine/log';
import type { GameEvent } from '../engine/types/events';
import type { Intent } from '../engine/types/intents';
import { DEFAULT_STOPS, type TargetChoice } from '../engine/types/state';
import { fixtureCard, makeTable, settle, type TestTable } from '../net/testing/table';
import { simplestIntent } from '../net/testing/script';
import type { ClientSession } from '../net/client';
import { createRunner, type BotFault, type BotRunner } from './runner';
import type { BotPort } from './types';

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
  readonly runner: BotRunner;
  readonly faults: BotFault[];
}

/** Two seats at p1's first main phase, every stop held, the host's log collected, and p1's level-1 runner (stepped by hand). */
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
  const faults: BotFault[] = [];
  const runner = createRunner({
    port: p1 as unknown as BotPort,
    cfg: { level: 1, thinkMs: 0 },
    clock: { delay: () => () => undefined, settled: () => true },
    submit: (intent) => p1.submit(intent),
    onFault: (f: BotFault) => faults.push(f),
  });
  return { table, p1, p2, events, runner, faults };
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

/** The targets the host recorded for a stack object (its `StackTargetsSet`). */
function aimOf(events: readonly GameEvent[], stackId: string): readonly TargetChoice[] | undefined {
  for (const e of events) if (e.body.t === 'StackTargetsSet' && e.body.stackId === stackId) return e.body.targets;
  return undefined;
}

/** p1 is asked to aim (a trigger's targets or a copy's new ones). */
function aiming(p1: ClientSession): boolean {
  const a = p1.snapshot().awaiting;
  return a?.kind === 'chooseTargets' && a.player === 'p1';
}

const P2_WARDS: readonly (readonly [string, number])[] = [['Kor Firewalker', 2], ['Scragnoth', 2], ['Mountain', 36]];

describe('D587 - the bot aims a recoloured spell copy in its own colours', () => {
  test("a Fork copy's reflexive trigger: the bot's first pick is Scragnoth and the host takes it; the blue original's is Kor; no fault", async () => {
    const seed = 'd587-colours-bot-trigger';
    const { table, p1, p2, events, runner, faults } = await seated(seed, [['Faebloom Trick', 2], ['Fork', 2], ['Island', 18], ['Mountain', 18]], P2_WARDS);
    const trick = await put(p1, events, 'p1', 'Faebloom Trick', 'hand');
    const fork = await put(p1, events, 'p1', 'Fork', 'hand');
    const kor = await put(p2, events, 'p2', 'Kor Firewalker', 'battlefield');
    const scrag = await put(p2, events, 'p2', 'Scragnoth', 'battlefield');
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: trick });
    const trickObj = p1.currentView().stack[0]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: trickObj }] });
    walk(table, () => aiming(p1));
    const ask = p1.snapshot().awaiting;
    if (ask?.kind !== 'chooseTargets' || ask.forKind !== 'trigger') throw new Error("the red copy's trigger asked for no aim");
    const seq = p1.snapshot().rejectSeq;
    expect(runner.step(), 'the bot answers the aim').toBe(true);
    await settle();
    expect(p1.snapshot().rejectSeq, "the host took the bot's first pick - no refusal").toBe(seq);
    expect(aimOf(events, ask.stackId), "the red copy's trigger aimed at the pro-blue Scragnoth").toEqual([{ kind: 'card', id: scrag }]);
    expect(ask.sourceColors, "asked in the red copy's colours").toEqual(['R']);
    // The rest of the stack, the bot answering its own aims: the red copy's trigger resolves, then the blue original's is asked.
    for (let i = 0; i < 10 && p1.currentView().stack.length > 0 && faults.length === 0; i++) {
      walk(table, () => aiming(p1) || p1.currentView().stack.length === 0);
      if (!aiming(p1)) continue;
      runner.step();
      await settle();
    }
    expect(faults, 'no bot fault - the seat was never stopped').toEqual([]);
    expect(p1.currentView().stack.length, 'the stack resolved').toBe(0);
    expect(p1.currentView().cards[scrag]?.tapped, "the red copy's payload tapped Scragnoth").toBe(true);
    expect(p1.currentView().cards[kor]?.tapped, "the blue original's tapped Kor").toBe(true);
    expect(stateHash(replay(events, seed)), 'the log replays').toBe(table.host.hash());
  });

  test("a Fork copy's new targets: the bot re-aims the red copy at Scragnoth and the host takes its first answer", async () => {
    const seed = 'd587-colours-bot-copy';
    const { table, p1, p2, events, runner, faults } = await seated(seed, [['Into the Roil', 2], ['Fork', 2], ['Island', 18], ['Mountain', 18]], P2_WARDS);
    const roil = await put(p1, events, 'p1', 'Into the Roil', 'hand');
    const fork = await put(p1, events, 'p1', 'Fork', 'hand');
    const kor = await put(p2, events, 'p2', 'Kor Firewalker', 'battlefield');
    const scrag = await put(p2, events, 'p2', 'Scragnoth', 'battlefield');
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: roil, targets: [{ kind: 'card', id: kor }] });
    const roilObj = p1.currentView().stack[0]?.stackItemId ?? '';
    await must(p1, { t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 });
    await must(p1, { t: 'CastSpell', player: 'p1', card: fork, targets: [{ kind: 'stack', id: roilObj }] });
    walk(table, () => aiming(p1));
    const ask = p1.snapshot().awaiting;
    if (ask?.kind !== 'chooseTargets' || ask.forKind !== 'copy') throw new Error('the copy asked for no new targets');
    const seq = p1.snapshot().rejectSeq;
    expect(runner.step(), 'the bot answers the copy').toBe(true);
    await settle();
    expect(p1.snapshot().rejectSeq, "the host took the bot's first answer - no refusal").toBe(seq);
    expect(aimOf(events, ask.stackId), 'the red copy re-aimed at the pro-blue Scragnoth, never the pro-red Kor').toEqual([{ kind: 'card', id: scrag }]);
    expect(ask.sourceColors, "asked in the copy's red").toEqual(['R']);
    expect(faults, 'no bot fault').toEqual([]);
    expect(stateHash(replay(events, seed)), 'the log replays').toBe(table.host.hash());
  });
});
