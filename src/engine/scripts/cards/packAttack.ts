// `Pack Attack` — "Attacking creatures get +X/+0 until end of turn, where X
// is the number of players being attacked.\nDraw a card." Trumpet Blast's
// attackers walk (D276's Hydrolash) with X read off the same declaration:
// the DISTINCT players among the attackers' defenders, a planeswalker
// standing for its controller. Cast with nobody attacking, X is 0 and only
// the card comes. D278.

import { PACK_ATTACK } from '../../../data/fixtures/engineCards';
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
  PACK_ATTACK,
  'Attacking creatures get +X/+0 until end of turn, where X is the number of players being attacked.\nDraw a card.',
);

export const PACK_ATTACK_SCRIPT: CardScript = {
  oracleId: PACK_ATTACK.oracleId,
  name: PACK_ATTACK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const attackers = ctx.state.combat?.attackers ?? [];
      const attacked = new Set<string>();
      for (const decl of attackers) {
        const d = decl.defender;
        if (d.kind === 'player') attacked.add(d.id);
        else {
          const controller = ctx.state.cards[d.id]?.controller;
          if (controller) attacked.add(controller);
        }
      }
      const x = attacked.size;
      const events: EventBody[] = [];
      if (x > 0) {
        for (const decl of attackers) {
          if (ctx.state.cards[decl.card]?.zone.kind !== 'battlefield') continue;
          events.push({ t: 'PtModifiedUntilEndOfTurn', card: decl.card, power: x, toughness: 0, keywords: [] });
        }
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
