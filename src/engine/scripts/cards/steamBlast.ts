// `Steam Blast` — 2 to each creature AND each player, nobody exempt. D252.

import { STEAM_BLAST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STEAM_BLAST, 'Steam Blast deals 2 damage to each creature and each player.');

export const STEAM_BLAST_SCRIPT: CardScript = {
  oracleId: STEAM_BLAST.oracleId,
  name: STEAM_BLAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const hit = (to: { kind: 'card'; id: string } | { kind: 'player'; id: string }) => ({
        source: self,
        target: to,
        amount: 2,
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
      for (const pid of ctx.state.seating) {
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        damages.push(hit({ kind: 'player', id: pid }));
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
