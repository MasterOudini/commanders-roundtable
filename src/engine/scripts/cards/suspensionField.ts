// `Suspension Field` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUSPENSION_FIELD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUSPENSION_FIELD, "When this enchantment enters, you may exile target creature with toughness 3 or greater until this enchantment leaves the battlefield. (That creature returns under its owner's control.)");

const VOCAB_L0 = vocabularyEffects("Exile target creature with toughness 3 or greater until this enchantment leaves the battlefield.", SUSPENSION_FIELD.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature with toughness 3 or greater until this enchantment leaves the battlefield.");

export const SUSPENSION_FIELD_SCRIPT: CardScript = {
  oracleId: SUSPENSION_FIELD.oracleId,
  name: SUSPENSION_FIELD.name,
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
      label: () => "Suspension Field - Exile target creature with toughness 3 or greater until this enchantment leaves the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
