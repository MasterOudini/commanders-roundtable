// `Elderfang Disciple` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELDERFANG_DISCIPLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELDERFANG_DISCIPLE, "When this creature enters, each opponent discards a card.");

const VOCAB_L0 = vocabularyEffects("Each opponent discards a card.", ELDERFANG_DISCIPLE.name);
const VOCAB_T_L0 = vocabularyTargets("Each opponent discards a card.");

export const ELDERFANG_DISCIPLE_SCRIPT: CardScript = {
  oracleId: ELDERFANG_DISCIPLE.oracleId,
  name: ELDERFANG_DISCIPLE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Elderfang Disciple - Each opponent discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
