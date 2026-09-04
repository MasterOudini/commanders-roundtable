// `Beregond of the Guard` - a selfOrAnotherHumanEnters trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BEREGOND_OF_THE_GUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BEREGOND_OF_THE_GUARD, "Whenever Beregond or another Human you control enters, creatures you control get +1/+1 and gain vigilance until end of turn.");

export const BEREGOND_OF_THE_GUARD_SCRIPT: CardScript = {
  oracleId: BEREGOND_OF_THE_GUARD.oracleId,
  name: BEREGOND_OF_THE_GUARD.name,
  triggers: [
    {
      abilityId: 'selfOrAnotherHumanEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.subtypes.includes('Human')),
        ),
      label: () => "Beregond of the Guard - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["vigilance"] });
        }
        return out;
      },
    },
  ],
};
