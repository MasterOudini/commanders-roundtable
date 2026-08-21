// `Profane Prayers` — "Profane Prayers deals X damage to any target and
// you gain X life, where X is the number of Clerics on the battlefield."
// The census burn-and-gain, counted across EVERY board. D235.

import { PROFANE_PRAYERS } from '../../../data/fixtures/engineCards';
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
  PROFANE_PRAYERS,
  'Profane Prayers deals X damage to any target and you gain X life, where X is the number of Clerics on the battlefield.',
);

export const PROFANE_PRAYERS_SCRIPT: CardScript = {
  oracleId: PROFANE_PRAYERS.oracleId,
  name: PROFANE_PRAYERS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target) return [];
      if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
        return [];
      }
      if (target.kind === 'player' && !ctx.state.players[target.id]) return [];
      if (target.kind !== 'card' && target.kind !== 'player') return [];
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Cleric')) x++;
      }
      if (x === 0) return [];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: target.kind === 'card' ? { kind: 'card', id: target.id } : { kind: 'player', id: target.id },
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
      const player = ctx.state.players[obj.controller];
      if (player && !player.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: x, to: player.life + x });
      }
      return events;
    },
  },
};
