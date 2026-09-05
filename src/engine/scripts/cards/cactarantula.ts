// `Cactarantula` - a becomesTargetedByOpponent trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CACTARANTULA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CACTARANTULA, "This spell costs {1} less to cast if you control a Desert.\nReach\nWhenever this creature becomes the target of a spell or ability an opponent controls, you may draw a card.");
const LINES = PRINTED.split('\n');

export const CACTARANTULA_SCRIPT: CardScript = {
  oracleId: CACTARANTULA.oracleId,
  name: CACTARANTULA.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByOpponent-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Cactarantula - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'becomesTargetedByOpponentAbility-2',
      text: LINES[2] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Cactarantula - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
