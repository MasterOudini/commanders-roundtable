// `Cornered Crook` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORNERED_CROOK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORNERED_CROOK, "When this creature enters, you may sacrifice an artifact. When you do, this creature deals 3 damage to any target.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice an artifact. When you do, this creature deals 3 damage to any target.", CORNERED_CROOK.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice an artifact. When you do, this creature deals 3 damage to any target.");

export const CORNERED_CROOK_SCRIPT: CardScript = {
  oracleId: CORNERED_CROOK.oracleId,
  name: CORNERED_CROOK.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Cornered Crook - You may sacrifice an artifact. When you do, this creature deals 3 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
