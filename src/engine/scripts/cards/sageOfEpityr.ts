// `Sage of Epityr` — the Sage Owl look with no keyword header: the whole
// card is the one line. D242.

import { SAGE_OF_EPITYR } from '../../../data/fixtures/engineCards';
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
  SAGE_OF_EPITYR,
  'When this creature enters, look at the top four cards of your library, then put them back in any order.',
);

export const SAGE_OF_EPITYR_SCRIPT: CardScript = {
  oracleId: SAGE_OF_EPITYR.oracleId,
  name: SAGE_OF_EPITYR.name,
  triggers: [
    {
      abilityId: 'etb-order',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Sage of Epityr — put the top four back in any order',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        if (library.length === 0) return [];
        const top = library.slice(Math.max(0, library.length - 4));
        const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: [obj.controller] }];
        if (top.length > 1) {
          events.push({
            t: 'AwaitingSet',
            awaiting: {
              kind: 'orderCards',
              player: obj.controller,
              zone: 'library',
              destination: 'top',
              count: top.length,
              label: obj.label,
            },
          });
        } else {
          events.push({ t: 'CardsRevealed', cards: top, to: [] });
        }
        return events;
      },
    },
  ],
};
