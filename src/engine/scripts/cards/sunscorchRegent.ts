// `Sunscorch Regent` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSCORCH_REGENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSCORCH_REGENT, "Flying\nWhenever an opponent casts a spell, put a +1/+1 counter on this creature and you gain 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on this creature and you gain 1 life.", SUNSCORCH_REGENT.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on this creature and you gain 1 life.");

export const SUNSCORCH_REGENT_SCRIPT: CardScript = {
  oracleId: SUNSCORCH_REGENT.oracleId,
  name: SUNSCORCH_REGENT.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self),
      label: () => "Sunscorch Regent - Put a +1/+1 counter on this creature and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
