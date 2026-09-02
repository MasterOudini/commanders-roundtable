// `Hydrolash` — "Attacking creatures get -2/-0 until end of turn.\nDraw a
// card." Trumpet Blast's attackers walk (the combat declaration on the
// state) with the sign flipped, then the draw. Cast outside combat there
// are no attackers and only the card is drawn. D276.

import { HYDROLASH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(HYDROLASH, 'Attacking creatures get -2/-0 until end of turn.\nDraw a card.');

export const HYDROLASH_SCRIPT: CardScript = {
  oracleId: HYDROLASH.oracleId,
  name: HYDROLASH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const decl of ctx.state.combat?.attackers ?? []) {
        if (ctx.state.cards[decl.card]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: decl.card, power: -2, toughness: 0, keywords: [] });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
