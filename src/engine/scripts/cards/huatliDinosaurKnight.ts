// `Huatli, Dinosaur Knight` - an activation vocab, an activation vocab, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HUATLI_DINOSAUR_KNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HUATLI_DINOSAUR_KNIGHT, "+2: Put two +1/+1 counters on up to one target Dinosaur you control.\n−3: Target Dinosaur you control deals damage equal to its power to target creature you don't control.\n−7: Dinosaurs you control get +4/+4 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put two +1/+1 counters on up to one target Dinosaur you control.", HUATLI_DINOSAUR_KNIGHT.name);
const VOCAB_T_A0 = vocabularyTargets("Put two +1/+1 counters on up to one target Dinosaur you control.");
const VOCAB_A1 = vocabularyEffects("Target Dinosaur you control deals damage equal to its power to target creature you don't control.", HUATLI_DINOSAUR_KNIGHT.name);
const VOCAB_T_A1 = vocabularyTargets("Target Dinosaur you control deals damage equal to its power to target creature you don't control.");

export const HUATLI_DINOSAUR_KNIGHT_SCRIPT: CardScript = {
  oracleId: HUATLI_DINOSAUR_KNIGHT.oracleId,
  name: HUATLI_DINOSAUR_KNIGHT.name,
  activated: [
    {
      ref: `${HUATLI_DINOSAUR_KNIGHT.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${HUATLI_DINOSAUR_KNIGHT.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${HUATLI_DINOSAUR_KNIGHT.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Dinosaur")) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 4, toughness: 4 });
        }
        return out;
      },
    },
  ],
};
