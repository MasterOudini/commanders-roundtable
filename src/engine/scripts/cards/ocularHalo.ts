// `Ocular Halo` - a static attachedStatic, an activation attachedTemp, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OCULAR_HALO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OCULAR_HALO, "Enchant creature\nEnchanted creature has \"{T}: Draw a card.\"\n{W}: Enchanted creature gains vigilance until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_G1 = vocabularyEffects("Draw a card.", OCULAR_HALO.name);
const VOCAB_T_G1 = vocabularyTargets("Draw a card.");

const GRANT_1 = grantedActivated("{T}: Draw a card.", `${OCULAR_HALO.oracleId}#g1`, OCULAR_HALO.name);

export const OCULAR_HALO_SCRIPT: CardScript = {
  oracleId: OCULAR_HALO.oracleId,
  name: OCULAR_HALO.name,
  activated: [
    {
      ref: `${OCULAR_HALO.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 0, toughness: 0, keywords: ["vigilance"] }];
      },
    },
    {
      ref: GRANT_1.ref,
      text: LINES[1] as string,
      granted: GRANT_1.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G1, VOCAB_T_G1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_1.ref, ability: GRANT_1.ability });
      },
    },
  ],
};
