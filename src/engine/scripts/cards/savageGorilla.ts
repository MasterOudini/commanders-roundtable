// `Savage Gorilla` — "{U}{B}, {T}, Sacrifice this creature: Target
// creature gets -3/-3 until end of turn. Draw a card." The two-sentence
// activated resolve (Gnottvold's rule): the debuff can miss its target
// and the draw still arrives. D243.

import { SAVAGE_GORILLA } from '../../../data/fixtures/engineCards';
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
  SAVAGE_GORILLA,
  '{U}{B}, {T}, Sacrifice this creature: Target creature gets -3/-3 until end of turn. Draw a card.',
);

export const SAVAGE_GORILLA_SCRIPT: CardScript = {
  oracleId: SAVAGE_GORILLA.oracleId,
  name: SAVAGE_GORILLA.name,
  activated: [
    {
      ref: `${SAVAGE_GORILLA.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const events: EventBody[] = [];
        const target = obj.targets[0];
        if (target && target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield') {
          events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -3, toughness: -3 });
        }
        const player = ctx.state.players[obj.controller];
        if (player && !player.hasLost) {
          events.push(...drawEvents(ctx.state, obj.controller, 1));
        }
        return events;
      },
    },
  ],
};
