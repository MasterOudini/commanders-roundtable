// `Blessing of Leeches` - a upkeep trigger loseLifeSelf, an activation regenerateAttached
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLESSING_OF_LEECHES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLESSING_OF_LEECHES, "Flash\nEnchant creature\nAt the beginning of your upkeep, you lose 1 life.\n{0}: Regenerate enchanted creature.");
const LINES = PRINTED.split('\n');

export const BLESSING_OF_LEECHES_SCRIPT: CardScript = {
  oracleId: BLESSING_OF_LEECHES.oracleId,
  name: BLESSING_OF_LEECHES.name,
  activated: [
    {
      ref: `${BLESSING_OF_LEECHES.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: host }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Blessing of Leeches - loseLifeSelf",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
