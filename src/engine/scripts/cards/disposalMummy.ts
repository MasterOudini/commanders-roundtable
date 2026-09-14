// `Disposal Mummy` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DISPOSAL_MUMMY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DISPOSAL_MUMMY, "When this creature enters, exile target card from an opponent's graveyard.");

const VOCAB_L0 = vocabularyEffects("Exile target card from an opponent's graveyard.", DISPOSAL_MUMMY.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target card from an opponent's graveyard.");

export const DISPOSAL_MUMMY_SCRIPT: CardScript = {
  oracleId: DISPOSAL_MUMMY.oracleId,
  name: DISPOSAL_MUMMY.name,
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
      label: () => "Disposal Mummy - Exile target card from an opponent's graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
