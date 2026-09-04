// `Angelic Shield` - a layer-6 anthem, "Creatures you control get +0/+1" (a
// StaticDef in the shape of the engine's Levitation, D300), and "Sacrifice this
// enchantment: Return target creature to its owner's hand".

import { ANGELIC_SHIELD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ANGELIC_SHIELD, "Creatures you control get +0/+1.\nSacrifice this enchantment: Return target creature to its owner's hand.");
const LINES = PRINTED.split('\n');

export const ANGELIC_SHIELD_SCRIPT: CardScript = {
  oracleId: ANGELIC_SHIELD.oracleId,
  name: ANGELIC_SHIELD.name,
  statics: [
    {
      abilityId: 'anthem',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        return chars.typeLine.types.includes('Creature');
      },
      modify: (chars) => {
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
  activated: [
    {
      ref: `${ANGELIC_SHIELD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'hand', player: card.owner } }] }];
      },
    },
  ],
};
