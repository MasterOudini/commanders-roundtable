// `Dragon's Hoard` - a creatureEnters trigger vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAGON_S_HOARD } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(DRAGON_S_HOARD, "Whenever a Dragon you control enters, put a gold counter on this artifact.\n{T}, Remove a gold counter from this artifact: Draw a card.\n{T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a gold counter on this artifact.", DRAGON_S_HOARD.name);
const VOCAB_T_L0 = vocabularyTargets("Put a gold counter on this artifact.");

export const DRAGONS_HOARD_SCRIPT: CardScript = {
  oracleId: DRAGON_S_HOARD.oracleId,
  name: DRAGON_S_HOARD.name,
  activated: [
    {
      ref: `${DRAGON_S_HOARD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Dragon'),
        ),
      label: () => "Dragon's Hoard - Put a gold counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
