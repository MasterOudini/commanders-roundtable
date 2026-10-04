// `Gray Slaad // Entropic Decay` - a conditional static (as long as there are four or more creature cards in your graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRAY_SLAAD_ENTROPIC_DECAY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(GRAY_SLAAD_ENTROPIC_DECAY, "As long as there are four or more creature cards in your graveyard, this creature has menace and deathtouch.\nMill four cards. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

// "as long as there are four or more creature cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.zones.graveyard[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (face.typeLine.types.includes("Creature"))) n++;
  }
  return n >= 4;
}


export const GRAY_SLAAD_ENTROPIC_DECAY_SCRIPT: CardScript = {
  oracleId: GRAY_SLAAD_ENTROPIC_DECAY.oracleId,
  name: GRAY_SLAAD_ENTROPIC_DECAY.name,
  statics: [
    {
      abilityId: 'threshold-grant-0', face: 0,
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("menace");
        chars.keywords.add("deathtouch");
      },
    },
  ],
};
