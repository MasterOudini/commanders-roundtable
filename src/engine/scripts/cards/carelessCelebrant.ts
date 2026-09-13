// `Careless Celebrant` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CARELESS_CELEBRANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CARELESS_CELEBRANT, "When this creature dies, it deals 2 damage to target creature or planeswalker an opponent controls.");

const VOCAB_L0 = vocabularyEffects("~ deals 2 damage to target creature or planeswalker an opponent controls.", CARELESS_CELEBRANT.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 2 damage to target creature or planeswalker an opponent controls.");

export const CARELESS_CELEBRANT_SCRIPT: CardScript = {
  oracleId: CARELESS_CELEBRANT.oracleId,
  name: CARELESS_CELEBRANT.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Careless Celebrant - ~ deals 2 damage to target creature or planeswalker an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
