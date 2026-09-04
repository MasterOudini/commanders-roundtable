// `Swarm Guildmage` - an activation pumping its controller's creatures, an activation gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SWARM_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SWARM_GUILDMAGE, "{4}{B}, {T}: Creatures you control get +1/+0 and gain menace until end of turn. (They can't be blocked except by two or more creatures.)\n{1}{G}, {T}: You gain 2 life.");
const LINES = PRINTED.split('\n');

export const SWARM_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: SWARM_GUILDMAGE.oracleId,
  name: SWARM_GUILDMAGE.name,
  activated: [
    {
      ref: `${SWARM_GUILDMAGE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0, keywords: ["menace"] });
        }
        return out;
      },
    },
    {
      ref: `${SWARM_GUILDMAGE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
