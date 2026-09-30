// `Decimator of the Provinces` - a castThisSpell trigger pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DECIMATOR_OF_THE_PROVINCES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DECIMATOR_OF_THE_PROVINCES, "Emerge {6}{G}{G}{G} (You may cast this spell by sacrificing a creature and paying the emerge cost reduced by that creature's mana value.)\nWhen you cast this spell, creatures you control get +2/+2 and gain trample until end of turn.\nTrample, haste");
const LINES = PRINTED.split('\n');

export const DECIMATOR_OF_THE_PROVINCES_SCRIPT: CardScript = {
  oracleId: DECIMATOR_OF_THE_PROVINCES.oracleId,
  name: DECIMATOR_OF_THE_PROVINCES.name,
  triggers: [
    {
      abilityId: 'castThisSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ["stack"],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => "Decimator of the Provinces - creatures you control pumped until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.phasedOut || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 2, keywords: ["trample"] });
        }
        return out;
      },
    },
  ],
};
