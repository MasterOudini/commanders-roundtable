// `Excavated Wall` - an activation mill
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXCAVATED_WALL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXCAVATED_WALL, "Defender\n{1}, {T}: Mill a card. (Put the top card of your library into your graveyard.)");
const LINES = PRINTED.split('\n');

export const EXCAVATED_WALL_SCRIPT: CardScript = {
  oracleId: EXCAVATED_WALL.oracleId,
  name: EXCAVATED_WALL.name,
  activated: [
    {
      ref: `${EXCAVATED_WALL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 1));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
};
