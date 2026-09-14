// `Venom, Evil Unleashed` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VENOM_EVIL_UNLEASHED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VENOM_EVIL_UNLEASHED, "Deathtouch\n{2}{B}, Exile this card from your graveyard: Put two +1/+1 counters on target creature. It gains deathtouch until end of turn. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put two +1/+1 counters on target creature. It gains deathtouch until end of turn.", VENOM_EVIL_UNLEASHED.name);
const VOCAB_T_A0 = vocabularyTargets("Put two +1/+1 counters on target creature. It gains deathtouch until end of turn.");

export const VENOM_EVIL_UNLEASHED_SCRIPT: CardScript = {
  oracleId: VENOM_EVIL_UNLEASHED.oracleId,
  name: VENOM_EVIL_UNLEASHED.name,
  activated: [
    {
      ref: `${VENOM_EVIL_UNLEASHED.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
