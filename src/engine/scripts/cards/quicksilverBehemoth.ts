// `Quicksilver Behemoth` - a attacks trigger vocab, a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUICKSILVER_BEHEMOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUICKSILVER_BEHEMOTH, "Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)\nWhen this creature attacks or blocks, return it to its owner's hand at end of combat. (Return it only if it's on the battlefield.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return ~ to its owner's hand at end of combat.", QUICKSILVER_BEHEMOTH.name);
const VOCAB_T_L1 = vocabularyTargets("Return ~ to its owner's hand at end of combat.");

export const QUICKSILVER_BEHEMOTH_SCRIPT: CardScript = {
  oracleId: QUICKSILVER_BEHEMOTH.oracleId,
  name: QUICKSILVER_BEHEMOTH.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Quicksilver Behemoth - Return ~ to its owner's hand at end of combat.",
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
      label: () => "Quicksilver Behemoth - Return ~ to its owner's hand at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
