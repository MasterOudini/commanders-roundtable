// `Erkenbrand, Lord of Westfold` - a selfOrAnotherHumanEnters trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ERKENBRAND_LORD_OF_WESTFOLD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ERKENBRAND_LORD_OF_WESTFOLD, "Whenever Erkenbrand or another Human you control enters, creatures you control get +1/+0 until end of turn.");

export const ERKENBRAND_LORD_OF_WESTFOLD_SCRIPT: CardScript = {
  oracleId: ERKENBRAND_LORD_OF_WESTFOLD.oracleId,
  name: ERKENBRAND_LORD_OF_WESTFOLD.name,
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
      label: () => "Erkenbrand, Lord of Westfold - creatures you control pumped until end of turn",
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
