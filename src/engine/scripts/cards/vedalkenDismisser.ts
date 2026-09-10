// `Vedalken Dismisser` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VEDALKEN_DISMISSER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VEDALKEN_DISMISSER, "When this creature enters, put target creature on top of its owner's library.");

const VOCAB_L0 = vocabularyEffects("Put target creature on top of its owner's library.", VEDALKEN_DISMISSER.name);
const VOCAB_T_L0 = vocabularyTargets("Put target creature on top of its owner's library.");

export const VEDALKEN_DISMISSER_SCRIPT: CardScript = {
  oracleId: VEDALKEN_DISMISSER.oracleId,
  name: VEDALKEN_DISMISSER.name,
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
      label: () => "Vedalken Dismisser - Put target creature on top of its owner's library.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
