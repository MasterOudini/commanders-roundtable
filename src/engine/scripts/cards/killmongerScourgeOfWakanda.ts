// `Killmonger, Scourge of Wakanda` - a etb trigger vocab, a conditional static (as long as there are two or more creature cards in your graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KILLMONGER_SCOURGE_OF_WAKANDA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KILLMONGER_SCOURGE_OF_WAKANDA, "When Killmonger enters, you may sacrifice another creature. When you do, destroy target nonland permanent an opponent controls.\nAs long as there are two or more creature cards in your graveyard, Killmonger gets +2/+1.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may sacrifice another creature. When you do, destroy target nonland permanent an opponent controls.", KILLMONGER_SCOURGE_OF_WAKANDA.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice another creature. When you do, destroy target nonland permanent an opponent controls.");

// "as long as there are two or more creature cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.zones.graveyard[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (face.typeLine.types.includes("Creature"))) n++;
  }
  return n >= 2;
}


export const KILLMONGER_SCOURGE_OF_WAKANDA_SCRIPT: CardScript = {
  oracleId: KILLMONGER_SCOURGE_OF_WAKANDA.oracleId,
  name: KILLMONGER_SCOURGE_OF_WAKANDA.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Killmonger, Scourge of Wakanda - You may sacrifice another creature. When you do, destroy target nonland permanent an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
