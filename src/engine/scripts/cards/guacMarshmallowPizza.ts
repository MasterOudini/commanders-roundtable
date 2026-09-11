// `Guac & Marshmallow Pizza` - a etb trigger vocab, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GUAC_MARSHMALLOW_PIZZA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GUAC_MARSHMALLOW_PIZZA, "Flash\nWhen this artifact enters, target creature gets +2/+2 until end of turn. Untap it.\n{2}, {T}, Sacrifice this artifact: You gain 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature gets +2/+2 until end of turn. Untap it.", GUAC_MARSHMALLOW_PIZZA.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature gets +2/+2 until end of turn. Untap it.");

export const GUAC_MARSHMALLOW_PIZZA_SCRIPT: CardScript = {
  oracleId: GUAC_MARSHMALLOW_PIZZA.oracleId,
  name: GUAC_MARSHMALLOW_PIZZA.name,
  activated: [
    {
      ref: `${GUAC_MARSHMALLOW_PIZZA.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Guac & Marshmallow Pizza - Target creature gets +2/+2 until end of turn. Untap it.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
