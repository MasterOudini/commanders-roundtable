// `Carrion Thrash` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CARRION_THRASH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CARRION_THRASH, "When this creature dies, you may pay {2}. If you do, return another target creature card from your graveyard to your hand.");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. If you do, return another target creature card from your graveyard to your hand.", CARRION_THRASH.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. If you do, return another target creature card from your graveyard to your hand.");

export const CARRION_THRASH_SCRIPT: CardScript = {
  oracleId: CARRION_THRASH.oracleId,
  name: CARRION_THRASH.name,
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
      label: () => "Carrion Thrash - You may pay {2}. If you do, return another target creature card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
