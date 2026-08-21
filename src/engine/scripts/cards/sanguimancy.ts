// `Sanguimancy` — "You draw X cards and you lose X life, where X is your
// devotion to black." Aspect of Hydra's devotion census paying a draw
// and a bill. D243.

import { SANGUIMANCY } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  SANGUIMANCY,
  'You draw X cards and you lose X life, where X is your devotion to black. ' +
    '(Each {B} in the mana costs of permanents you control counts toward your devotion to black.)',
);

export const SANGUIMANCY_SCRIPT: CardScript = {
  oracleId: SANGUIMANCY.oracleId,
  name: SANGUIMANCY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let devotion = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const oc = ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        const cost = faceOf(oc, card.faceIndex).manaCost;
        if (!cost) continue;
        devotion += cost.colored.B;
        devotion += cost.hybrids.filter((h) =>
          h.options.some((o) => o.kind === 'color' && o.color === 'B'),
        ).length;
      }
      if (devotion === 0) return [];
      return [
        ...drawEvents(ctx.state, obj.controller, devotion),
        { t: 'LifeChanged', player: obj.controller, delta: -devotion, to: player.life - devotion },
      ];
    },
  },
};
