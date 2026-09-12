// `Herald of the Pantheon` - a castSpell trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HERALD_OF_THE_PANTHEON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HERALD_OF_THE_PANTHEON, "Enchantment spells you cast cost {1} less to cast.\nWhenever you cast an enchantment spell, you gain 1 life.");
const LINES = PRINTED.split('\n');

export const HERALD_OF_THE_PANTHEON_SCRIPT: CardScript = {
  oracleId: HERALD_OF_THE_PANTHEON.oracleId,
  name: HERALD_OF_THE_PANTHEON.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Enchantment'),
      label: () => "Herald of the Pantheon - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
