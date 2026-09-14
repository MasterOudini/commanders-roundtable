// `Ryusei, the Falling Star` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RYUSEI_THE_FALLING_STAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RYUSEI_THE_FALLING_STAR, "Flying\nWhen Ryusei dies, it deals 5 damage to each creature without flying.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 5 damage to each creature without flying.", RYUSEI_THE_FALLING_STAR.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 5 damage to each creature without flying.");

export const RYUSEI_THE_FALLING_STAR_SCRIPT: CardScript = {
  oracleId: RYUSEI_THE_FALLING_STAR.oracleId,
  name: RYUSEI_THE_FALLING_STAR.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Ryusei, the Falling Star - ~ deals 5 damage to each creature without flying.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
