// `Nutrient Block` — "Indestructible (reminder)\n{2}, {T}, Sacrifice this
// artifact: You gain 3 life.\nWhen this artifact is put into a graveyard from
// the battlefield, draw a card." The Food line behind an engine keyword, and
// Implement of Improvement's looks-back dies watcher (D276) — a sacrifice
// is not a destruction, so the indestructible Food still goes to the
// graveyard when eaten, and the watcher pays a card. D278.

import { NUTRIENT_BLOCK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  NUTRIENT_BLOCK,
  'Indestructible (Effects that say "destroy" don\'t destroy this artifact.)\n{2}, {T}, Sacrifice this artifact: You gain 3 life.\nWhen this artifact is put into a graveyard from the battlefield, draw a card.',
);
const FOOD = PRINTED.split('\n')[1] as string;
const DIES = PRINTED.split('\n')[2] as string;

export const NUTRIENT_BLOCK_SCRIPT: CardScript = {
  oracleId: NUTRIENT_BLOCK.oracleId,
  name: NUTRIENT_BLOCK.name,
  activated: [
    {
      ref: `${NUTRIENT_BLOCK.oracleId}#a0`,
      text: FOOD,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Nutrient Block — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
