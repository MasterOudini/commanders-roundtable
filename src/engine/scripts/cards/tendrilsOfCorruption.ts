// `Tendrils of Corruption` — the Swamp census spent twice in one resolve: X
// damage to the target AND X life to me. The count is the DERIVED subtype, so
// a Swamp that is only a Swamp because something changed its type still
// counts. D258.

import { TENDRILS_OF_CORRUPTION } from '../../../data/fixtures/engineCards';
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
  TENDRILS_OF_CORRUPTION,
  'Tendrils of Corruption deals X damage to target creature and you gain X life, where X is the number of Swamps you control.',
);

export const TENDRILS_OF_CORRUPTION_SCRIPT: CardScript = {
  oracleId: TENDRILS_OF_CORRUPTION.oracleId,
  name: TENDRILS_OF_CORRUPTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Swamp')) x += 1;
      }
      if (x === 0) return [];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: x,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: x, to: me.life + x });
      }
      return events;
    },
  },
};
