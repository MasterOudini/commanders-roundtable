// `Cinder Wall` - a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CINDER_WALL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CINDER_WALL, "Defender\nWhen this creature blocks, destroy it at end of combat.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy ~ at end of combat.", CINDER_WALL.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy ~ at end of combat.");

export const CINDER_WALL_SCRIPT: CardScript = {
  oracleId: CINDER_WALL.oracleId,
  name: CINDER_WALL.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Cinder Wall - Destroy ~ at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
