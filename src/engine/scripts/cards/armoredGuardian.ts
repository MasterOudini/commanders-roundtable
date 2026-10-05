// `Armored Guardian` - an activation vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARMORED_GUARDIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARMORED_GUARDIAN, "{1}{W}{W}: Target creature you control gains protection from the color of your choice until end of turn.\n{1}{U}{U}: This creature gains shroud until end of turn. (It can't be the target of spells or abilities.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature you control gains protection from the color of your choice until end of turn.", ARMORED_GUARDIAN.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gains protection from the color of your choice until end of turn.");

export const ARMORED_GUARDIAN_SCRIPT: CardScript = {
  oracleId: ARMORED_GUARDIAN.oracleId,
  name: ARMORED_GUARDIAN.name,
  activated: [
    {
      ref: `${ARMORED_GUARDIAN.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${ARMORED_GUARDIAN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["shroud"] }];
      },
    },
  ],
};
