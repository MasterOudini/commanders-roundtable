// `Separatist Voidmage` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEPARATIST_VOIDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEPARATIST_VOIDMAGE, "When this creature enters, you may return target creature to its owner's hand.");

const VOCAB_L0 = vocabularyEffects("Return target creature to its owner's hand.", SEPARATIST_VOIDMAGE.name);
const VOCAB_T_L0 = vocabularyTargets("Return target creature to its owner's hand.");

export const SEPARATIST_VOIDMAGE_SCRIPT: CardScript = {
  oracleId: SEPARATIST_VOIDMAGE.oracleId,
  name: SEPARATIST_VOIDMAGE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Separatist Voidmage - Return target creature to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
