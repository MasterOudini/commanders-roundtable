// `Incite Rebellion` — for EACH player: their creature count, dealt to
// them and to each creature they control. My own board included. D219.

import { INCITE_REBELLION } from '../../../data/fixtures/engineCards';
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
  INCITE_REBELLION,
  'For each player, Incite Rebellion deals damage to that player and each creature that player controls equal to the number of creatures they control.',
);

export const INCITE_REBELLION_SCRIPT: CardScript = {
  oracleId: INCITE_REBELLION.oracleId,
  name: INCITE_REBELLION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const pid of ctx.state.seating) {
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        const mine = [];
        for (const id of ctx.state.zones.battlefield) {
          const card = ctx.state.cards[id];
          if (!card || card.controller !== pid) continue;
          if (ctx.derive(id).typeLine.types.includes('Creature')) mine.push(id);
        }
        const n = mine.length;
        if (n === 0) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
          amount: n,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
        for (const id of mine) {
          damages.push({
            source: self,
            target: { kind: 'card' as const, id },
            amount: n,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          });
        }
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
