// `Joyous Respite` — gain 1 per land I control. D221.

import { JOYOUS_RESPITE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(JOYOUS_RESPITE, 'You gain 1 life for each land you control.');

export const JOYOUS_RESPITE_SCRIPT: CardScript = {
  oracleId: JOYOUS_RESPITE.oracleId,
  name: JOYOUS_RESPITE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) n++;
      }
      const me = ctx.state.players[obj.controller];
      if (n === 0 || !me || me.hasLost) return [];
      return [{ t: 'LifeChanged', player: obj.controller, delta: n, to: me.life + n }];
    },
  },
};
