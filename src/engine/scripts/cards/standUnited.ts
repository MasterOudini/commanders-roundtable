// `Stand United` — the pump with a SUBTYPE-branched scry rider: an Ally
// target adds the ask LAST, anything else just gets the +2/+2. D252.

import { STAND_UNITED } from '../../../data/fixtures/engineCards';
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
  STAND_UNITED,
  "Target creature gets +2/+2 until end of turn. If it's an Ally, scry 2. " +
    '(Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)',
);

export const STAND_UNITED_SCRIPT: CardScript = {
  oracleId: STAND_UNITED.oracleId,
  name: STAND_UNITED.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const isAlly = ctx.derive(target.id).typeLine.subtypes.includes('Ally');
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 },
      ];
      if (isAlly) {
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
              toGraveyard: false,
              thenDraw: 0,
              label: 'Stand United — scry 2',
            },
          });
        }
      }
      return events;
    },
  },
};
