// `Landbind Ritual` — gain 2 per Plains I control (derived subtypes).
// D221.

import { LANDBIND_RITUAL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LANDBIND_RITUAL, 'You gain 2 life for each Plains you control.');

export const LANDBIND_RITUAL_SCRIPT: CardScript = {
  oracleId: LANDBIND_RITUAL.oracleId,
  name: LANDBIND_RITUAL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Plains')) n++;
      }
      const me = ctx.state.players[obj.controller];
      if (n === 0 || !me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: 2 * n, to: me.life + 2 * n }];
    },
  },
};
