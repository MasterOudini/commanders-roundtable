// `Thopter Arrest` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THOPTER_ARREST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THOPTER_ARREST, "When this enchantment enters, exile target artifact or creature an opponent controls until this enchantment leaves the battlefield.");

const VOCAB_L0 = vocabularyEffects("Exile target artifact or creature an opponent controls until this enchantment leaves the battlefield.", THOPTER_ARREST.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target artifact or creature an opponent controls until this enchantment leaves the battlefield.");

export const THOPTER_ARREST_SCRIPT: CardScript = {
  oracleId: THOPTER_ARREST.oracleId,
  name: THOPTER_ARREST.name,
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
      label: () => "Thopter Arrest - Exile target artifact or creature an opponent controls until this enchantment leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
