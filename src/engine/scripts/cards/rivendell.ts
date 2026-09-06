// `Rivendell` - an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIVENDELL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIVENDELL, "Rivendell enters tapped unless you control a legendary creature.\n{T}: Add {U}.\n{1}{U}, {T}: Scry 2. Activate only if you control a legendary creature.");
const LINES = PRINTED.split('\n');

export const RIVENDELL_SCRIPT: CardScript = {
  oracleId: RIVENDELL.oracleId,
  name: RIVENDELL.name,
  activated: [
    {
      ref: `${RIVENDELL.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Rivendell - scry 2" } },
        ];
      },
    },
  ],
};
