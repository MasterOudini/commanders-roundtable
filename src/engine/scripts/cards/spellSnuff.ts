// `Spell Snuff` — "Counter target spell.\nFateful hour — If you have 5 or
// less life, draw a card." Daring Apprentice's counter pair (D170) from a
// spell, and an ability word (Radiance's rule, D270) whose condition is my
// own life total at resolution. D281.

import { SPELL_SNUFF } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SPELL_SNUFF, 'Counter target spell.\nFateful hour — If you have 5 or less life, draw a card.');

export const SPELL_SNUFF_SCRIPT: CardScript = {
  oracleId: SPELL_SNUFF.oracleId,
  name: SPELL_SNUFF.name,
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
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost && me.life <= 5) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
