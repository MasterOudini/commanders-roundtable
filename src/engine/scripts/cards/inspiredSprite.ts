// `Inspired Sprite` - a castSpell trigger untapSelf, an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INSPIRED_SPRITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INSPIRED_SPRITE, "Flash\nFlying\nWhenever you cast a Wizard spell, you may untap this creature.\n{T}: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');

export const INSPIRED_SPRITE_SCRIPT: CardScript = {
  oracleId: INSPIRED_SPRITE.oracleId,
  name: INSPIRED_SPRITE.name,
  activated: [
    {
      ref: `${INSPIRED_SPRITE.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Inspired Sprite - discard a card" } },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.subtypes.includes('Wizard'),
      label: () => "Inspired Sprite - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
