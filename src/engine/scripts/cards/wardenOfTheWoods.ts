// `Warden of the Woods` - a becomesTargetedByOpponent trigger drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WARDEN_OF_THE_WOODS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WARDEN_OF_THE_WOODS, "Vigilance (Attacking doesn't cause this creature to tap.)\nWhenever this creature becomes the target of a spell or ability an opponent controls, you may draw two cards.");
const LINES = PRINTED.split('\n');

export const WARDEN_OF_THE_WOODS_SCRIPT: CardScript = {
  oracleId: WARDEN_OF_THE_WOODS.oracleId,
  name: WARDEN_OF_THE_WOODS.name,
  triggers: [
    {
      abilityId: 'becomesTargetedByOpponent-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Warden of the Woods - drawN",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
    {
      abilityId: 'becomesTargetedByOpponentAbility-1',
      text: LINES[1] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Warden of the Woods - drawN",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
  ],
};
