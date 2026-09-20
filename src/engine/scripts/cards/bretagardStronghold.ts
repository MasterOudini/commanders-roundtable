// `Bretagard Stronghold` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRETAGARD_STRONGHOLD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRETAGARD_STRONGHOLD, "This land enters tapped.\n{T}: Add {G}.\n{G}{W}{W}, {T}, Sacrifice this land: Put a +1/+1 counter on each of up to two target creatures you control. They gain vigilance and lifelink until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Put a +1/+1 counter on each of up to two target creatures you control. They gain vigilance and lifelink until end of turn.", BRETAGARD_STRONGHOLD.name);
const VOCAB_T_A1 = vocabularyTargets("Put a +1/+1 counter on each of up to two target creatures you control. They gain vigilance and lifelink until end of turn.");

export const BRETAGARD_STRONGHOLD_SCRIPT: CardScript = {
  oracleId: BRETAGARD_STRONGHOLD.oracleId,
  name: BRETAGARD_STRONGHOLD.name,
  activated: [
    {
      ref: `${BRETAGARD_STRONGHOLD.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
