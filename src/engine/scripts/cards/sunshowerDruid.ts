// `Sunshower Druid` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSHOWER_DRUID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSHOWER_DRUID, "When this creature enters, put a +1/+1 counter on target creature and you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature and you gain 1 life.", SUNSHOWER_DRUID.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature and you gain 1 life.");

export const SUNSHOWER_DRUID_SCRIPT: CardScript = {
  oracleId: SUNSHOWER_DRUID.oracleId,
  name: SUNSHOWER_DRUID.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sunshower Druid - Put a +1/+1 counter on target creature and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
