// `Augur of Skulls` - an activation regenerate, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AUGUR_OF_SKULLS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AUGUR_OF_SKULLS, "{1}{B}: Regenerate this creature.\nSacrifice this creature: Target player discards two cards. Activate only during your upkeep.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target player discards two cards.", AUGUR_OF_SKULLS.name);
const VOCAB_T_A1 = vocabularyTargets("Target player discards two cards.");

export const AUGUR_OF_SKULLS_SCRIPT: CardScript = {
  oracleId: AUGUR_OF_SKULLS.oracleId,
  name: AUGUR_OF_SKULLS.name,
  activated: [
    {
      ref: `${AUGUR_OF_SKULLS.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
    {
      ref: `${AUGUR_OF_SKULLS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
