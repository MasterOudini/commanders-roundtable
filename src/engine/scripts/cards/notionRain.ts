// `Notion Rain` — "Surveil 2, then draw two cards. Notion Rain deals 2
// damage to you." Cerebral Download's thenDraw rider with the recoil
// emitted FIRST — the ask must be LAST (D195), and the self-damage is
// unconditional either way (Cruel Truths' ordering). D229.

import { NOTION_RAIN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  NOTION_RAIN,
  'Surveil 2, then draw two cards. Notion Rain deals 2 damage to you. ' +
    '(To surveil 2, look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);

export const NOTION_RAIN_SCRIPT: CardScript = {
  oracleId: NOTION_RAIN.oracleId,
  name: NOTION_RAIN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: obj.controller },
              amount: 2,
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
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(2, library.length);
      if (n > 0) {
        const top = library.slice(library.length - n);
        events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
        events.push({
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: obj.controller,
            count: n,
            toGraveyard: true,
            thenDraw: 2,
            label: obj.label,
          },
        });
      } else {
        // Nothing to surveil, but "then draw two cards" still happens —
        // an empty library draws through THE one draw rule and loses.
        events.push(...drawEvents(ctx.state, obj.controller, 2));
      }
      return events;
    },
  },
};
