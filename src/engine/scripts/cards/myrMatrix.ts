// `Myr Matrix` - the layer-6 anthem "Myr creatures get +1/+1" (every
// controller's Myr; a StaticDef in the shape of the engine's Levitation, D300)
// and "{5}: Create a 1/1 colorless Myr artifact creature token" - the token it
// makes is a Myr it reaches. Indestructible is the engine's.

import { MYR_MATRIX } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(
  MYR_MATRIX,
  'Indestructible (Effects that say "destroy" don\'t destroy this artifact.)\nMyr creatures get +1/+1.\n{5}: Create a 1/1 colorless Myr artifact creature token.',
);
const LINES = PRINTED.split('\n');
const MYR = tokenRef('Myr|1/1||Artifact Creature|');

export const MYR_MATRIX_SCRIPT: CardScript = {
  oracleId: MYR_MATRIX.oracleId,
  name: MYR_MATRIX.name,
  statics: [
    {
      abilityId: 'anthem',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => {
        const target = ctx.state.cards[candidate];
        if (!target || target.zone.kind !== 'battlefield') return false;
        if (!chars.typeLine.types.includes('Creature')) return false;
        return chars.typeLine.subtypes.includes('Myr');
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
  activated: [
    {
      ref: `${MYR_MATRIX.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: MYR.oracleId,
          printingId: MYR.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
