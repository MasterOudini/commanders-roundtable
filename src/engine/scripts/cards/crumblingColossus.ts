// `Crumbling Colossus` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CRUMBLING_COLOSSUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CRUMBLING_COLOSSUS, "Trample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)\nWhen this creature attacks, sacrifice it at end of combat.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice ~ at end of combat.", CRUMBLING_COLOSSUS.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice ~ at end of combat.");

export const CRUMBLING_COLOSSUS_SCRIPT: CardScript = {
  oracleId: CRUMBLING_COLOSSUS.oracleId,
  name: CRUMBLING_COLOSSUS.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Crumbling Colossus - Sacrifice ~ at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
