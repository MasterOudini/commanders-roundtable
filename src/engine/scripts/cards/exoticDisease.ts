// `Exotic Disease` — "Domain — Target player loses X life and you gain X
// life, where X is the number of basic land types among lands you
// control." The Domain count as a drain. D211.

import { EXOTIC_DISEASE } from '../../../data/fixtures/engineCards';
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
  EXOTIC_DISEASE,
  'Domain — Target player loses X life and you gain X life, where X is the number of basic land types among lands you control.',
);

const BASICS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] as const;

export const EXOTIC_DISEASE_SCRIPT: CardScript = {
  oracleId: EXOTIC_DISEASE.oracleId,
  name: EXOTIC_DISEASE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      const p = ctx.state.players[target.id];
      if (!p || p.hasLost) return [];
      const types = new Set<string>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Land')) continue;
        for (const b of BASICS) if (d.typeLine.subtypes.includes(b)) types.add(b);
      }
      const x = types.size;
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
