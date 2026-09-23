// `Etherium-Horn Sorcerer` - an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ETHERIUM_HORN_SORCERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ETHERIUM_HORN_SORCERER, "{1}{U}{R}: Return this creature to its owner's hand.\nCascade (When you cast this spell, exile cards from the top of your library until you exile a nonland card that costs less. You may cast it without paying its mana cost. Put the exiled cards on the bottom in a random order.)");
const LINES = PRINTED.split('\n');

export const ETHERIUM_HORN_SORCERER_SCRIPT: CardScript = {
  oracleId: ETHERIUM_HORN_SORCERER.oracleId,
  name: ETHERIUM_HORN_SORCERER.name,
  activated: [
    {
      ref: `${ETHERIUM_HORN_SORCERER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
