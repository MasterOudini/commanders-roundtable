// `Fear of Lost Teeth` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FEAR_OF_LOST_TEETH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FEAR_OF_LOST_TEETH, "When this creature dies, it deals 1 damage to any target and you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to any target and you gain 1 life.", FEAR_OF_LOST_TEETH.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to any target and you gain 1 life.");

export const FEAR_OF_LOST_TEETH_SCRIPT: CardScript = {
  oracleId: FEAR_OF_LOST_TEETH.oracleId,
  name: FEAR_OF_LOST_TEETH.name,
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
      label: () => "Fear of Lost Teeth - ~ deals 1 damage to any target and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
