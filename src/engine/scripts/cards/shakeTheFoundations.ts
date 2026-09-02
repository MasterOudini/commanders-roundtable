// `Shake the Foundations` — "Shake the Foundations deals 1 damage to each
// creature without flying.\nDraw a card." One DamageDealt over every
// creature whose DERIVED keywords lack flying (a granted flying counts, a
// lost one does not), the spell itself the source; then the draw. D280.

import { SHAKE_THE_FOUNDATIONS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  SHAKE_THE_FOUNDATIONS,
  'Shake the Foundations deals 1 damage to each creature without flying.\nDraw a card.',
);

export const SHAKE_THE_FOUNDATIONS_SCRIPT: CardScript = {
  oracleId: SHAKE_THE_FOUNDATIONS.oracleId,
  name: SHAKE_THE_FOUNDATIONS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature') || d.keywords.has('flying')) continue;
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
      const events: EventBody[] = [];
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
