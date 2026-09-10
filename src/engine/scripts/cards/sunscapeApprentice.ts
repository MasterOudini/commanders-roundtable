// `Sunscape Apprentice` - an activation pumpTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSCAPE_APPRENTICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSCAPE_APPRENTICE, "{G}, {T}: Target creature gets +1/+1 until end of turn.\n{U}, {T}: Put target creature you control on top of its owner's library.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Put target creature you control on top of its owner's library.", SUNSCAPE_APPRENTICE.name);
const VOCAB_T_A1 = vocabularyTargets("Put target creature you control on top of its owner's library.");

export const SUNSCAPE_APPRENTICE_SCRIPT: CardScript = {
  oracleId: SUNSCAPE_APPRENTICE.oracleId,
  name: SUNSCAPE_APPRENTICE.name,
  activated: [
    {
      ref: `${SUNSCAPE_APPRENTICE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
    {
      ref: `${SUNSCAPE_APPRENTICE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
