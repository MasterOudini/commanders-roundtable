// `Feast of Sanity` - a youDiscard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FEAST_OF_SANITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FEAST_OF_SANITY, "Whenever you discard a card, this enchantment deals 1 damage to any target and you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("This enchantment deals 1 damage to any target and you gain 1 life.", FEAST_OF_SANITY.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment deals 1 damage to any target and you gain 1 life.");

export const FEAST_OF_SANITY_SCRIPT: CardScript = {
  oracleId: FEAST_OF_SANITY.oracleId,
  name: FEAST_OF_SANITY.name,
  triggers: [
    {
      abilityId: 'youDiscard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'discard' && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Feast of Sanity - This enchantment deals 1 damage to any target and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
