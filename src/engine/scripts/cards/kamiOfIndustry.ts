// `Kami of Industry` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAMI_OF_INDUSTRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAMI_OF_INDUSTRY, "When this creature enters, return target artifact card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.");

const VOCAB_L0 = vocabularyEffects("Return target artifact card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.", KAMI_OF_INDUSTRY.name);
const VOCAB_T_L0 = vocabularyTargets("Return target artifact card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.");

export const KAMI_OF_INDUSTRY_SCRIPT: CardScript = {
  oracleId: KAMI_OF_INDUSTRY.oracleId,
  name: KAMI_OF_INDUSTRY.name,
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
      label: () => "Kami of Industry - Return target artifact card with mana value 3 or less from your graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
