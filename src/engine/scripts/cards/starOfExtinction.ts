// `Star of Extinction` — destroy the land, then 20 to EVERY creature and
// planeswalker in one damage batch. D252.

import { STAR_OF_EXTINCTION } from '../../../data/fixtures/engineCards';
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
  STAR_OF_EXTINCTION,
  'Destroy target land. Star of Extinction deals 20 damage to each creature and each planeswalker.',
);

export const STAR_OF_EXTINCTION_SCRIPT: CardScript = {
  oracleId: STAR_OF_EXTINCTION.oracleId,
  name: STAR_OF_EXTINCTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card') {
        const card = ctx.state.cards[target.id];
        if (
          card?.zone.kind === 'battlefield' &&
          !ctx.derive(target.id).keywords.has('indestructible')
        ) {
          events.push({
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          });
        }
      }
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        const types = d.typeLine.types;
        if (!types.includes('Creature') && !types.includes('Planeswalker')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 20,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      return events;
    },
  },
};
