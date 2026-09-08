// `Trustworthy Scout` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRUSTWORTHY_SCOUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRUSTWORTHY_SCOUT, "{1}{W}, Exile this card from your graveyard: Search your library for a card named Trustworthy Scout, reveal it, put it into your hand, then shuffle.");

const VOCAB_A0 = vocabularyEffects("Search your library for a card named ~, reveal it, put it into your hand, then shuffle.", TRUSTWORTHY_SCOUT.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a card named ~, reveal it, put it into your hand, then shuffle.");

export const TRUSTWORTHY_SCOUT_SCRIPT: CardScript = {
  oracleId: TRUSTWORTHY_SCOUT.oracleId,
  name: TRUSTWORTHY_SCOUT.name,
  activated: [
    {
      ref: `${TRUSTWORTHY_SCOUT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
