// `Éomer, King of Rohan` - a static entersWithCountersPer, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OMER_KING_OF_ROHAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OMER_KING_OF_ROHAN, "Double strike\nÉomer enters with a +1/+1 counter on it for each other Human you control.\nWhen Éomer enters, target player becomes the monarch. Éomer deals damage equal to its power to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target player becomes the monarch. ~ deals damage equal to its power to any target.", OMER_KING_OF_ROHAN.name);
const VOCAB_T_L2 = vocabularyTargets("Target player becomes the monarch. ~ deals damage equal to its power to any target.");

// "other Human you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    if (inst.id === self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes('Human')) continue;
    n++;
  }
  return n;
}


export const OMER_KING_OF_ROHAN_SCRIPT: CardScript = {
  oracleId: OMER_KING_OF_ROHAN.oracleId,
  name: OMER_KING_OF_ROHAN.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Éomer, King of Rohan - Target player becomes the monarch. ~ deals damage equal to its power to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (ctx, self, ev): readonly EventBody[] => {
        const n = countOf_1(ctx, self);
        return n > 0 ? [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: n }] }] : [ev];
      },
    },
  ],
};
