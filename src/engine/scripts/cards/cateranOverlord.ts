// `Cateran Overlord` - an activation regenerate, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CATERAN_OVERLORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CATERAN_OVERLORD, "Sacrifice a creature: Regenerate this creature.\n{6}, {T}: Search your library for a Mercenary permanent card with mana value 6 or less, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Search your library for a Mercenary permanent card with mana value 6 or less, put it onto the battlefield, then shuffle.", CATERAN_OVERLORD.name);
const VOCAB_T_A1 = vocabularyTargets("Search your library for a Mercenary permanent card with mana value 6 or less, put it onto the battlefield, then shuffle.");

export const CATERAN_OVERLORD_SCRIPT: CardScript = {
  oracleId: CATERAN_OVERLORD.oracleId,
  name: CATERAN_OVERLORD.name,
  activated: [
    {
      ref: `${CATERAN_OVERLORD.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
    {
      ref: `${CATERAN_OVERLORD.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
