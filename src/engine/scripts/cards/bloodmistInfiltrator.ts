// `Bloodmist Infiltrator` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODMIST_INFILTRATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODMIST_INFILTRATOR, "Whenever this creature attacks, you may sacrifice another creature. If you do, this creature can't be blocked this turn.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice another creature. If you do, this creature can't be blocked this turn.", BLOODMIST_INFILTRATOR.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice another creature. If you do, this creature can't be blocked this turn.");

export const BLOODMIST_INFILTRATOR_SCRIPT: CardScript = {
  oracleId: BLOODMIST_INFILTRATOR.oracleId,
  name: BLOODMIST_INFILTRATOR.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Bloodmist Infiltrator - You may sacrifice another creature. If you do, this creature can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
