// D585 - THE BOT'S CASUALTY (the review's bot lens): the copy is what the card is for, so a spare token pays it - but never
// when the spell costs its own caster life (Cut of the Profits' `you lose X life` - the copy loses it again: at 10 life, X = 6
// took the seat to -2), and never with its last creature while the opponents' creatures could swing for lethal (a sacrifice
// is permanent: at 3 life the Ogre token was its only blocker against a Hill Giant). Both failed before the rule.

import { describe, expect, test } from 'vitest';
import type { PlayerView } from '../view/types';
import { A_LITTLE_CHAT, CUT_OF_THE_PROFITS, GRIZZLY_BEARS, HILL_GIANT } from '../data/fixtures/engineCards';
import { decide } from './policy';
import type { BotPort, BotSnapshot } from './types';
import type { CastPreview, CostPicks } from '../net/client';

const ME = 'p1';
const FOE = 'p2';

type Data = typeof GRIZZLY_BEARS;
function card(id: string, data: Data, controller: string, over: Partial<PlayerView['cards'][string]> = {}) {
  return {
    instanceId: id, card: data, faceIndex: 0, faceDown: false, controller, owner: controller, tapped: false, summoningSick: false,
    damage: 0, counters: {}, power: null, toughness: null, attachedTo: null, isCommander: false, isToken: false, attacking: null,
    blocking: [], revealed: false, ...over,
  };
}
/** My hand holds `spell`; my battlefield the Ogre token (4/3); the opponent's what `foe` names. */
function view(spell: Data, life: number, foe: readonly string[]): PlayerView {
  return {
    you: ME,
    seats: Object.fromEntries([ME, FOE].map((id) => [id, { playerId: id, name: id, life: id === ME ? life : 40, cmdDamage: {}, poison: 0, energy: 0, ringTempts: 0, ringBearer: null, isMonarch: false, manaPool: {}, lost: false }])),
    seating: [ME, FOE],
    cards: {
      h1: card('h1', spell, ME),
      ogre: card('ogre', GRIZZLY_BEARS, ME, { power: 4, toughness: 3, isToken: true }),
      giant: card('giant', HILL_GIANT, FOE, { power: 3, toughness: 3 }),
    },
    zones: { [`hand:${ME}`]: ['h1'], [`bf:${ME}`]: ['ogre'], [`bf:${FOE}`]: [...foe] },
    stack: [],
    turn: { active: ME, phase: 'main1', turnNumber: 5 },
    priority: ME,
    log: [],
    hiddenCounts: {},
    peek: [],
  } as unknown as PlayerView;
}
/** A port whose solver pays every price asked (X to six), casualty included when the cast names it. */
function makePort(spell: Data, life: number, foe: readonly string[], hasX: boolean): BotPort {
  const v = view(spell, life, foe);
  const preview = (x: number, picks: CostPicks, casualty: boolean): CastPreview =>
    ({ card: 'h1', name: spell.name, cost: '', tax: 0, hasX, plan: { taps: [], pool: {} }, taps: [], lifePaid: 0, kicker: null, kicked: 0,
      keywords: { convoke: false, improvise: false, delve: false }, alt: { convoke: [], improvise: [], delve: [] }, altAvailable: { convoke: [], improvise: [], delve: [] },
      altProblem: null, additionalCost: null, costPicks: picks, orPaid: false, alternativeCost: null, alternative: false, bought: false, replicated: 0,
      conspired: false, offspringPaid: false, squadded: 0, casualty: { candidates: ['ogre'], floor: 1 }, casualtyPaid: casualty, xValue: x }) as unknown as CastPreview;
  return {
    snapshot: (): BotSnapshot => ({
      you: ME, running: true, finished: false, awaiting: null, priority: ME,
      legal: [{ t: 'CastSpell', card: 'h1', faceIndex: 0, from: { kind: 'hand', player: ME }, affordable: true, isCommanderCast: false, tax: 0, hasX, label: spell.name, casualtyCandidates: ['ogre'] }, { t: 'PassPriority' }],
      turn: { number: 5, active: ME, step: 'main1' }, eventCount: 1, rejectSeq: 0, message: null,
    }) as unknown as BotSnapshot,
    currentView: () => v,
    submit: () => undefined,
    previewCast: (_card, x = 0, _t, _k, _a, picks = {}, _alt, _b, _r, _c, _o, _s, _sp, casualty = false) => preview(x, picks, casualty),
    legalTargetsFor: () => [],
    targetSpecsFor: () => [],
  };
}
const castOf = (port: BotPort) => {
  const d = decide(port, port.snapshot(), { level: 1, thinkMs: 0 });
  const intent = d.t === 'act' ? d.intent : null;
  if (intent?.t !== 'CastSpell') throw new Error('no cast: ' + JSON.stringify(d));
  return intent;
};

describe('D585 - the bot pays casualty with a spare, and only when the copy cannot kill it', () => {
  test('the control: A Little Chat at 40 life, nothing across the table - the Ogre token pays, the copy follows', () => {
    const intent = castOf(makePort(A_LITTLE_CHAT, 40, [], false));
    expect(intent.casualty).toBe(true);
    expect(intent.sacrifice).toEqual(['ogre']);
  });
  test('Cut of the Profits costs its caster life: cast for the largest X, no casualty (the copy would lose it twice)', () => {
    const intent = castOf(makePort(CUT_OF_THE_PROFITS, 10, [], true));
    expect(intent.xValue).toBe(6);
    expect(intent.casualty).toBeUndefined();
    expect(intent.sacrifice).toBeUndefined();
  });
  test('at 3 life with a Hill Giant across the table, the Ogre is the last blocker: A Little Chat is cast without casualty', () => {
    const intent = castOf(makePort(A_LITTLE_CHAT, 3, ['giant'], false));
    expect(intent.casualty).toBeUndefined();
    expect(intent.sacrifice).toBeUndefined();
  });
  test('at 40 life the same Giant is no threat: the Ogre pays', () => {
    const intent = castOf(makePort(A_LITTLE_CHAT, 40, ['giant'], false));
    expect(intent.casualty).toBe(true);
  });
});
