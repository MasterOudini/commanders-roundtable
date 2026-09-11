// `Kamahl, Fist of Krosa` - an activation vocab, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KAMAHL_FIST_OF_KROSA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KAMAHL_FIST_OF_KROSA, "{G}: Target land becomes a 1/1 creature until end of turn. It's still a land.\n{2}{G}{G}{G}: Creatures you control get +3/+3 and gain trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target land becomes a 1/1 creature until end of turn. It's still a land.", KAMAHL_FIST_OF_KROSA.name);
const VOCAB_T_A0 = vocabularyTargets("Target land becomes a 1/1 creature until end of turn. It's still a land.");

export const KAMAHL_FIST_OF_KROSA_SCRIPT: CardScript = {
  oracleId: KAMAHL_FIST_OF_KROSA.oracleId,
  name: KAMAHL_FIST_OF_KROSA.name,
  activated: [
    {
      ref: `${KAMAHL_FIST_OF_KROSA.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${KAMAHL_FIST_OF_KROSA.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 3, toughness: 3, keywords: ["trample"] });
        }
        return out;
      },
    },
  ],
};
