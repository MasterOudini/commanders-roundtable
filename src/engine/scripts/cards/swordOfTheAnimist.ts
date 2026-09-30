// `Sword of the Animist` - a static attachedStatic, a equippedCreatureAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SWORD_OF_THE_ANIMIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SWORD_OF_THE_ANIMIST, "Equipped creature gets +1/+1.\nWhenever equipped creature attacks, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\nEquip {2}");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", SWORD_OF_THE_ANIMIST.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");

export const SWORD_OF_THE_ANIMIST_SCRIPT: CardScript = {
  oracleId: SWORD_OF_THE_ANIMIST.oracleId,
  name: SWORD_OF_THE_ANIMIST.name,
  triggers: [
    {
      abilityId: 'equippedCreatureAttacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === ctx.state.cards[self]?.attachedTo),
      label: () => "Sword of the Animist - Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
