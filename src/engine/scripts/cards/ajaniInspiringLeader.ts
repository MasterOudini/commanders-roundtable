// `Ajani, Inspiring Leader` - an activation vocab, an activation vocab, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AJANI_INSPIRING_LEADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AJANI_INSPIRING_LEADER, "+2: You gain 2 life. Put two +1/+1 counters on up to one target creature.\n−3: Exile target creature. Its controller gains 2 life.\n−10: Creatures you control gain flying and double strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You gain 2 life. Put two +1/+1 counters on up to one target creature.", AJANI_INSPIRING_LEADER.name);
const VOCAB_T_A0 = vocabularyTargets("You gain 2 life. Put two +1/+1 counters on up to one target creature.");
const VOCAB_A1 = vocabularyEffects("Exile target creature. Its controller gains 2 life.", AJANI_INSPIRING_LEADER.name);
const VOCAB_T_A1 = vocabularyTargets("Exile target creature. Its controller gains 2 life.");

export const AJANI_INSPIRING_LEADER_SCRIPT: CardScript = {
  oracleId: AJANI_INSPIRING_LEADER.oracleId,
  name: AJANI_INSPIRING_LEADER.name,
  activated: [
    {
      ref: `${AJANI_INSPIRING_LEADER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${AJANI_INSPIRING_LEADER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${AJANI_INSPIRING_LEADER.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["flying", "doubleStrike"] });
        }
        return out;
      },
    },
  ],
};
