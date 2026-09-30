// `Second Wind` - an activation tapAttached, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SECOND_WIND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SECOND_WIND, "Enchant creature\n{T}: Tap enchanted creature.\n{T}: Untap enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Untap enchanted creature.", SECOND_WIND.name);
const VOCAB_T_A1 = vocabularyTargets("Untap enchanted creature.");

export const SECOND_WIND_SCRIPT: CardScript = {
  oracleId: SECOND_WIND.oracleId,
  name: SECOND_WIND.name,
  activated: [
    {
      ref: `${SECOND_WIND.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [host] }];
      },
    },
    {
      ref: `${SECOND_WIND.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
