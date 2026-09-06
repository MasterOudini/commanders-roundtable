// `Asceticism` - a static anthem, an activation regenerateTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASCETICISM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASCETICISM, "Creatures you control have hexproof.\n{1}{G}: Regenerate target creature. (The next time it would be destroyed this turn, instead tap it, remove it from combat, and heal all damage on it.)");
const LINES = PRINTED.split('\n');

export const ASCETICISM_SCRIPT: CardScript = {
  oracleId: ASCETICISM.oracleId,
  name: ASCETICISM.name,
  activated: [
    {
      ref: `${ASCETICISM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: target.id }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("hexproof");
      },
    },
  ],
};
