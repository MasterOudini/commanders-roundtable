// `Ageless Entity` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGELESS_ENTITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AGELESS_ENTITY, "Whenever you gain life, put that many +1/+1 counters on this creature.");

const VOCAB_L0 = vocabularyEffects("Put that many +1/+1 counters on ~.", AGELESS_ENTITY.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Put that many +1/+1 counters on ~.");

export const AGELESS_ENTITY_SCRIPT: CardScript = {
  oracleId: AGELESS_ENTITY.oracleId,
  name: AGELESS_ENTITY.name,
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: PRINTED,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      memo: (_ctx, _self, ev) => (ev.t === 'LifeChanged' && ev.delta > 0 ? ev.delta : 0),
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Ageless Entity - Put that many +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
