// `Garrison Griffin` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GARRISON_GRIFFIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GARRISON_GRIFFIN, "Flying\nWhenever this creature attacks, target Knight you control gains flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target Knight you control gains flying until end of turn.", GARRISON_GRIFFIN.name);
const VOCAB_T_L1 = vocabularyTargets("Target Knight you control gains flying until end of turn.");

export const GARRISON_GRIFFIN_SCRIPT: CardScript = {
  oracleId: GARRISON_GRIFFIN.oracleId,
  name: GARRISON_GRIFFIN.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Garrison Griffin - Target Knight you control gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
