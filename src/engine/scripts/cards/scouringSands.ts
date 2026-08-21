// `Scouring Sands` — "deals 1 damage to each creature your opponents
// control. Scry 1." The opponent-board sweep with the ask LAST. D244.

import { SCOURING_SANDS } from '../../../data/fixtures/engineCards';
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
  SCOURING_SANDS,
  'Scouring Sands deals 1 damage to each creature your opponents control. Scry 1. ' +
    '(Look at the top card of your library. You may put that card on the bottom.)',
);

export const SCOURING_SANDS_SCRIPT: CardScript = {
  oracleId: SCOURING_SANDS.oracleId,
  name: SCOURING_SANDS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
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
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(1, library.length);
      if (n > 0) {
        const top = library.slice(library.length - n);
        events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: obj.controller,
            count: n,
            toGraveyard: false,
            thenDraw: 0,
            label: obj.label,
          },
        });
      }
      return events;
    },
  },
};
