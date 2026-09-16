// `Collector's Case` - a etb trigger vocab, an activation tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COLLECTOR_S_CASE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(COLLECTOR_S_CASE, "When this artifact enters, tap up to one target creature and put two stun counters on it. (If a permanent with a stun counter would become untapped, remove one from it instead.)\n{3}{U}, {T}: Tap target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Tap up to one target creature and put two stun counters on it.", COLLECTOR_S_CASE.name);
const VOCAB_T_L0 = vocabularyTargets("Tap up to one target creature and put two stun counters on it.");

export const COLLECTORS_CASE_SCRIPT: CardScript = {
  oracleId: COLLECTOR_S_CASE.oracleId,
  name: COLLECTOR_S_CASE.name,
  activated: [
    {
      ref: `${COLLECTOR_S_CASE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Collector's Case - Tap up to one target creature and put two stun counters on it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
