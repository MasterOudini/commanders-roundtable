// `Crown of Flames` - an activation attachedTemp, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CROWN_OF_FLAMES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CROWN_OF_FLAMES, "Enchant creature\n{R}: Enchanted creature gets +1/+0 until end of turn.\n{R}: Return this Aura to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Return this Aura to its owner's hand.", CROWN_OF_FLAMES.name);
const VOCAB_T_A1 = vocabularyTargets("Return this Aura to its owner's hand.");

export const CROWN_OF_FLAMES_SCRIPT: CardScript = {
  oracleId: CROWN_OF_FLAMES.oracleId,
  name: CROWN_OF_FLAMES.name,
  activated: [
    {
      ref: `${CROWN_OF_FLAMES.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 1, toughness: 0 }];
      },
    },
    {
      ref: `${CROWN_OF_FLAMES.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
