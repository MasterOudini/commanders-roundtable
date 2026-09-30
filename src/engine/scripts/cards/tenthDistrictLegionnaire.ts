// `Tenth District Legionnaire` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TENTH_DISTRICT_LEGIONNAIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TENTH_DISTRICT_LEGIONNAIRE, "Haste\nWhenever you cast a spell that targets this creature, put a +1/+1 counter on this creature, then scry 1.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on this creature, then scry 1.", TENTH_DISTRICT_LEGIONNAIRE.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on this creature, then scry 1.");

export const TENTH_DISTRICT_LEGIONNAIRE_SCRIPT: CardScript = {
  oracleId: TENTH_DISTRICT_LEGIONNAIRE.oracleId,
  name: TENTH_DISTRICT_LEGIONNAIRE.name,
  triggers: [
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Tenth District Legionnaire - Put a +1/+1 counter on this creature, then scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
