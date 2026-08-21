// `Rain of Embers` — "Rain of Embers deals 1 damage to each creature
// and each player." The everyone sweep at one. D237.

import { RAIN_OF_EMBERS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RAIN_OF_EMBERS, 'Rain of Embers deals 1 damage to each creature and each player.');

export const RAIN_OF_EMBERS_SCRIPT: CardScript = {
  oracleId: RAIN_OF_EMBERS.oracleId,
  name: RAIN_OF_EMBERS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const hit = (
        to: { kind: 'card'; id: string } | { kind: 'player'; id: string },
      ) => ({
        source: self,
        target: to,
        amount: 1,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push(hit({ kind: 'card', id }));
      }
      for (const seat of ctx.state.seating) {
        const player = ctx.state.players[seat];
        if (!player || player.hasLost) continue;
        damages.push(hit({ kind: 'player', id: seat }));
      }
      return damages.length > 0 ? [{ t: 'DamageDealt', damages }] : [];
    },
  },
};
