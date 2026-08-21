// `Reanimate` — "Put target creature card from a graveyard onto the
// battlefield under your control. You lose life equal to that card's
// mana value." The theft reanimation: the battlefield move's player IS
// the controller (Nurgle's idiom), and the bill is the card's printed
// mana value, read before the move. D238.

import { REANIMATE } from '../../../data/fixtures/engineCards';
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
  REANIMATE,
  "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to that card's mana value.",
);

export const REANIMATE_SCRIPT: CardScript = {
  oracleId: REANIMATE.oracleId,
  name: REANIMATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'graveyard') return [];
      const graveOwner = card.zone.player;
      if (!graveOwner) return [];
      const oc = ctx.oracle.byPrinting(card.printingId);
      const mv = oc?.manaValue ?? 0;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'graveyard', player: graveOwner },
              to: { kind: 'battlefield', player: obj.controller },
            },
          ],
        },
      ];
      const caster = ctx.state.players[obj.controller];
      if (mv > 0 && caster && !caster.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -mv, to: caster.life - mv });
      }
      return events;
    },
  },
};
