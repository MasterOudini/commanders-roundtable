// `Twinmaw Stormbrood // Charring Bite` - a etb trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TWINMAW_STORMBROOD_CHARRING_BITE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(TWINMAW_STORMBROOD_CHARRING_BITE, "Flying\nWhen this creature enters, you gain 5 life.\nCharring Bite deals 5 damage to target creature without flying. (Then shuffle this card into its owner's library.)");
const LINES = PRINTED.split('\n');

export const TWINMAW_STORMBROOD_CHARRING_BITE_SCRIPT: CardScript = {
  oracleId: TWINMAW_STORMBROOD_CHARRING_BITE.oracleId,
  name: TWINMAW_STORMBROOD_CHARRING_BITE.name,
  triggers: [
    {
      abilityId: 'etb-1', face: 0,
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Twinmaw Stormbrood // Charring Bite - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 5, to: me.life + 5 }];
      },
    },
  ],
};
