// `Warded Battlements` - a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WARDED_BATTLEMENTS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

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

const PRINTED = printed(WARDED_BATTLEMENTS, "Defender (This creature can't attack.)\nAttacking creatures you control get +1/+0.");
const LINES = PRINTED.split('\n');

export const WARDED_BATTLEMENTS_SCRIPT: CardScript = {
  oracleId: WARDED_BATTLEMENTS.oracleId,
  name: WARDED_BATTLEMENTS.name,
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && (ctx.state.combat?.attackers.some((x) => x.card === candidate) ?? false) && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
