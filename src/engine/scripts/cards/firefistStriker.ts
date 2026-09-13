// `Firefist Striker` - a battalion trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIREFIST_STRIKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIREFIST_STRIKER, "Battalion — Whenever this creature and at least two other creatures attack, target creature can't block this turn.");

const VOCAB_L0 = vocabularyEffects("Target creature can't block this turn.", FIREFIST_STRIKER.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature can't block this turn.");

export const FIREFIST_STRIKER_SCRIPT: CardScript = {
  oracleId: FIREFIST_STRIKER.oracleId,
  name: FIREFIST_STRIKER.name,
  triggers: [
    {
      abilityId: 'battalion-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ev.attackers.length >= 3,
      label: () => "Firefist Striker - Target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
