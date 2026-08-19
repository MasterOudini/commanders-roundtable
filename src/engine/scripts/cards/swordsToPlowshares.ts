// `Swords to Plowshares` — "Exile target creature. Its controller gains
// life equal to its power." The exile AND the gain read the creature's
// DERIVED power as it leaves (CR 613 settles characteristics first — a
// pumped 2/2 pays 4), and the life goes to the CONTROLLER, who is not
// always the caster and not always the owner. D196.

import { SWORDS_TO_PLOWSHARES } from '../../../data/fixtures/engineCards';
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
  SWORDS_TO_PLOWSHARES,
  'Exile target creature. Its controller gains life equal to its power.',
);

export const SWORDS_TO_PLOWSHARES_SCRIPT: CardScript = {
  oracleId: SWORDS_TO_PLOWSHARES.oracleId,
  name: SWORDS_TO_PLOWSHARES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const power = ctx.derive(target.id).power ?? 0;
      const controller = ctx.state.players[card.controller];
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
      if (power > 0 && controller && !controller.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: card.controller,
          delta: power,
          to: controller.life + power,
        });
      }
      return events;
    },
  },
};
