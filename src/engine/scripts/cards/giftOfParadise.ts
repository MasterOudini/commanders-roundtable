// `Gift of Paradise` - a etb trigger gainLife, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIFT_OF_PARADISE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedMana, pushGrantedMana } from '../grants';
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

const PRINTED = printed(GIFT_OF_PARADISE, "Enchant land\nWhen this Aura enters, you gain 3 life.\nEnchanted land has \"{T}: Add two mana of any one color.\"");
const LINES = PRINTED.split('\n');

const GRANT_2 = grantedMana("{T}: Add two mana of any one color.", GIFT_OF_PARADISE.name);

export const GIFT_OF_PARADISE_SCRIPT: CardScript = {
  oracleId: GIFT_OF_PARADISE.oracleId,
  name: GIFT_OF_PARADISE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Gift of Paradise - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        pushGrantedMana(chars, GRANT_2);
      },
    },
  ],
};
