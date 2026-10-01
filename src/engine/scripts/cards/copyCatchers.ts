// `Copy Catchers` - a youSurveil trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COPY_CATCHERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COPY_CATCHERS, "Flying\nWhenever you surveil, you may pay {1}{U}. If you do, create a token that's a copy of this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {1}{U}. If you do, create a token that's a copy of this creature.", COPY_CATCHERS.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {1}{U}. If you do, create a token that's a copy of this creature.");

export const COPY_CATCHERS_SCRIPT: CardScript = {
  oracleId: COPY_CATCHERS.oracleId,
  name: COPY_CATCHERS.name,
  triggers: [
    {
      abilityId: 'youSurveil-1',
      text: LINES[1] as string,
      event: 'Surveilled',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'Surveilled' && ev.player === ctx.query.controllerOf(self),
      label: () => "Copy Catchers - You may pay {1}{U}. If you do, create a token that's a copy of this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
