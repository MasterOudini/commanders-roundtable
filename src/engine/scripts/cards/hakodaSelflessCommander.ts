// `Hakoda, Selfless Commander` - a static topOfLibrary, a static topOfLibrary, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAKODA_SELFLESS_COMMANDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAKODA_SELFLESS_COMMANDER, "Vigilance\nYou may look at the top card of your library any time.\nYou may cast Ally spells from the top of your library.\nSacrifice Hakoda: Creatures you control get +0/+5 and gain indestructible until end of turn.");
const LINES = PRINTED.split('\n');

export const HAKODA_SELFLESS_COMMANDER_SCRIPT: CardScript = {
  oracleId: HAKODA_SELFLESS_COMMANDER.oracleId,
  name: HAKODA_SELFLESS_COMMANDER.name,
  activated: [
    {
      ref: `${HAKODA_SELFLESS_COMMANDER.oracleId}#a0`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.phasedOut || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 5, keywords: ["indestructible"] });
        }
        return out;
      },
    },
  ],
  topOfLibrary: [
    { abilityId: "top-1", text: LINES[1] as string, look: true },
    { abilityId: "top-2", text: LINES[2] as string, spells: {"predicates":[{"supertypes":[],"types":[],"subtypes":["Ally"],"colors":[]}]} },
  ],
};
