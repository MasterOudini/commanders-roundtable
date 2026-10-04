// `Myojin of Life's Web` - a static entersWithCounters, a conditional static (as long as it has a divinity counter on it) threshold, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYOJIN_OF_LIFE_S_WEB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MYOJIN_OF_LIFE_S_WEB, "Myojin of Life's Web enters with a divinity counter on it if you cast it from your hand.\nMyojin of Life's Web has indestructible as long as it has a divinity counter on it.\nRemove a divinity counter from Myojin of Life's Web: Put any number of creature cards from your hand onto the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put any number of creature cards from your hand onto the battlefield.", MYOJIN_OF_LIFE_S_WEB.name);
const VOCAB_T_A0 = vocabularyTargets("Put any number of creature cards from your hand onto the battlefield.");

// "as long as it has a divinity counter on it" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ((ctx.state.cards[self]?.counters["divinity"] ?? 0) > 0) === true;
}



export const MYOJIN_OF_LIFES_WEB_SCRIPT: CardScript = {
  oracleId: MYOJIN_OF_LIFE_S_WEB.oracleId,
  name: MYOJIN_OF_LIFE_S_WEB.name,
  activated: [
    {
      ref: `${MYOJIN_OF_LIFE_S_WEB.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        (ev.t === 'CardsMoved' && ev.moves.find((m) => m.card === self)?.castFromZone === 'hand') && ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "divinity", delta: 1 }] }],
    },
  ],
  statics: [
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("indestructible");
      },
    },
  ],
};
