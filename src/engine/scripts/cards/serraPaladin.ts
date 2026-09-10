// `Serra Paladin` - an activation vocab, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERRA_PALADIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERRA_PALADIN, "{T}: Prevent the next 1 damage that would be dealt to any target this turn.\n{1}{W}{W}, {T}: Target creature gains vigilance until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", SERRA_PALADIN.name);
const VOCAB_T_A0 = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");

export const SERRA_PALADIN_SCRIPT: CardScript = {
  oracleId: SERRA_PALADIN.oracleId,
  name: SERRA_PALADIN.name,
  activated: [
    {
      ref: `${SERRA_PALADIN.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SERRA_PALADIN.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["vigilance"] }];
      },
    },
  ],
};
