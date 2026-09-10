// `Talas Lookout` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TALAS_LOOKOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TALAS_LOOKOUT, "Flying\nWhen this creature dies, look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.", TALAS_LOOKOUT.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.");

export const TALAS_LOOKOUT_SCRIPT: CardScript = {
  oracleId: TALAS_LOOKOUT.oracleId,
  name: TALAS_LOOKOUT.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Talas Lookout - Look at the top two cards of your library. Put one of them into your hand and the other into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
