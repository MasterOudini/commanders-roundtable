// `Ultima Weapon` - a equippedCreatureAttacks trigger vocab, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ULTIMA_WEAPON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ULTIMA_WEAPON, "Whenever equipped creature attacks, destroy target creature an opponent controls.\nEquipped creature gets +7/+7.\nEquip {7}");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Destroy target creature an opponent controls.", ULTIMA_WEAPON.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target creature an opponent controls.");

export const ULTIMA_WEAPON_SCRIPT: CardScript = {
  oracleId: ULTIMA_WEAPON.oracleId,
  name: ULTIMA_WEAPON.name,
  triggers: [
    {
      abilityId: 'equippedCreatureAttacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === ctx.state.cards[self]?.attachedTo),
      label: () => "Ultima Weapon - Destroy target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
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
        if (chars.power !== null) chars.power += 7;
        if (chars.toughness !== null) chars.toughness += 7;
      },
    },
  ],
};
