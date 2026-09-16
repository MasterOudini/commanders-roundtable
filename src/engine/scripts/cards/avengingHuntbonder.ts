// `Avenging Huntbonder` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVENGING_HUNTBONDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVENGING_HUNTBONDER, "Double strike\nWhenever this creature attacks, put a double strike counter on another target attacking creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a double strike counter on another target attacking creature.", AVENGING_HUNTBONDER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a double strike counter on another target attacking creature.");

export const AVENGING_HUNTBONDER_SCRIPT: CardScript = {
  oracleId: AVENGING_HUNTBONDER.oracleId,
  name: AVENGING_HUNTBONDER.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Avenging Huntbonder - Put a double strike counter on another target attacking creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
