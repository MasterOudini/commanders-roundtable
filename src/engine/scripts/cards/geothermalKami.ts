// `Geothermal Kami` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GEOTHERMAL_KAMI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GEOTHERMAL_KAMI, "When this creature enters, you may return an enchantment you control to its owner's hand. If you do, you gain 3 life.");

const VOCAB_L0 = vocabularyEffects("You may return an enchantment you control to its owner's hand. If you do, you gain 3 life.", GEOTHERMAL_KAMI.name);
const VOCAB_T_L0 = vocabularyTargets("You may return an enchantment you control to its owner's hand. If you do, you gain 3 life.");

export const GEOTHERMAL_KAMI_SCRIPT: CardScript = {
  oracleId: GEOTHERMAL_KAMI.oracleId,
  name: GEOTHERMAL_KAMI.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Geothermal Kami - You may return an enchantment you control to its owner's hand. If you do, you gain 3 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
