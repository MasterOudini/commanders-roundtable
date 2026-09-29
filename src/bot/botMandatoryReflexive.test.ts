// D586 - THE BOT ANSWERS A MANDATORY REFLEXIVE TRIGGER'S AIM (the judge's proof 7): over the REAL host and a loopback client
// (the net testing table - the production path), the level-1 bot's runner casts Faebloom Trick in its main phase; the spell
// declares no target, makes its two Faeries, and its `When you do` trigger - D584's marker after the action - asks the bot
// for its aim, which the bot's own planner answers (a harmful tap: the opponent's creature). No fault, no wedge; the log
// replays.
import { describe, expect, test, vi } from 'vitest';
import { replay, stateHash } from '../engine/log';
import type { GameEvent } from '../engine/types/events';
import { fixtureCard, makeTable, settle } from '../net/testing/table';
import { simplestIntent } from '../net/testing/script';
import { createRunner, type BotFault } from './runner';
import { BOT_STOPS, type BotPort } from './types';

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

describe('D586 - the bot answers a mandatory reflexive trigger', () => {
  test('the bot casts Faebloom Trick, answers the payload aim itself, and taps the opponent creature (a Wall)', async () => {
    const events: GameEvent[] = [];
    const table = makeTable({ seed: 'd586-bot-mandatory', onEvents: (e) => events.push(...e) });
    const ada = table.join('Ada');
    const bo = table.join('Bo');
    ada.session.submitDeck(deck('Talrand, Sky Summoner', [['Faebloom Trick', 20], ['Island', 20]]));
    bo.session.submitDeck(deck('Krenko, Mob Boss', [['Wall of Omens', 20], ['Mountain', 20]]));
    await settle();
    ada.session.setReady(true);
    bo.session.setReady(true);
    expect(table.host.start().ok).toBe(true);
    await settle();
    const faults: BotFault[] = [];
    const runner = createRunner({
      port: ada.session as unknown as BotPort,
      cfg: { level: 1, thinkMs: 0 },
      clock: { delay: () => () => undefined, settled: () => true },
      submit: (intent) => ada.session.submit(intent),
      onFault: (f: BotFault) => faults.push(f),
    });
    ada.session.submit({ t: 'SetStops', player: ada.session.snapshot().you, stops: BOT_STOPS });
    const view = () => ada.session.currentView();
    // Bo's Wall of Omens on the battlefield before the bot's first main phase: the opponent's creature the payload may tap - a
    // DEFENDER, so no attack of Bo's taps it (the first draft's Bears attacked and read as tapped).
    const bearsId = (bo.session.currentView().zones['hand:p2'] ?? []).find((id) => bo.session.currentView().cards[id]?.card?.name === 'Wall of Omens');
    if (!bearsId) throw new Error('Bo holds no Wall of Omens');
    bo.session.submit({ t: 'ManualMoveCard', player: 'p2', card: bearsId, to: { kind: 'battlefield', player: 'p2' } });
    await settle();
    const tapped = () => bo.session.currentView().cards[bearsId]?.tapped === true && events.some((e) => e.body.t === 'ReflexiveTriggered');
    let rounds = 0;
    for (; rounds < 3000 && !tapped(); rounds++) {
      // The bot's mana for the Trick at each of its main phases (the table is under test, not its land drops).
      const s = ada.session.snapshot();
      if (s.turn.active === s.you && s.turn.step === 'precombatMain' && (view().seats[s.you]?.manaPool?.U ?? 0) < 3 && s.priority === s.you && s.awaiting === null) {
        ada.session.submit({ t: 'ManualAddMana', player: s.you, target: s.you, symbol: 'U', amount: 3 });
      }
      if (runner.step()) continue;
      const b = bo.session.snapshot();
      const intent = b.awaiting !== null ? simplestIntent(bo.session, b) : b.priority === b.you ? ({ t: 'PassPriority', player: b.you } as const) : null;
      if (intent === null) break;
      bo.session.submit(intent);
    }
    await settle();
    expect(faults, 'no bot fault').toEqual([]);
    expect(tapped(), 'the payload tapped the opponent creature (' + rounds + ' rounds)').toBe(true);
    const kinds = events.map((e) => e.body.t);
    expect(kinds.filter((k) => k === 'ReflexiveTriggered').length, 'the trigger was made').toBeGreaterThanOrEqual(1);
    const faeries = Object.values(view().cards).filter((c) => c.isToken && c.card?.name === 'Faerie' && c.controller === 'p1');
    expect(faeries.length, 'the Faeries were made').toBeGreaterThanOrEqual(2);
    expect(stateHash(replay(events, 'd586-bot-mandatory')), 'the log replays').toBe(table.host.hash());
  });

  // D586 - THE REVIEW (pre-existing, D102's retry): the client reads PRINTED keywords, so the bot's first pick can be a creature a
  // static makes hexproof (Dragonlord Ojutai, untapped) - the host refuses it; a trigger's aim has no cast to cancel, so the bot
  // re-plans with the next candidate. Before the fix the seat stopped (noProgress) with the trigger's prompt up.
  test('a refused pick (a granted hexproof) is followed by the next candidate, never a cancel: the Bears is tapped, no fault', async () => {
    const events: GameEvent[] = [];
    const table = makeTable({ seed: 'd586-bot-wedge', onEvents: (e) => events.push(...e) });
    const ada = table.join('Ada');
    const bo = table.join('Bo');
    ada.session.submitDeck(deck('Talrand, Sky Summoner', [['Faebloom Trick', 20], ['Island', 20]]));
    bo.session.submitDeck(deck('Krenko, Mob Boss', [['Dragonlord Ojutai', 10], ['Grizzly Bears', 10], ['Mountain', 20]]));
    await settle();
    ada.session.setReady(true);
    bo.session.setReady(true);
    expect(table.host.start().ok).toBe(true);
    await settle();
    const faults: BotFault[] = [];
    const runner = createRunner({
      port: ada.session as unknown as BotPort,
      cfg: { level: 1, thinkMs: 0 },
      clock: { delay: () => () => undefined, settled: () => true },
      submit: (intent) => ada.session.submit(intent),
      onFault: (f: BotFault) => faults.push(f),
    });
    ada.session.submit({ t: 'SetStops', player: ada.session.snapshot().you, stops: BOT_STOPS });
    const bv = () => bo.session.currentView();
    const inLibOrHand = (name: string) => [...(bv().zones['hand:p2'] ?? [])].find((id) => bv().cards[id]?.card?.name === name);
    // Ojutai and the Bears onto Bo's battlefield (from the hand where the opening seven holds them, else Bo's library by a peek).
    const place = (name: string) => {
      const id = inLibOrHand(name);
      if (!id) return null;
      bo.session.submit({ t: 'ManualMoveCard', player: 'p2', card: id, to: { kind: 'battlefield', player: 'p2' } });
      return id;
    };
    const ojutai = place('Dragonlord Ojutai');
    const bears = place('Grizzly Bears');
    await settle();
    if (!ojutai || !bears) throw new Error('the opening seven holds no Dragonlord Ojutai and Grizzly Bears (seed d586-bot-wedge)');
    const done = () => bv().cards[bears]?.tapped === true && events.some((e) => e.body.t === 'ReflexiveTriggered');
    for (let rounds = 0; rounds < 3000 && !done() && faults.length === 0; rounds++) {
      const s = ada.session.snapshot();
      if (s.turn.active === s.you && s.turn.step === 'precombatMain' && (ada.session.currentView().seats[s.you]?.manaPool?.U ?? 0) < 3 && s.priority === s.you && s.awaiting === null) {
        ada.session.submit({ t: 'ManualAddMana', player: s.you, target: s.you, symbol: 'U', amount: 3 });
      }
      if (runner.step()) continue;
      const b = bo.session.snapshot();
      // Bo never attacks: Ojutai stays untapped (and so hexproof by its own static).
      const intent = b.awaiting?.kind === 'declareAttackers' && b.awaiting.player === b.you ? ({ t: 'DeclareAttackers', player: b.you, attackers: [] } as const) : b.awaiting !== null ? simplestIntent(bo.session, b) : b.priority === b.you ? ({ t: 'PassPriority', player: b.you } as const) : null;
      if (intent === null) break;
      bo.session.submit(intent);
    }
    await settle();
    expect(faults, 'no bot fault - the seat was never stopped').toEqual([]);
    expect(bv().cards[bears]?.tapped, 'the payload tapped the Bears (the one legal target)').toBe(true);
    expect(bv().cards[ojutai]?.tapped, 'Ojutai stayed untapped (hexproof)').toBe(false);
    expect(stateHash(replay(events, 'd586-bot-wedge')), 'the log replays').toBe(table.host.hash());
  });
});
