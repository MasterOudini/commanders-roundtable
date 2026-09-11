// `Oran-Rief Recluse` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ORAN_RIEF_RECLUSE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(ORAN_RIEF_RECLUSE, "Kicker {2}{G} (You may pay an additional {2}{G} as you cast this spell.)\nReach (This creature can block creatures with flying.)\nWhen this creature enters, if it was kicked, destroy target creature with flying.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Destroy target creature with flying.", ORAN_RIEF_RECLUSE.name);
const VOCAB_T_L2 = vocabularyTargets("Destroy target creature with flying.");

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const ORAN_RIEF_RECLUSE_SCRIPT: CardScript = {
  oracleId: ORAN_RIEF_RECLUSE.oracleId,
  name: ORAN_RIEF_RECLUSE.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Oran-Rief Recluse - Destroy target creature with flying.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
