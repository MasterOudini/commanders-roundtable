// `Meletis Astronomer` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MELETIS_ASTRONOMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MELETIS_ASTRONOMER, "Heroic — Whenever you cast a spell that targets this creature, look at the top three cards of your library. You may reveal an enchantment card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

const VOCAB_L0 = vocabularyEffects("Look at the top three cards of your library. You may reveal an enchantment card from among them and put it into your hand. Put the rest on the bottom of your library in any order.", MELETIS_ASTRONOMER.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top three cards of your library. You may reveal an enchantment card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

export const MELETIS_ASTRONOMER_SCRIPT: CardScript = {
  oracleId: MELETIS_ASTRONOMER.oracleId,
  name: MELETIS_ASTRONOMER.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Meletis Astronomer - Look at the top three cards of your library. You may reveal an enchantment card from among them and put it into your hand. Put the rest on the bottom of your library in any order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
