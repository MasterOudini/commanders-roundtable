// `Pyroclastic Hellion` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PYROCLASTIC_HELLION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PYROCLASTIC_HELLION, "When this creature enters, you may return a land you control to its owner's hand. When you do, this creature deals 2 damage to each opponent.");

const VOCAB_L0 = vocabularyEffects("You may return a land you control to its owner's hand. When you do, this creature deals 2 damage to each opponent.", PYROCLASTIC_HELLION.name);
const VOCAB_T_L0 = vocabularyTargets("You may return a land you control to its owner's hand. When you do, this creature deals 2 damage to each opponent.");

export const PYROCLASTIC_HELLION_SCRIPT: CardScript = {
  oracleId: PYROCLASTIC_HELLION.oracleId,
  name: PYROCLASTIC_HELLION.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Pyroclastic Hellion - You may return a land you control to its owner's hand. When you do, this creature deals 2 damage to each opponent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
