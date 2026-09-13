// `Voldaren Ambusher` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOLDAREN_AMBUSHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOLDAREN_AMBUSHER, "When this creature enters, if an opponent lost life this turn, it deals X damage to up to one target creature or planeswalker, where X is the number of Vampires you control.");

const VOCAB_L0 = vocabularyEffects("~ deals X damage to up to one target creature or planeswalker, where X is the number of Vampires you control.", VOLDAREN_AMBUSHER.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals X damage to up to one target creature or planeswalker, where X is the number of Vampires you control.");

// "as long as an opponent lost life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.some((p) => p !== me && ctx.state.turn.memory.lostLife[p] === true);
}


export const VOLDAREN_AMBUSHER_SCRIPT: CardScript = {
  oracleId: VOLDAREN_AMBUSHER.oracleId,
  name: VOLDAREN_AMBUSHER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Voldaren Ambusher - ~ deals X damage to up to one target creature or planeswalker, where X is the number of Vampires you control.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
