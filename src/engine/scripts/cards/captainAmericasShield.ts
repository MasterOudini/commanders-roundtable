// `Captain America's Shield` - a static attachedStatic, a equippedCreatureAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTAIN_AMERICA_S_SHIELD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTAIN_AMERICA_S_SHIELD, "Indestructible\nEquipped creature gets +0/+8 and has vigilance.\nWhenever equipped creature attacks, tap target creature defending player controls.\nEquip {2}");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Tap target creature defending player controls.", CAPTAIN_AMERICA_S_SHIELD.name);
const VOCAB_T_L2 = vocabularyTargets("Tap target creature defending player controls.");

export const CAPTAIN_AMERICAS_SHIELD_SCRIPT: CardScript = {
  oracleId: CAPTAIN_AMERICA_S_SHIELD.oracleId,
  name: CAPTAIN_AMERICA_S_SHIELD.name,
  triggers: [
    {
      abilityId: 'equippedCreatureAttacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === ctx.state.cards[self]?.attachedTo),
      label: () => "Captain America's Shield - Tap target creature defending player controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 8;
      },
    },
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("vigilance");
      },
    },
  ],
};
