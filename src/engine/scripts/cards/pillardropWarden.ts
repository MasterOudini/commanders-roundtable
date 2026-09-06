// `Pillardrop Warden` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PILLARDROP_WARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PILLARDROP_WARDEN, "Reach\n{2}, {T}, Sacrifice this creature: Return target instant or sorcery card from your graveyard to your hand. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target instant or sorcery card from your graveyard to your hand.", PILLARDROP_WARDEN.name);
const VOCAB_T_A0 = vocabularyTargets("Return target instant or sorcery card from your graveyard to your hand.");

export const PILLARDROP_WARDEN_SCRIPT: CardScript = {
  oracleId: PILLARDROP_WARDEN.oracleId,
  name: PILLARDROP_WARDEN.name,
  activated: [
    {
      ref: `${PILLARDROP_WARDEN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
