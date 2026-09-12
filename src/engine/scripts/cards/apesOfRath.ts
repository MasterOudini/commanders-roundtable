// `Apes of Rath` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APES_OF_RATH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APES_OF_RATH, "Whenever this creature attacks, it doesn't untap during its controller's next untap step.");

const VOCAB_L0 = vocabularyEffects("~ doesn't untap during its controller's next untap step.", APES_OF_RATH.name);
const VOCAB_T_L0 = vocabularyTargets("~ doesn't untap during its controller's next untap step.");

export const APES_OF_RATH_SCRIPT: CardScript = {
  oracleId: APES_OF_RATH.oracleId,
  name: APES_OF_RATH.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Apes of Rath - ~ doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
