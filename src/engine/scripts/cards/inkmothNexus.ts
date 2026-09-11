// `Inkmoth Nexus` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INKMOTH_NEXUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INKMOTH_NEXUS, "{T}: Add {C}.\n{1}: This land becomes a 1/1 Phyrexian Blinkmoth artifact creature with flying and infect until end of turn. It's still a land. (It deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("~ becomes a 1/1 Phyrexian Blinkmoth artifact creature with flying and infect until end of turn. It's still a land.", INKMOTH_NEXUS.name);
const VOCAB_T_A1 = vocabularyTargets("~ becomes a 1/1 Phyrexian Blinkmoth artifact creature with flying and infect until end of turn. It's still a land.");

export const INKMOTH_NEXUS_SCRIPT: CardScript = {
  oracleId: INKMOTH_NEXUS.oracleId,
  name: INKMOTH_NEXUS.name,
  activated: [
    {
      ref: `${INKMOTH_NEXUS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
