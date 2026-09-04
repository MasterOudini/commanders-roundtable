// `Crowd Favorites` - an activation tapTarget, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CROWD_FAVORITES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CROWD_FAVORITES, "{3}{W}: Tap target creature.\n{3}{W}: This creature gets +0/+5 until end of turn.");
const LINES = PRINTED.split('\n');

export const CROWD_FAVORITES_SCRIPT: CardScript = {
  oracleId: CROWD_FAVORITES.oracleId,
  name: CROWD_FAVORITES.name,
  activated: [
    {
      ref: `${CROWD_FAVORITES.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
    {
      ref: `${CROWD_FAVORITES.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 5 }];
      },
    },
  ],
};
