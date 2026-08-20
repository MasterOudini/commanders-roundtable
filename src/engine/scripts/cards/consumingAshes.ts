// `Consuming Ashes` — "Exile target creature. If it had mana value 3 or
// less, surveil 2." The condition reads the victim BEFORE the move ("it
// HAD"), and the ask is LAST — the D195 rule met by the printed order.
// D204.

import { CONSUMING_ASHES } from '../../../data/fixtures/engineCards';
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
  CONSUMING_ASHES,
  'Exile target creature. If it had mana value 3 or less, surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);

export const CONSUMING_ASHES_SCRIPT: CardScript = {
  oracleId: CONSUMING_ASHES.oracleId,
  name: CONSUMING_ASHES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
      ];
      if (mv <= 3) {
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
              thenDraw: 0,
              label: obj.label,
            },
          });
        }
      }
      return events;
    },
  },
};
