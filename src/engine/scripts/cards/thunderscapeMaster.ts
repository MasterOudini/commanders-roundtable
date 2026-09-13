// `Thunderscape Master` - an activation vocab, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THUNDERSCAPE_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THUNDERSCAPE_MASTER, "{B}{B}, {T}: Target player loses 2 life and you gain 2 life.\n{G}{G}, {T}: Creatures you control get +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target player loses 2 life and you gain 2 life.", THUNDERSCAPE_MASTER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player loses 2 life and you gain 2 life.");

export const THUNDERSCAPE_MASTER_SCRIPT: CardScript = {
  oracleId: THUNDERSCAPE_MASTER.oracleId,
  name: THUNDERSCAPE_MASTER.name,
  activated: [
    {
      ref: `${THUNDERSCAPE_MASTER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${THUNDERSCAPE_MASTER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 2 });
        }
        return out;
      },
    },
  ],
};
