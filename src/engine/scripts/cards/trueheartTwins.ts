// `Trueheart Twins` - a youExertCreature trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRUEHEART_TWINS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRUEHEART_TWINS, "You may exert this creature as it attacks. (It won't untap during your next untap step.)\nWhenever you exert a creature, creatures you control get +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const TRUEHEART_TWINS_SCRIPT: CardScript = {
  oracleId: TRUEHEART_TWINS.oracleId,
  name: TRUEHEART_TWINS.name,
  triggers: [
    {
      abilityId: 'youExertCreature-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'Exerted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Trueheart Twins - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
