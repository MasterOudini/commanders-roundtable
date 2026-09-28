// `Fangblade Brigand // Fangblade Eviscerator` - an activation pumping itself, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FANGBLADE_BRIGAND_FANGBLADE_EVISCERATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FANGBLADE_BRIGAND_FANGBLADE_EVISCERATOR, "{1}{R}: This creature gets +1/+0 and gains first strike until end of turn.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\n{1}{R}: This creature gets +1/+0 and gains first strike until end of turn.\n{4}{R}: Creatures you control get +2/+0 until end of turn.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

export const FANGBLADE_BRIGAND_FANGBLADE_EVISCERATOR_SCRIPT: CardScript = {
  oracleId: FANGBLADE_BRIGAND_FANGBLADE_EVISCERATOR.oracleId,
  name: FANGBLADE_BRIGAND_FANGBLADE_EVISCERATOR.name,
  activated: [
    {
      ref: `${FANGBLADE_BRIGAND_FANGBLADE_EVISCERATOR.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
    {
      ref: `${FANGBLADE_BRIGAND_FANGBLADE_EVISCERATOR.oracleId}#a1`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.phasedOut || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 0 });
        }
        return out;
      },
    },
  ],
};
