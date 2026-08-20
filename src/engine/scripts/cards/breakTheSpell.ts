// `Break the Spell` — "Destroy target enchantment. If a permanent you
// controlled or a token was destroyed this way, draw a card." The condition
// is read off the target BEFORE the move: destroyed-this-way requires the
// destroy to actually happen (indestructible survives and draws nothing),
// and the draw asks whether it was MINE or a TOKEN. D201.

import { BREAK_THE_SPELL } from '../../../data/fixtures/engineCards';
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
  BREAK_THE_SPELL,
  'Destroy target enchantment. If a permanent you controlled or a token was destroyed this way, draw a card.',
);

export const BREAK_THE_SPELL_SCRIPT: CardScript = {
  oracleId: BREAK_THE_SPELL.oracleId,
  name: BREAK_THE_SPELL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      if (ctx.derive(target.id).keywords.has('indestructible')) return [];
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        },
      ];
      if (card.controller === obj.controller || card.isToken) {
        events.push(...drawEvents(ctx.state, obj.controller, 1));
      }
      return events;
    },
  },
};
