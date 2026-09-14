// `Judge of Currents` - a becomesTapped trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JUDGE_OF_CURRENTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JUDGE_OF_CURRENTS, "Whenever a Merfolk you control becomes tapped, you may gain 1 life.");

export const JUDGE_OF_CURRENTS_SCRIPT: CardScript = {
  oracleId: JUDGE_OF_CURRENTS.oracleId,
  name: JUDGE_OF_CURRENTS.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'PermanentsTapped' && ev.cards.some((c) => ctx.state.cards[c]?.controller === ctx.query.controllerOf(self) && ctx.derive(c).typeLine.subtypes.includes('Merfolk')),
      label: () => "Judge of Currents - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
