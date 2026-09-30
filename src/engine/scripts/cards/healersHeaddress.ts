// `Healer's Headdress` - a static attachedStatic, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEALER_S_HEADDRESS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
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

const PRINTED = printed(HEALER_S_HEADDRESS, "Equipped creature gets +0/+2 and has \"{T}: Prevent the next 1 damage that would be dealt to any target this turn.\"\n{W}{W}: Attach this Equipment to target creature you control.\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Attach this Equipment to target creature you control.", HEALER_S_HEADDRESS.name);
const VOCAB_T_A0 = vocabularyTargets("Attach this Equipment to target creature you control.");
const VOCAB_G0 = vocabularyEffects("Prevent the next 1 damage that would be dealt to any target this turn.", HEALER_S_HEADDRESS.name);
const VOCAB_T_G0 = vocabularyTargets("Prevent the next 1 damage that would be dealt to any target this turn.");

const GRANT_0 = grantedActivated("{T}: Prevent the next 1 damage that would be dealt to any target this turn.", `${HEALER_S_HEADDRESS.oracleId}#g0`, HEALER_S_HEADDRESS.name);

export const HEALERS_HEADDRESS_SCRIPT: CardScript = {
  oracleId: HEALER_S_HEADDRESS.oracleId,
  name: HEALER_S_HEADDRESS.name,
  activated: [
    {
      ref: `${HEALER_S_HEADDRESS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: GRANT_0.ref,
      text: LINES[0] as string,
      granted: GRANT_0.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G0, VOCAB_T_G0);
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
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_0.ref, ability: GRANT_0.ability });
      },
    },
  ],
};
