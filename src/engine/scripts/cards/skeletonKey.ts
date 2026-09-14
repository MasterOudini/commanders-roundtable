// `Skeleton Key` - a static attachedStatic, a equippedCreatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKELETON_KEY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKELETON_KEY, "Equipped creature has skulk. (It can't be blocked by creatures with greater power.)\nWhenever equipped creature deals combat damage to a player, you may draw a card. If you do, discard a card.\nEquip {2}");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Draw a card. If you do, discard a card.", SKELETON_KEY.name);
const VOCAB_T_L1 = vocabularyTargets("Draw a card. If you do, discard a card.");

export const SKELETON_KEY_SCRIPT: CardScript = {
  oracleId: SKELETON_KEY.oracleId,
  name: SKELETON_KEY.name,
  triggers: [
    {
      abilityId: 'equippedCreatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player' && d.amount > 0),
      label: () => "Skeleton Key - Draw a card. If you do, discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("skulk");
      },
    },
  ],
};
