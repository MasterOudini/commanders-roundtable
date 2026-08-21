// `Scorch the Fields` — "Destroy target land. Scorch the Fields deals 1
// damage to each Human creature." The land destroy with the
// subtype-filtered sweep rider; the destruction can miss and the sweep
// still fires (CR 608.2c). D244.

import { SCORCH_THE_FIELDS } from '../../../data/fixtures/engineCards';
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
  SCORCH_THE_FIELDS,
  'Destroy target land. Scorch the Fields deals 1 damage to each Human creature.',
);

export const SCORCH_THE_FIELDS_SCRIPT: CardScript = {
  oracleId: SCORCH_THE_FIELDS.oracleId,
  name: SCORCH_THE_FIELDS.name,
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
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.typeLine.subtypes.includes('Human')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 1,
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
