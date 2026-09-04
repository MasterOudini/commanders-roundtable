// `Sunscape Master` - an activation pumping its controller's creatures, an activation bounceTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSCAPE_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSCAPE_MASTER, "{G}{G}, {T}: Creatures you control get +2/+2 until end of turn.\n{U}{U}, {T}: Return target creature to its owner's hand.");
const LINES = PRINTED.split('\n');

export const SUNSCAPE_MASTER_SCRIPT: CardScript = {
  oracleId: SUNSCAPE_MASTER.oracleId,
  name: SUNSCAPE_MASTER.name,
  activated: [
    {
      ref: `${SUNSCAPE_MASTER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 2, toughness: 2 });
        }
        return out;
      },
    },
    {
      ref: `${SUNSCAPE_MASTER.oracleId}#a1`,
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
