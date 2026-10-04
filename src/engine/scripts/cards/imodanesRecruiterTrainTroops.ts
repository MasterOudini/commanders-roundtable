// `Imodane's Recruiter // Train Troops` - a etb trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMODANE_S_RECRUITER_TRAIN_TROOPS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(IMODANE_S_RECRUITER_TRAIN_TROOPS, "When this creature enters, creatures you control get +1/+0 and gain haste until end of turn.\nCreate two 2/2 white Knight creature tokens with vigilance. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

export const IMODANES_RECRUITER_TRAIN_TROOPS_SCRIPT: CardScript = {
  oracleId: IMODANE_S_RECRUITER_TRAIN_TROOPS.oracleId,
  name: IMODANE_S_RECRUITER_TRAIN_TROOPS.name,
  triggers: [
    {
      abilityId: 'etb-0', face: 0,
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Imodane's Recruiter // Train Troops - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.phasedOut || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0, keywords: ["haste"] });
        }
        return out;
      },
    },
  ],
};
