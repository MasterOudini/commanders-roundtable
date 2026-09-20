// `Seismic Elemental` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEISMIC_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEISMIC_ELEMENTAL, "When this creature enters, creatures without flying can't block this turn.");

const VOCAB_L0 = vocabularyEffects("Creatures without flying can't block this turn.", SEISMIC_ELEMENTAL.name);
const VOCAB_T_L0 = vocabularyTargets("Creatures without flying can't block this turn.");

export const SEISMIC_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: SEISMIC_ELEMENTAL.oracleId,
  name: SEISMIC_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Seismic Elemental - Creatures without flying can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
