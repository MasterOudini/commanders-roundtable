// `Cinderhaze Wretch` - an activation vocab, an activation untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CINDERHAZE_WRETCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CINDERHAZE_WRETCH, "{T}: Target player discards a card. Activate only during your turn.\nPut a -1/-1 counter on this creature: Untap this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player discards a card.", CINDERHAZE_WRETCH.name);
const VOCAB_T_A0 = vocabularyTargets("Target player discards a card.");

export const CINDERHAZE_WRETCH_SCRIPT: CardScript = {
  oracleId: CINDERHAZE_WRETCH.oracleId,
  name: CINDERHAZE_WRETCH.name,
  activated: [
    {
      ref: `${CINDERHAZE_WRETCH.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${CINDERHAZE_WRETCH.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
