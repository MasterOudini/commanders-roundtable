// `Gilt-Leaf Seer` — {G} and the tap look at the top two cards of my library
// (revealed to me) and put them back in any order (`orderCards`, raised from
// a script; one card has one order and skips the ask).

import { GILT_LEAF_SEER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GILT_LEAF_SEER, '{G}, {T}: Look at the top two cards of your library, then put them back in any order.');

export const GILT_LEAF_SEER_SCRIPT: CardScript = {
  oracleId: GILT_LEAF_SEER.oracleId,
  name: GILT_LEAF_SEER.name,
  activated: [
    {
      ref: `${GILT_LEAF_SEER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const count = Math.min(2, library.length);
        if (count === 0) return [];
        const top = library.slice(library.length - count);
        const events: EventBody[] = [{ t: 'CardsRevealed', cards: top, to: [obj.controller] }];
        if (count > 1) {
          events.push({
            t: 'AwaitingSet',
            awaiting: { kind: 'orderCards', player: obj.controller, zone: 'library', destination: 'top', count, label: obj.label },
          });
        }
        return events;
      },
    },
  ],
};
