// `Cerebral Download` — "Surveil X, where X is the number of artifacts you
// control. Then draw three cards." The computed surveil rides the D195 ask
// with `thenDraw: 3` — the answer handler draws AFTER the reorder, on a
// scratch fold, so the player draws past what they just binned. With ZERO
// artifacts the ask is skipped and the draws still happen. D202.

import { CEREBRAL_DOWNLOAD } from '../../../data/fixtures/engineCards';
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
  CEREBRAL_DOWNLOAD,
  'Surveil X, where X is the number of artifacts you control. Then draw three cards. (To surveil X, look at the top X cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);

export const CEREBRAL_DOWNLOAD_SCRIPT: CardScript = {
  oracleId: CEREBRAL_DOWNLOAD.oracleId,
  name: CEREBRAL_DOWNLOAD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Artifact')) x++;
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
            toGraveyard: true,
            thenDraw: 3,
            label: obj.label,
          },
        },
      ];
    },
  },
};
