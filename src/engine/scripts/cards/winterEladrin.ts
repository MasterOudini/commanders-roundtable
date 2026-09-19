// `Winter Eladrin` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WINTER_ELADRIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WINTER_ELADRIN, "Gust of Wind — When this creature enters, return up to one other target creature to its owner's hand.");

const VOCAB_L0 = vocabularyEffects("Return up to one other target creature to its owner's hand.", WINTER_ELADRIN.name);
const VOCAB_T_L0 = vocabularyTargets("Return up to one other target creature to its owner's hand.");

export const WINTER_ELADRIN_SCRIPT: CardScript = {
  oracleId: WINTER_ELADRIN.oracleId,
  name: WINTER_ELADRIN.name,
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
      label: () => "Winter Eladrin - Return up to one other target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
