// `Scepter of Celebration` - a static attachedStatic, a equippedCreatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCEPTER_OF_CELEBRATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCEPTER_OF_CELEBRATION, "Equipped creature gets +2/+0 and has trample.\nWhenever equipped creature deals combat damage to a player, create that many 1/1 green and white Citizen creature tokens.\nEquip {3}");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create that many 1/1 green and white Citizen creature tokens.", SCEPTER_OF_CELEBRATION.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Create that many 1/1 green and white Citizen creature tokens.");

export const SCEPTER_OF_CELEBRATION_SCRIPT: CardScript = {
  oracleId: SCEPTER_OF_CELEBRATION.oracleId,
  name: SCEPTER_OF_CELEBRATION.name,
  triggers: [
    {
      abilityId: 'equippedCreatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (ctx, self, ev) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0),
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player' && d.amount > 0),
      label: () => "Scepter of Celebration - Create that many 1/1 green and white Citizen creature tokens.",
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
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
