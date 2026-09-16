// `Clammy Prowler` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLAMMY_PROWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLAMMY_PROWLER, "Whenever this creature attacks, another target attacking creature can't be blocked this turn.");

const VOCAB_L0 = vocabularyEffects("Another target attacking creature can't be blocked this turn.", CLAMMY_PROWLER.name);
const VOCAB_T_L0 = vocabularyTargets("Another target attacking creature can't be blocked this turn.");

export const CLAMMY_PROWLER_SCRIPT: CardScript = {
  oracleId: CLAMMY_PROWLER.oracleId,
  name: CLAMMY_PROWLER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Clammy Prowler - Another target attacking creature can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
