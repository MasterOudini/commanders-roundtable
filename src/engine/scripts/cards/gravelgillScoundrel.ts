// `Gravelgill Scoundrel` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAVELGILL_SCOUNDREL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRAVELGILL_SCOUNDREL, "Vigilance\nWhenever this creature attacks, you may tap another untapped creature you control. If you do, this creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may tap another untapped creature you control. If you do, this creature can't be blocked this turn.", GRAVELGILL_SCOUNDREL.name);
const VOCAB_T_L1 = vocabularyTargets("You may tap another untapped creature you control. If you do, this creature can't be blocked this turn.");

export const GRAVELGILL_SCOUNDREL_SCRIPT: CardScript = {
  oracleId: GRAVELGILL_SCOUNDREL.oracleId,
  name: GRAVELGILL_SCOUNDREL.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Gravelgill Scoundrel - You may tap another untapped creature you control. If you do, this creature can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
