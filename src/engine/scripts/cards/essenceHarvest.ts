// `Essence Harvest` — "Target player loses X life and you gain X life,
// where X is the greatest power among creatures you control." X is the
// max DERIVED power on my board at resolution. D211.

import { ESSENCE_HARVEST } from '../../../data/fixtures/engineCards';
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
  ESSENCE_HARVEST,
  'Target player loses X life and you gain X life, where X is the greatest power among creatures you control.',
);

export const ESSENCE_HARVEST_SCRIPT: CardScript = {
  oracleId: ESSENCE_HARVEST.oracleId,
  name: ESSENCE_HARVEST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if ((d.power ?? 0) > x) x = d.power ?? 0;
      }
      if (x <= 0) return [];
      const events: EventBody[] = [
        { t: 'LifeChanged', player: target.id, delta: -x, to: p.life - x },
      ];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: x, to: me.life + x });
      }
      return events;
    },
  },
};
