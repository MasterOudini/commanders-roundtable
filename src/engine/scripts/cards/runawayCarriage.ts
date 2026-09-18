// `Runaway Carriage` - a attacks trigger vocab, a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUNAWAY_CARRIAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUNAWAY_CARRIAGE, "Trample\nWhen this creature attacks or blocks, sacrifice it at end of combat.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice ~ at end of combat.", RUNAWAY_CARRIAGE.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice ~ at end of combat.");

export const RUNAWAY_CARRIAGE_SCRIPT: CardScript = {
  oracleId: RUNAWAY_CARRIAGE.oracleId,
  name: RUNAWAY_CARRIAGE.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Runaway Carriage - Sacrifice ~ at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Runaway Carriage - Sacrifice ~ at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
