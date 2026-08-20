// `Noble Stand` — "Whenever a creature you control blocks, you gain 2
// life." The first PER-ITEM BlockersDeclared consumer: one firing per
// blocking creature of mine through D190's fan-out. D229.

import { NOBLE_STAND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NOBLE_STAND, 'Whenever a creature you control blocks, you gain 2 life.');

export const NOBLE_STAND_SCRIPT: CardScript = {
  oracleId: NOBLE_STAND.oracleId,
  name: NOBLE_STAND.name,
  triggers: [
    {
      abilityId: 'blocks-gain',
      text: TEXT,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' &&
        ev.blocks.some(
          (b) => ctx.state.cards[b.blocker]?.controller === ctx.query.controllerOf(self),
        ),
      // One firing PER BLOCKING CREATURE of mine (the item is the blocker,
      // though the resolve needs only the multiplicity).
      perItem: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared'
          ? ev.blocks
              .filter(
                (b) => ctx.state.cards[b.blocker]?.controller === ctx.query.controllerOf(self),
              )
              .map((b) => b.blocker)
          : [],
      label: () => 'Noble Stand — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
