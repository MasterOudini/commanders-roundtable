// `Ivory Cup` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IVORY_CUP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IVORY_CUP, "Whenever a player casts a white spell, you may pay {1}. If you do, you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, you gain 1 life.", IVORY_CUP.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, you gain 1 life.");

export const IVORY_CUP_SCRIPT: CardScript = {
  oracleId: IVORY_CUP.oracleId,
  name: IVORY_CUP.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ctx.derive(ev.obj.card).colors.includes('W'),
      label: () => "Ivory Cup - You may pay {1}. If you do, you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
