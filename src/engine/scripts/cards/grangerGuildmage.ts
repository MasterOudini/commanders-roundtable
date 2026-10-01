// `Granger Guildmage` - an activation vocab, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRANGER_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRANGER_GUILDMAGE, "{R}, {T}: This creature deals 1 damage to any target and 1 damage to you.\n{W}, {T}: Target creature gains first strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 1 damage to any target and 1 damage to you.", GRANGER_GUILDMAGE.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 1 damage to any target and 1 damage to you.");

export const GRANGER_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: GRANGER_GUILDMAGE.oracleId,
  name: GRANGER_GUILDMAGE.name,
  activated: [
    {
      ref: `${GRANGER_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${GRANGER_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
