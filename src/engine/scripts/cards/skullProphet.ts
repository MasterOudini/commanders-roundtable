// `Skull Prophet` - an activation mill
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKULL_PROPHET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKULL_PROPHET, "{T}: Add {B} or {G}.\n{T}: Mill two cards. (Put the top two cards of your library into your graveyard.)");
const LINES = PRINTED.split('\n');

export const SKULL_PROPHET_SCRIPT: CardScript = {
  oracleId: SKULL_PROPHET.oracleId,
  name: SKULL_PROPHET.name,
  activated: [
    {
      ref: `${SKULL_PROPHET.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 2));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
};
