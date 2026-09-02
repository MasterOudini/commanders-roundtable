// `Dream Fracture` — "Counter target spell. Its controller draws a card.\n
// Draw a card." Daring Apprentice's counter pair (D170) with Call to Heel's
// "its controller" draw (D202) read off the STACK OBJECT before it dies,
// then my own draw. D274.

import { DREAM_FRACTURE } from '../../../data/fixtures/engineCards';
import { drawEvents, moveFromStack } from '../../effects';
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

const TEXT = printed(DREAM_FRACTURE, 'Counter target spell. Its controller draws a card.\nDraw a card.');

export const DREAM_FRACTURE_SCRIPT: CardScript = {
  oracleId: DREAM_FRACTURE.oracleId,
  name: DREAM_FRACTURE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const events: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card) {
        const vc = ctx.state.cards[spell.card];
        if (vc) events.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      }
      const them = ctx.state.players[spell.controller];
      if (them && !them.hasLost) events.push(...drawEvents(ctx.state, spell.controller, 1));
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
