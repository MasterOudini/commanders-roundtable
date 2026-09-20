// `Skarrg Guildmage` - an activation pumping its controller's creatures, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKARRG_GUILDMAGE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SKARRG_GUILDMAGE, "{R}{G}: Creatures you control gain trample until end of turn.\n{1}{R}{G}: Target land you control becomes a 4/4 Elemental creature until end of turn. It's still a land.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target land you control becomes a 4/4 Elemental creature until end of turn. It's still a land.", SKARRG_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Target land you control becomes a 4/4 Elemental creature until end of turn. It's still a land.");

export const SKARRG_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: SKARRG_GUILDMAGE.oracleId,
  name: SKARRG_GUILDMAGE.name,
  activated: [
    {
      ref: `${SKARRG_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["trample"] });
        }
        return out;
      },
    },
    {
      ref: `${SKARRG_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
