// `Belle of the Brawl` - a attacks trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELLE_OF_THE_BRAWL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BELLE_OF_THE_BRAWL, "Menace (This creature can't be blocked except by two or more creatures.)\nWhenever this creature attacks, other Knights you control get +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const BELLE_OF_THE_BRAWL_SCRIPT: CardScript = {
  oracleId: BELLE_OF_THE_BRAWL.oracleId,
  name: BELLE_OF_THE_BRAWL.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Belle of the Brawl - creatures you control pumped until end of turn",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (inst.id === self) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Knight")) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
