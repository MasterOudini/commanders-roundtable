// `Guardian Sunmare` - a attacksWhileSaddled trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GUARDIAN_SUNMARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GUARDIAN_SUNMARE, "Ward {2}\nWhenever this creature attacks while saddled, search your library for a nonland permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.\nSaddle 4");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a nonland permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.", GUARDIAN_SUNMARE.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a nonland permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.");

export const GUARDIAN_SUNMARE_SCRIPT: CardScript = {
  oracleId: GUARDIAN_SUNMARE.oracleId,
  name: GUARDIAN_SUNMARE.name,
  triggers: [
    {
      abilityId: 'attacksWhileSaddled-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ctx.state.untilEndOfTurn.some((m) => m.card === self && m.saddled === true),
      label: () => "Guardian Sunmare - Search your library for a nonland permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
