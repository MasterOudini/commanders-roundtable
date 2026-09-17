// `Vito, Thorn of the Dusk Rose` - a youGainLife trigger vocab, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VITO_THORN_OF_THE_DUSK_ROSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VITO_THORN_OF_THE_DUSK_ROSE, "Whenever you gain life, target opponent loses that much life.\n{3}{B}{B}: Creatures you control gain lifelink until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target opponent loses that much life.", VITO_THORN_OF_THE_DUSK_ROSE.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Target opponent loses that much life.");

export const VITO_THORN_OF_THE_DUSK_ROSE_SCRIPT: CardScript = {
  oracleId: VITO_THORN_OF_THE_DUSK_ROSE.oracleId,
  name: VITO_THORN_OF_THE_DUSK_ROSE.name,
  activated: [
    {
      ref: `${VITO_THORN_OF_THE_DUSK_ROSE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 0, toughness: 0, keywords: ["lifelink"] });
        }
        return out;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: LINES[0] as string,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      memo: (_ctx, _self, ev) => (ev.t === 'LifeChanged' && ev.delta > 0 ? ev.delta : 0),
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Vito, Thorn of the Dusk Rose - Target opponent loses that much life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
