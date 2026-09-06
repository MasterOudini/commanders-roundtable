// `Survivor of Korlis` - an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SURVIVOR_OF_KORLIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SURVIVOR_OF_KORLIS, "First strike\n{1}{W}, Exile this card from your graveyard: Scry 2.");
const LINES = PRINTED.split('\n');

export const SURVIVOR_OF_KORLIS_SCRIPT: CardScript = {
  oracleId: SURVIVOR_OF_KORLIS.oracleId,
  name: SURVIVOR_OF_KORLIS.name,
  activated: [
    {
      ref: `${SURVIVOR_OF_KORLIS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Survivor of Korlis - scry 2" } },
        ];
      },
    },
  ],
};
