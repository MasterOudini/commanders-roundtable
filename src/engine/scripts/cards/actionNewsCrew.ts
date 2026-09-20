// `Action News Crew` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ACTION_NEWS_CREW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ACTION_NEWS_CREW, "Vigilance\nChannel — {6}, Discard this card: Put a +1/+1 counter on each creature you control. Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put a +1/+1 counter on each creature you control. Draw a card.", ACTION_NEWS_CREW.name);
const VOCAB_T_A0 = vocabularyTargets("Put a +1/+1 counter on each creature you control. Draw a card.");

export const ACTION_NEWS_CREW_SCRIPT: CardScript = {
  oracleId: ACTION_NEWS_CREW.oracleId,
  name: ACTION_NEWS_CREW.name,
  activated: [
    {
      ref: `${ACTION_NEWS_CREW.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
