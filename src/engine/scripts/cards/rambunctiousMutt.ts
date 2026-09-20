// `Rambunctious Mutt` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAMBUNCTIOUS_MUTT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAMBUNCTIOUS_MUTT, "When this creature enters, destroy target artifact or enchantment an opponent controls.");

const VOCAB_L0 = vocabularyEffects("Destroy target artifact or enchantment an opponent controls.", RAMBUNCTIOUS_MUTT.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target artifact or enchantment an opponent controls.");

export const RAMBUNCTIOUS_MUTT_SCRIPT: CardScript = {
  oracleId: RAMBUNCTIOUS_MUTT.oracleId,
  name: RAMBUNCTIOUS_MUTT.name,
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
      label: () => "Rambunctious Mutt - Destroy target artifact or enchantment an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
