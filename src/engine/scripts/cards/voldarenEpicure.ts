// `Voldaren Epicure` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOLDAREN_EPICURE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOLDAREN_EPICURE, "When this creature enters, it deals 1 damage to each opponent. Create a Blood token. (It's an artifact with \"{1}, {T}, Discard a card, Sacrifice this token: Draw a card.\")");

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to each opponent. Create a Blood token.", VOLDAREN_EPICURE.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to each opponent. Create a Blood token.");

export const VOLDAREN_EPICURE_SCRIPT: CardScript = {
  oracleId: VOLDAREN_EPICURE.oracleId,
  name: VOLDAREN_EPICURE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Voldaren Epicure - ~ deals 1 damage to each opponent. Create a Blood token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
