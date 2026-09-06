// `Appa, the Vigilant` - a selfOrAnotherAllyEnters trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { APPA_THE_VIGILANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(APPA_THE_VIGILANT, "Flying, vigilance\nWhenever Appa or another Ally you control enters, creatures you control get +1/+1 and gain flying and vigilance until end of turn.");
const LINES = PRINTED.split('\n');

export const APPA_THE_VIGILANT_SCRIPT: CardScript = {
  oracleId: APPA_THE_VIGILANT.oracleId,
  name: APPA_THE_VIGILANT.name,
  triggers: [
    {
      abilityId: 'selfOrAnotherAllyEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.subtypes.includes('Ally')),
        ),
      label: () => "Appa, the Vigilant - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["flying", "vigilance"] });
        }
        return out;
      },
    },
  ],
};
