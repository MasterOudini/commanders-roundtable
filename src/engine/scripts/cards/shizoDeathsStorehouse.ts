// `Shizo, Death's Storehouse` - pump on "Target legendary creature gains fear until end of turn. (It can't be blocked except by artifact creatures and/or black creatures.)": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { SHIZO_DEATH_S_STOREHOUSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHIZO_DEATH_S_STOREHOUSE, "{T}: Add {B}.\n{B}, {T}: Target legendary creature gains fear until end of turn. (It can't be blocked except by artifact creatures and/or black creatures.)");
const TEXT = PRINTED.split('\n')[1] as string;

export const SHIZO_DEATHS_STOREHOUSE_SCRIPT: CardScript = {
  oracleId: SHIZO_DEATH_S_STOREHOUSE.oracleId,
  name: SHIZO_DEATH_S_STOREHOUSE.name,
  activated: [
    {
      ref: `${SHIZO_DEATH_S_STOREHOUSE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["fear"] }];
      },
    },
  ],
};
