// `Dakmor Plague` — "Dakmor Plague deals 3 damage to each creature and each
// player." Chain Reaction's count-is-the-batch sweep at a flat 3, plus the
// players: one DamageDealt, an entry per derived creature and per living
// player, spell source, no riders. D206.

import { DAKMOR_PLAGUE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DAKMOR_PLAGUE, 'Dakmor Plague deals 3 damage to each creature and each player.');

export const DAKMOR_PLAGUE_SCRIPT: CardScript = {
  oracleId: DAKMOR_PLAGUE.oracleId,
  name: DAKMOR_PLAGUE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 3,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      for (const pid of ctx.state.seating) {
        if (ctx.state.players[pid]?.hasLost) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
          amount: 3,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
