// `Hierophant's Chalice` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIEROPHANT_S_CHALICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIEROPHANT_S_CHALICE, "When this artifact enters, target opponent loses 1 life and you gain 1 life.\n{T}: Add {C}.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target opponent loses 1 life and you gain 1 life.", HIEROPHANT_S_CHALICE.name);
const VOCAB_T_L0 = vocabularyTargets("Target opponent loses 1 life and you gain 1 life.");

export const HIEROPHANTS_CHALICE_SCRIPT: CardScript = {
  oracleId: HIEROPHANT_S_CHALICE.oracleId,
  name: HIEROPHANT_S_CHALICE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Hierophant's Chalice - Target opponent loses 1 life and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
