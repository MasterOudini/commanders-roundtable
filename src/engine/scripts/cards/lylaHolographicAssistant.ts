// `Lyla, Holographic Assistant` - a drawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LYLA_HOLOGRAPHIC_ASSISTANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LYLA_HOLOGRAPHIC_ASSISTANT, "Whenever you draw a card, put a +1/+1 counter on target creature.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target creature.", LYLA_HOLOGRAPHIC_ASSISTANT.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const LYLA_HOLOGRAPHIC_ASSISTANT_SCRIPT: CardScript = {
  oracleId: LYLA_HOLOGRAPHIC_ASSISTANT.oracleId,
  name: LYLA_HOLOGRAPHIC_ASSISTANT.name,
  triggers: [
    {
      abilityId: 'drawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Lyla, Holographic Assistant - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
