// `Sun-Spider, Nimble Webber` - a conditional static (as long as it's your turn) threshold, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUN_SPIDER_NIMBLE_WEBBER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUN_SPIDER_NIMBLE_WEBBER, "During your turn, Sun-Spider has flying.\nWhen Sun-Spider enters, search your library for an Aura or Equipment card, reveal it, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for an Aura or Equipment card, reveal it, put it into your hand, then shuffle.", SUN_SPIDER_NIMBLE_WEBBER.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for an Aura or Equipment card, reveal it, put it into your hand, then shuffle.");

// "as long as it's your turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.activePlayer === me;
}


export const SUN_SPIDER_NIMBLE_WEBBER_SCRIPT: CardScript = {
  oracleId: SUN_SPIDER_NIMBLE_WEBBER.oracleId,
  name: SUN_SPIDER_NIMBLE_WEBBER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sun-Spider, Nimble Webber - Search your library for an Aura or Equipment card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
