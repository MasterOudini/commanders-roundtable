// `Shielded Aether Thief` - a blocks trigger vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHIELDED_AETHER_THIEF } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SHIELDED_AETHER_THIEF, "Flash (You may cast this spell any time you could cast an instant.)\nWhenever this creature blocks, you get {E} (an energy counter).\n{T}, Pay {E}{E}{E}: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You get {E}.", SHIELDED_AETHER_THIEF.name);
const VOCAB_T_L1 = vocabularyTargets("You get {E}.");

export const SHIELDED_AETHER_THIEF_SCRIPT: CardScript = {
  oracleId: SHIELDED_AETHER_THIEF.oracleId,
  name: SHIELDED_AETHER_THIEF.name,
  activated: [
    {
      ref: `${SHIELDED_AETHER_THIEF.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Shielded Aether Thief - You get {E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
