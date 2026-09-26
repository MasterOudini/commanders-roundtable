// `Ethereal Usher` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ETHEREAL_USHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ETHEREAL_USHER, "{U}, {T}: Target creature can't be blocked this turn.\nTransmute {1}{U}{U} ({1}{U}{U}, Discard this card: Search your library for a card with the same mana value as this card, reveal it, put it into your hand, then shuffle. Transmute only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't be blocked this turn.", ETHEREAL_USHER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't be blocked this turn.");

export const ETHEREAL_USHER_SCRIPT: CardScript = {
  oracleId: ETHEREAL_USHER.oracleId,
  name: ETHEREAL_USHER.name,
  activated: [
    {
      ref: `${ETHEREAL_USHER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
