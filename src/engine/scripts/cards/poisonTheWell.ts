// `Poison the Well` — "Destroy target land. Poison the Well deals 2
// damage to that land's controller." The controller is read BEFORE the
// move (the established pre-move rule), and the burn lands whether or
// not the land survives destruction. D234.

import { POISON_THE_WELL } from '../../../data/fixtures/engineCards';
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
  POISON_THE_WELL,
  "Destroy target land. Poison the Well deals 2 damage to that land's controller.",
);

export const POISON_THE_WELL_SCRIPT: CardScript = {
  oracleId: POISON_THE_WELL.oracleId,
  name: POISON_THE_WELL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const player = ctx.state.players[controller];
      if (player && !player.hasLost) {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'player', id: controller },
              amount: 2,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }
      return events;
    },
  },
};
