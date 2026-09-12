// `Workshop Assistant` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WORKSHOP_ASSISTANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WORKSHOP_ASSISTANT, "When this creature dies, return another target artifact card from your graveyard to your hand.");

const VOCAB_L0 = vocabularyEffects("Return another target artifact card from your graveyard to your hand.", WORKSHOP_ASSISTANT.name);
const VOCAB_T_L0 = vocabularyTargets("Return another target artifact card from your graveyard to your hand.");

export const WORKSHOP_ASSISTANT_SCRIPT: CardScript = {
  oracleId: WORKSHOP_ASSISTANT.oracleId,
  name: WORKSHOP_ASSISTANT.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Workshop Assistant - Return another target artifact card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
