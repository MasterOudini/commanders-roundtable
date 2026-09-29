// D584 - THE BOT'S REFLEXIVE PRICE (the review's consumers lens): a `When you do` price buys a triggered ability aimed after
// the payment, by the planner the trigger's own aim will use - so the bot pays only when the payload lands on the right
// side: a harmful effect at somebody else's object, a helpful one at its own; with no legal fill (603.3d would remove the
// trigger) it declines, and a price it declines is never paid as a cheap tax.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import type { Awaiting, TargetChoice } from '../engine/types/state';
import type { ReflexiveSpec } from '../engine/types/oracle';
import type { PlayerView } from '../view/types';
import { GRIZZLY_BEARS } from '../data/fixtures/engineCards';
import { answerAwaiting } from './awaiting';
import type { BotPort, BotSnapshot } from './types';

const ME = 'p1';
const FOE = 'p2';

function card(id: string, controller: string) {
  return { instanceId: id, card: GRIZZLY_BEARS, faceIndex: 0, faceDown: false, controller, owner: controller, tapped: false, summoningSick: false, damage: 0, counters: {}, power: 2, toughness: 2, attachedTo: null, isCommander: false, isToken: false, attacking: null, blocking: [] };
}
function seat(id: string) {
  return { playerId: id, name: id, life: 40, cmdDamage: {}, poison: 0, energy: 0, ringTempts: 0, ringBearer: null, isMonarch: false, manaPool: {}, lost: false };
}
const VIEW = {
  me: ME,
  seatOrder: [ME, FOE],
  seats: { [ME]: seat(ME), [FOE]: seat(FOE) },
  cards: { src: card('src', ME), mine: card('mine', ME), theirs: card('theirs', FOE) },
  zones: { [`bf:${ME}`]: ['src', 'mine'], [`bf:${FOE}`]: ['theirs'] },
  stack: [],
  turn: { active: ME, phase: 'main1', turnNumber: 3 },
  priority: ME,
  log: [],
  hiddenCounts: {},
  peek: [],
} as unknown as PlayerView;

function port(legal: readonly TargetChoice[]): BotPort {
  return {
    snapshot: (): BotSnapshot => ({ you: ME, running: true, finished: false, awaiting: null, priority: ME, legal: [], turn: { number: 3, active: ME, step: 'main1' }, eventCount: 1, rejectSeq: 0, message: null }) as unknown as BotSnapshot,
    currentView: () => VIEW,
    submit: () => undefined,
    previewCast: () => null,
    legalTargetsFor: () => [...legal],
    targetSpecsFor: () => [],
  };
}
function reflexiveOf(text: string): ReflexiveSpec {
  const r = parseEffects(text, 'Test Card', true).effects[0]?.pay?.reflexive;
  if (!r) throw new Error('no reflexive in ' + text);
  return r;
}
function price(text: string): Awaiting {
  return { kind: 'payMana', player: ME, cost: { raw: '{1}', generic: 1, colored: {}, colorless: 0, xCount: 0, hybrids: [], phyrexian: [], manaValue: 1 } as never, life: 0, label: 'Test Card', controller: ME, source: 'src', card: null, identity: [], targets: [], ifPaid: [], ifNotPaid: [], reflexive: reflexiveOf(text) } as Awaiting;
}
const paid = (d: ReturnType<typeof answerAwaiting>): boolean | null => (d.t === 'act' && d.intent.t === 'AnswerPayMana' ? d.intent.pay : null);

describe('D584 - the bot prices a reflexive payload', () => {
  test('harm at the opponent: paid; harm whose only aim is its own: declined', () => {
    const destroy = 'you may pay {1}. When you do, destroy target creature.';
    expect(paid(answerAwaiting(port([{ kind: 'card', id: 'theirs' }, { kind: 'card', id: 'mine' }]), price(destroy), ME, 0))).toBe(true);
    expect(paid(answerAwaiting(port([{ kind: 'card', id: 'mine' }]), price(destroy), ME, 0))).toBe(false);
  });

  test('help on an open clause lands on the opponent (the planner prefers theirs): declined; on its own: paid', () => {
    const counter = 'you may pay {1}. When you do, put a +1/+1 counter on target creature.';
    expect(paid(answerAwaiting(port([{ kind: 'card', id: 'theirs' }, { kind: 'card', id: 'mine' }]), price(counter), ME, 0))).toBe(false);
    expect(paid(answerAwaiting(port([{ kind: 'card', id: 'mine' }]), price('you may pay {1}. When you do, put a +1/+1 counter on target creature you control.'), ME, 0))).toBe(true);
  });

  test('no legal fill (603.3d would remove the trigger): declined, never paid as a cheap tax; a payload with no clause: paid', () => {
    expect(paid(answerAwaiting(port([]), price('you may pay {1}. When you do, destroy target creature.'), ME, 0))).toBe(false);
    expect(paid(answerAwaiting(port([]), price('you may pay {1}. When you do, draw a card.'), ME, 0))).toBe(true);
  });
});
