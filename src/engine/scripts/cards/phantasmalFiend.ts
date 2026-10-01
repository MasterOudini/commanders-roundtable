// `Phantasmal Fiend` - an activation pumping itself, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHANTASMAL_FIEND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHANTASMAL_FIEND, "{B}: This creature gets +1/-1 until end of turn.\n{1}{U}: Switch this creature's power and toughness until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Switch this creature's power and toughness until end of turn.", PHANTASMAL_FIEND.name);
const VOCAB_T_A1 = vocabularyTargets("Switch this creature's power and toughness until end of turn.");

export const PHANTASMAL_FIEND_SCRIPT: CardScript = {
  oracleId: PHANTASMAL_FIEND.oracleId,
  name: PHANTASMAL_FIEND.name,
  activated: [
    {
      ref: `${PHANTASMAL_FIEND.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: -1 }];
      },
    },
    {
      ref: `${PHANTASMAL_FIEND.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
