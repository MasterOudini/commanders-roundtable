// `Stoic Ephemera` - a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STOIC_EPHEMERA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STOIC_EPHEMERA, "Defender (This creature can't attack.)\nFlying\nWhen this creature blocks, sacrifice it at end of combat.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Sacrifice ~ at end of combat.", STOIC_EPHEMERA.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice ~ at end of combat.");

export const STOIC_EPHEMERA_SCRIPT: CardScript = {
  oracleId: STOIC_EPHEMERA.oracleId,
  name: STOIC_EPHEMERA.name,
  triggers: [
    {
      abilityId: 'blocks-2',
      text: LINES[2] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Stoic Ephemera - Sacrifice ~ at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
