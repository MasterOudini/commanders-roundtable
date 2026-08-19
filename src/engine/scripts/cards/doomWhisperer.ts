// `Doom Whisperer` — "Pay 2 life: Surveil 2." The life-cost activation
// (Book of Rass's charge, D165) composed with the D195 ask: the def's
// resolve emits the same reveal-then-surveil pair the effect emits, so a
// repeatable engine-charged ability can fill a graveyard two cards at a
// time — the first activated surveil in the pool. D196.

import { DOOM_WHISPERER } from '../../../data/fixtures/engineCards';
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
  DOOM_WHISPERER,
  'Flying, trample\nPay 2 life: Surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DOOM_WHISPERER_SCRIPT: CardScript = {
  oracleId: DOOM_WHISPERER.oracleId,
  name: DOOM_WHISPERER.name,
  activated: [
    {
      ref: `${DOOM_WHISPERER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
