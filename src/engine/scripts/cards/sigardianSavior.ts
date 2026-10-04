// `Sigardian Savior` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIGARDIAN_SAVIOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIGARDIAN_SAVIOR, "Flying\nWhen this creature enters, if you cast it, return up to two target creature cards with mana value 2 or less from your graveyard to the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return up to two target creature cards with mana value 2 or less from your graveyard to the battlefield.", SIGARDIAN_SAVIOR.name);
const VOCAB_T_L1 = vocabularyTargets("Return up to two target creature cards with mana value 2 or less from your graveyard to the battlefield.");

// "as long as you cast it" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.cards[self]?.castFromZone !== undefined;
}


export const SIGARDIAN_SAVIOR_SCRIPT: CardScript = {
  oracleId: SIGARDIAN_SAVIOR.oracleId,
  name: SIGARDIAN_SAVIOR.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Sigardian Savior - Return up to two target creature cards with mana value 2 or less from your graveyard to the battlefield.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
