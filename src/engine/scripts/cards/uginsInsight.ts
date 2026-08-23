// `Ugin's Insight` — scry X where X is the greatest mana value among my
// permanents, then draw three: Cerebral Download's computed ask riding a
// fixed `thenDraw` (D202).
//
// ⚠️ The ask MUST be LAST or the draw is silently dropped (D195), which is
// why `thenDraw` carries it rather than a following event.
// ⚠️ X = 0 raises NO ask and still draws three — the branch a happy-path
// test would miss. D263.

import { UGIN_S_INSIGHT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(
  UGIN_S_INSIGHT,
  'Scry X, where X is the greatest mana value among permanents you control, then draw three cards.',
);

export const UGINS_INSIGHT_SCRIPT: CardScript = {
  oracleId: UGIN_S_INSIGHT.oracleId,
  name: UGIN_S_INSIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        const oc = ctx.oracle.byPrinting(inst.printingId);
        if (oc && oc.manaValue > x) x = oc.manaValue;
      }

      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(x, library.length);
      if (n === 0) return [...drawEvents(ctx.state, obj.controller, 3)];

      const top = library.slice(library.length - n);
      return [
        { t: 'CardsRevealed', cards: top, to: [obj.controller] },
        {
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: obj.controller,
            count: n,
            toGraveyard: false,
            thenDraw: 3,
            label: obj.label,
          },
        },
      ];
    },
  },
};
