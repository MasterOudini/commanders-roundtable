// `Savage Knuckleblade` - an activation pumping itself, an activation bounceSelf, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAVAGE_KNUCKLEBLADE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAVAGE_KNUCKLEBLADE, "{2}{G}: This creature gets +2/+2 until end of turn. Activate only once each turn.\n{2}{U}: Return this creature to its owner's hand.\n{R}: This creature gains haste until end of turn.");
const LINES = PRINTED.split('\n');

export const SAVAGE_KNUCKLEBLADE_SCRIPT: CardScript = {
  oracleId: SAVAGE_KNUCKLEBLADE.oracleId,
  name: SAVAGE_KNUCKLEBLADE.name,
  activated: [
    {
      ref: `${SAVAGE_KNUCKLEBLADE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
    {
      ref: `${SAVAGE_KNUCKLEBLADE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
    {
      ref: `${SAVAGE_KNUCKLEBLADE.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["haste"] }];
      },
    },
  ],
};
