// `Preyseizer Dragon` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PREYSEIZER_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PREYSEIZER_DRAGON, "Flying\nDevour 2 (As this creature enters, you may sacrifice any number of creatures. It enters with twice that many +1/+1 counters on it.)\nWhenever this creature attacks, it deals damage to any target equal to the number of +1/+1 counters on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("~ deals damage to any target equal to the number of +1/+1 counters on ~.", PREYSEIZER_DRAGON.name);
const VOCAB_T_L2 = vocabularyTargets("~ deals damage to any target equal to the number of +1/+1 counters on ~.");

export const PREYSEIZER_DRAGON_SCRIPT: CardScript = {
  oracleId: PREYSEIZER_DRAGON.oracleId,
  name: PREYSEIZER_DRAGON.name,
  triggers: [
    {
      abilityId: 'attacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Preyseizer Dragon - ~ deals damage to any target equal to the number of +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
