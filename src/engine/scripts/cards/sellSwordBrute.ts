// `Sell-Sword Brute` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SELL_SWORD_BRUTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SELL_SWORD_BRUTE, "When this creature dies, it deals 2 damage to you.");

const VOCAB_L0 = vocabularyEffects("~ deals 2 damage to you.", SELL_SWORD_BRUTE.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 2 damage to you.");

export const SELL_SWORD_BRUTE_SCRIPT: CardScript = {
  oracleId: SELL_SWORD_BRUTE.oracleId,
  name: SELL_SWORD_BRUTE.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Sell-Sword Brute - ~ deals 2 damage to you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
