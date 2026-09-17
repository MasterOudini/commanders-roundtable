// `Bloodstoke Howler` - a turnedFaceUp trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODSTOKE_HOWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODSTOKE_HOWLER, "Morph {6}{R} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)\nWhen this creature is turned face up, Beast creatures you control get +3/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const BLOODSTOKE_HOWLER_SCRIPT: CardScript = {
  oracleId: BLOODSTOKE_HOWLER.oracleId,
  name: BLOODSTOKE_HOWLER.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-1',
      text: LINES[1] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Bloodstoke Howler - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Beast")) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 3, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
