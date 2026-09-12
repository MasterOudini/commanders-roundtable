// `Makeshift Binding` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAKESHIFT_BINDING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAKESHIFT_BINDING, "When this enchantment enters, exile target creature an opponent controls until this enchantment leaves the battlefield. You gain 2 life.");

const VOCAB_L0 = vocabularyEffects("Exile target creature an opponent controls until this enchantment leaves the battlefield. You gain 2 life.", MAKESHIFT_BINDING.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature an opponent controls until this enchantment leaves the battlefield. You gain 2 life.");

export const MAKESHIFT_BINDING_SCRIPT: CardScript = {
  oracleId: MAKESHIFT_BINDING.oracleId,
  name: MAKESHIFT_BINDING.name,
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
      label: () => "Makeshift Binding - Exile target creature an opponent controls until this enchantment leaves the battlefield. You gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
