// `Dragon Mantle` - a etb trigger draw, a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRAGON_MANTLE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
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

const PRINTED = printed(DRAGON_MANTLE, "Enchant creature\nWhen this Aura enters, draw a card.\nEnchanted creature has \"{R}: This creature gets +1/+0 until end of turn.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G2 = vocabularyEffects("~ gets +1/+0 until end of turn.", DRAGON_MANTLE.name);
const VOCAB_T_G2 = vocabularyTargets("~ gets +1/+0 until end of turn.");

const GRANT_2 = grantedActivated("{R}: This creature gets +1/+0 until end of turn.", `${DRAGON_MANTLE.oracleId}#g2`, DRAGON_MANTLE.name);

export const DRAGON_MANTLE_SCRIPT: CardScript = {
  oracleId: DRAGON_MANTLE.oracleId,
  name: DRAGON_MANTLE.name,
  activated: [
    {
      ref: GRANT_2.ref,
      text: LINES[2] as string,
      granted: GRANT_2.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G2, VOCAB_T_G2);
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
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Dragon Mantle - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
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
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_2.ref, ability: GRANT_2.ability });
      },
    },
  ],
};
