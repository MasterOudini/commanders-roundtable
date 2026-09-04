// `Sage of the Inward Eye` - a castNoncreature trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAGE_OF_THE_INWARD_EYE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAGE_OF_THE_INWARD_EYE, "Flying\nWhenever you cast a noncreature spell, creatures you control gain lifelink until end of turn.");
const LINES = PRINTED.split('\n');

export const SAGE_OF_THE_INWARD_EYE_SCRIPT: CardScript = {
  oracleId: SAGE_OF_THE_INWARD_EYE.oracleId,
  name: SAGE_OF_THE_INWARD_EYE.name,
  triggers: [
    {
      abilityId: 'castNoncreature-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Sage of the Inward Eye - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["lifelink"] });
        }
        return out;
      },
    },
  ],
};
