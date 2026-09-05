// `Crypt of the Eternals` - a etb trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRYPT_OF_THE_ETERNALS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRYPT_OF_THE_ETERNALS, "When this land enters, you gain 1 life.\n{T}: Add {C}.\n{1}, {T}: Add {U}, {B}, or {R}.");
const LINES = PRINTED.split('\n');

export const CRYPT_OF_THE_ETERNALS_SCRIPT: CardScript = {
  oracleId: CRYPT_OF_THE_ETERNALS.oracleId,
  name: CRYPT_OF_THE_ETERNALS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Crypt of the Eternals - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
