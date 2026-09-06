// `Warchanter of Mogis` - a becomesUntapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WARCHANTER_OF_MOGIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WARCHANTER_OF_MOGIS, "Inspired — Whenever this creature becomes untapped, target creature you control gains intimidate until end of turn. (A creature with intimidate can't be blocked except by artifact creatures and/or creatures that share a color with it.)");

const VOCAB_L0 = vocabularyEffects("Target creature you control gains intimidate until end of turn.", WARCHANTER_OF_MOGIS.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature you control gains intimidate until end of turn.");

export const WARCHANTER_OF_MOGIS_SCRIPT: CardScript = {
  oracleId: WARCHANTER_OF_MOGIS.oracleId,
  name: WARCHANTER_OF_MOGIS.name,
  triggers: [
    {
      abilityId: 'becomesUntapped-0',
      text: PRINTED,
      event: 'PermanentsUntapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsUntapped' && ev.cards.includes(self),
      label: () => "Warchanter of Mogis - Target creature you control gains intimidate until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
