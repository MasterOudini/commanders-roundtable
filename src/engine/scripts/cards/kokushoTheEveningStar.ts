// `Kokusho, the Evening Star` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOKUSHO_THE_EVENING_STAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOKUSHO_THE_EVENING_STAR, "Flying\nWhen Kokusho dies, each opponent loses 5 life. You gain life equal to the life lost this way.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent loses 5 life. You gain life equal to the life lost this way.", KOKUSHO_THE_EVENING_STAR.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent loses 5 life. You gain life equal to the life lost this way.");

export const KOKUSHO_THE_EVENING_STAR_SCRIPT: CardScript = {
  oracleId: KOKUSHO_THE_EVENING_STAR.oracleId,
  name: KOKUSHO_THE_EVENING_STAR.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Kokusho, the Evening Star - Each opponent loses 5 life. You gain life equal to the life lost this way.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
