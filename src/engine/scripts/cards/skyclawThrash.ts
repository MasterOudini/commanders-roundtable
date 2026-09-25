// `Skyclaw Thrash` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYCLAW_THRASH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYCLAW_THRASH, "Whenever this creature attacks, flip a coin. If you win the flip, this creature gets +1/+1 and gains flying until end of turn.");

const VOCAB_L0 = vocabularyEffects("Flip a coin. If you win the flip, this creature gets +1/+1 and gains flying until end of turn.", SKYCLAW_THRASH.name);
const VOCAB_T_L0 = vocabularyTargets("Flip a coin. If you win the flip, this creature gets +1/+1 and gains flying until end of turn.");

export const SKYCLAW_THRASH_SCRIPT: CardScript = {
  oracleId: SKYCLAW_THRASH.oracleId,
  name: SKYCLAW_THRASH.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Skyclaw Thrash - Flip a coin. If you win the flip, this creature gets +1/+1 and gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
