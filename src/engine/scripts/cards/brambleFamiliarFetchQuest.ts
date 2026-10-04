// `Bramble Familiar // Fetch Quest` - an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRAMBLE_FAMILIAR_FETCH_QUEST } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(BRAMBLE_FAMILIAR_FETCH_QUEST, "{T}: Add {G}.\n{1}{G}, {T}, Discard a card: Return this creature to its owner's hand.\nMill seven cards. Then put a creature, enchantment, or land card from among the milled cards onto the battlefield.");
const LINES = PRINTED.split('\n');

export const BRAMBLE_FAMILIAR_FETCH_QUEST_SCRIPT: CardScript = {
  oracleId: BRAMBLE_FAMILIAR_FETCH_QUEST.oracleId,
  name: BRAMBLE_FAMILIAR_FETCH_QUEST.name,
  activated: [
    {
      ref: `${BRAMBLE_FAMILIAR_FETCH_QUEST.oracleId}#a1`, face: 0,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
