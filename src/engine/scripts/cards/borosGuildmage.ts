// `Boros Guildmage` — "{1}{R}: Target creature gains haste until end of
// turn.\n{1}{W}: Target creature gains first strike until end of turn." The
// guildmage shape (D272's generated family) with MANA-ONLY costs — no tap,
// so no summoning sickness either — written by hand as the family's
// specimen outside the generator, whose table assumes a `{T}`. D273.

import { BOROS_GUILDMAGE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(
  BOROS_GUILDMAGE,
  '{1}{R}: Target creature gains haste until end of turn.\n{1}{W}: Target creature gains first strike until end of turn.',
);
const HASTE = PRINTED.split('\n')[0] as string;
const FIRST_STRIKE = PRINTED.split('\n')[1] as string;

export const BOROS_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: BOROS_GUILDMAGE.oracleId,
  name: BOROS_GUILDMAGE.name,
  activated: [
    {
      ref: `${BOROS_GUILDMAGE.oracleId}#a0`,
      text: HASTE,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['haste'] }];
      },
    },
    {
      ref: `${BOROS_GUILDMAGE.oracleId}#a1`,
      text: FIRST_STRIKE,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['firstStrike'] },
        ];
      },
    },
  ],
};
