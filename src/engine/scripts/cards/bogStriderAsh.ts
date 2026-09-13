// `Bog-Strider Ash` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOG_STRIDER_ASH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOG_STRIDER_ASH, "Swampwalk (This creature can't be blocked as long as defending player controls a Swamp.)\nWhenever a player casts a Goblin spell, you may pay {G}. If you do, you gain 2 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {G}. If you do, you gain 2 life.", BOG_STRIDER_ASH.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {G}. If you do, you gain 2 life.");

export const BOG_STRIDER_ASH_SCRIPT: CardScript = {
  oracleId: BOG_STRIDER_ASH.oracleId,
  name: BOG_STRIDER_ASH.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ctx.derive(ev.obj.card).typeLine.subtypes.includes('Goblin'),
      label: () => "Bog-Strider Ash - You may pay {G}. If you do, you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
