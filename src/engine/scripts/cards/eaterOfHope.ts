// `Eater of Hope` - an activation regenerate, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EATER_OF_HOPE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EATER_OF_HOPE, "Flying\n{B}, Sacrifice another creature: Regenerate this creature.\n{2}{B}, Sacrifice two other creatures: Destroy target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Destroy target creature.", EATER_OF_HOPE.name);
const VOCAB_T_A1 = vocabularyTargets("Destroy target creature.");

export const EATER_OF_HOPE_SCRIPT: CardScript = {
  oracleId: EATER_OF_HOPE.oracleId,
  name: EATER_OF_HOPE.name,
  activated: [
    {
      ref: `${EATER_OF_HOPE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
    {
      ref: `${EATER_OF_HOPE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
