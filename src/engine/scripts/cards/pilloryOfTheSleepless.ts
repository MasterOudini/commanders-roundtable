// `Pillory of the Sleepless` - a static attachedCombat, a static attachedStatic, a upkeep trigger loseLifeSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PILLORY_OF_THE_SLEEPLESS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(PILLORY_OF_THE_SLEEPLESS, "Enchant creature\nEnchanted creature can't attack or block.\nEnchanted creature has \"At the beginning of your upkeep, you lose 1 life.\"");
const LINES = PRINTED.split('\n');

const GRANT_2 = grantedTriggerRef(`${PILLORY_OF_THE_SLEEPLESS.oracleId}#gt2`, PILLORY_OF_THE_SLEEPLESS.name);

export const PILLORY_OF_THE_SLEEPLESS_SCRIPT: CardScript = {
  oracleId: PILLORY_OF_THE_SLEEPLESS.oracleId,
  name: PILLORY_OF_THE_SLEEPLESS.name,
  triggers: [
    {
      abilityId: 'gt2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Pillory of the Sleepless - loseLifeSelf",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
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
        chars.grantedTriggered.push({ provider: self, ref: GRANT_2 });
      },
    },
  ],
  combat: [
    {
      abilityId: 'attached-combat-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttack: (ctx, self, candidate) => ctx.state.cards[self]?.attachedTo !== candidate,
      canBlock: (ctx, self, blocker) => ctx.state.cards[self]?.attachedTo !== blocker,
    },
  ],
};
