// `Abundant Maw` - a castThisSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABUNDANT_MAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABUNDANT_MAW, "Emerge {6}{B} (You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana value.)\nWhen you cast this spell, target opponent loses 3 life and you gain 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target opponent loses 3 life and you gain 3 life.", ABUNDANT_MAW.name);
const VOCAB_T_L1 = vocabularyTargets("Target opponent loses 3 life and you gain 3 life.");

export const ABUNDANT_MAW_SCRIPT: CardScript = {
  oracleId: ABUNDANT_MAW.oracleId,
  name: ABUNDANT_MAW.name,
  triggers: [
    {
      abilityId: 'castThisSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ["stack"],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => "Abundant Maw - Target opponent loses 3 life and you gain 3 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
