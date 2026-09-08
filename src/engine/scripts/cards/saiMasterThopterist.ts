// `Sai, Master Thopterist` - a castArtifactSpell trigger token, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAI_MASTER_THOPTERIST } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SAI_MASTER_THOPTERIST, "Whenever you cast an artifact spell, create a 1/1 colorless Thopter artifact creature token with flying.\n{1}{U}, Sacrifice two artifacts: Draw a card.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Thopter|1/1||Artifact Creature|flying");

export const SAI_MASTER_THOPTERIST_SCRIPT: CardScript = {
  oracleId: SAI_MASTER_THOPTERIST.oracleId,
  name: SAI_MASTER_THOPTERIST.name,
  activated: [
    {
      ref: `${SAI_MASTER_THOPTERIST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castArtifactSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Sai, Master Thopterist - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
