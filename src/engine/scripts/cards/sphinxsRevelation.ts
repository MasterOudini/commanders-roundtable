// `Sphinx's Revelation` — "You gain X life and draw X cards." The X read
// off the cast (obj.xValue), both halves in one resolve. D250.

import { SPHINX_S_REVELATION } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SPHINX_S_REVELATION, 'You gain X life and draw X cards.');

export const SPHINXS_REVELATION_SCRIPT: CardScript = {
  oracleId: SPHINX_S_REVELATION.oracleId,
  name: SPHINX_S_REVELATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      return [
        { t: 'LifeChanged', player: obj.controller, delta: x, to: player.life + x },
        ...drawEvents(ctx.state, obj.controller, x),
      ];
    },
  },
};
