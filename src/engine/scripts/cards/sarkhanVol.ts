// `Sarkhan Vol` - an activation pumping its controller's creatures, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SARKHAN_VOL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SARKHAN_VOL, "+1: Creatures you control get +1/+1 and gain haste until end of turn.\n−2: Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.\n−6: Create five 4/4 red Dragon creature tokens with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.", SARKHAN_VOL.name);
const VOCAB_T_A1 = vocabularyTargets("Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.");
const VOCAB_A2 = vocabularyEffects("Create five 4/4 red Dragon creature tokens with flying.", SARKHAN_VOL.name);
const VOCAB_T_A2 = vocabularyTargets("Create five 4/4 red Dragon creature tokens with flying.");

export const SARKHAN_VOL_SCRIPT: CardScript = {
  oracleId: SARKHAN_VOL.oracleId,
  name: SARKHAN_VOL.name,
  activated: [
    {
      ref: `${SARKHAN_VOL.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 1, keywords: ["haste"] });
        }
        return out;
      },
    },
    {
      ref: `${SARKHAN_VOL.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${SARKHAN_VOL.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
  ],
};
