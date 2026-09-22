// D437 - THE BOT ANNOUNCES X: an {X} spell in hand is cast for the largest X the mana can pay (six down to one), the
// preview chain re-run per X, and the intent carries the value so no prompt is raised. Zero is never announced.

import { describe, expect, test } from 'vitest';
import type { PlayerView } from '../view/types';
import { BLAZE, MOUNTAIN } from '../data/fixtures/engineCards';
import { decide } from './policy';
import type { BotPort, BotSnapshot } from './types';
import type { CastPreview } from '../net/client';

const ME = 'p1';
const FOE = 'p2';

function card(id: string, data: typeof BLAZE, over: Partial<PlayerView['cards'][string]> = {}) {
  return {
    instanceId: id, card: data, faceIndex: 0, faceDown: false, controller: ME, owner: ME, tapped: false, summoningSick: false,
    damage: 0, counters: {}, power: null, toughness: null, attachedTo: null, isCommander: false, isToken: false, attacking: null,
    blocking: [], revealed: false, ...over,
  };
}
function view(): PlayerView {
  return {
    you: ME,
    seats: Object.fromEntries([ME, FOE].map((id) => [id, { playerId: id, name: id, life: 40, cmdDamage: {}, poison: 0, energy: 0, ringTempts: 0, ringBearer: null, manaPool: {}, lost: false }])),
    seating: [ME, FOE],
    cards: { h1: card('h1', BLAZE), l1: card('l1', MOUNTAIN), l2: card('l2', MOUNTAIN), l3: card('l3', MOUNTAIN) },
    zones: { [`hand:${ME}`]: ['h1'], [`bf:${ME}`]: ['l1', 'l2', 'l3'], [`bf:${FOE}`]: [] },
    stack: [],
    turn: { active: ME, phase: 'main1', turnNumber: 3 },
    priority: ME,
    log: [],
    hiddenCounts: {},
    peek: [],
  } as unknown as PlayerView;
}
/** A port whose solver pays the fixed {R} plus up to `payable` generic: X above it has no plan. */
function makePort(payable: number, seen: number[]): BotPort {
  const preview = (x: number): CastPreview =>
    ({ card: 'h1', name: 'Blaze', cost: '{X}{R}', tax: 0, hasX: true, plan: x <= payable ? { taps: [], pool: {} } : null, taps: [], lifePaid: 0, kicker: null, kicked: 0,
      keywords: { convoke: false, improvise: false, delve: false }, alt: { convoke: [], improvise: [], delve: [] }, altAvailable: { convoke: [], improvise: [], delve: [] },
      altProblem: null, additionalCost: null, costPicks: {}, orPaid: false, alternativeCost: null, alternative: false }) as unknown as CastPreview;
  return {
    snapshot: (): BotSnapshot => ({
      you: ME, running: true, finished: false, awaiting: null, priority: ME,
      legal: [{ t: 'CastSpell', card: 'h1', faceIndex: 0, from: { kind: 'hand', player: ME }, affordable: true, isCommanderCast: false, tax: 0, hasX: true, label: 'Blaze' }, { t: 'PassPriority' }],
      turn: { number: 3, active: ME, step: 'main1' }, eventCount: 1, rejectSeq: 0, message: null,
    }) as unknown as BotSnapshot,
    currentView: view,
    submit: () => undefined,
    previewCast: (_card, x = 0) => { seen.push(x); return preview(x); },
    legalTargetsFor: () => [{ kind: 'player', id: FOE }],
    targetSpecsFor: () => [{ kinds: ['creature', 'player', 'planeswalker', 'battle'], min: 1, max: 1, controller: 'any', zones: [], cardTypes: [], numeric: null, keyword: null, combatRole: null, restrict: null, alternatives: null, text: 'any target', confident: true, unenforced: [] }],
  };
}

describe('the bot announces X (D437)', () => {
  test('the largest payable X is announced on the cast, tried from six down', () => {
    const seen: number[] = [];
    const port = makePort(3, seen);
    const d = decide(port, port.snapshot(), { level: 1, thinkMs: 0 });
    expect(d.t).toBe('act');
    const intent = d.t === 'act' ? d.intent : null;
    expect(intent?.t).toBe('CastSpell');
    expect(intent?.t === 'CastSpell' ? intent.xValue : null).toBe(3);
    expect(seen[0]).toBe(6);
    expect(Math.min(...seen)).toBe(3);
  });

  test('an X spell the mana pays only for X = 0 is not cast', () => {
    const seen: number[] = [];
    const port = makePort(0, seen);
    const d = decide(port, port.snapshot(), { level: 1, thinkMs: 0 });
    expect(d.t === 'act' ? d.intent.t : d.t).toBe('PassPriority');
    expect(seen.includes(0)).toBe(false);
  });
});
