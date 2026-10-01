// `Benthic Biomancer` - an activation vocab, a countersPutOnSelf trigger loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BENTHIC_BIOMANCER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(BENTHIC_BIOMANCER, "{1}{U}: Adapt 1. (If this creature has no +1/+1 counters on it, put a +1/+1 counter on it.)\nWhenever one or more +1/+1 counters are put on this creature, draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Adapt 1.", BENTHIC_BIOMANCER.name);
const VOCAB_T_A0 = vocabularyTargets("Adapt 1.");

export const BENTHIC_BIOMANCER_SCRIPT: CardScript = {
  oracleId: BENTHIC_BIOMANCER.oracleId,
  name: BENTHIC_BIOMANCER.name,
  activated: [
    {
      ref: `${BENTHIC_BIOMANCER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'countersPutOnSelf-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CountersChanged' && ev.changes.some((c) => c.card === self && c.kind === '+1/+1' && c.delta > 0),
      label: () => "Benthic Biomancer - loot",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Benthic Biomancer - discard a card" } },
        ];
      },
    },
  ],
};
