// `Curious Homunculus // Voracious Reader` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CURIOUS_HOMUNCULUS_VORACIOUS_READER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
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

const PRINTED = printed(CURIOUS_HOMUNCULUS_VORACIOUS_READER, "{T}: Add {C}. Spend this mana only to cast an instant or sorcery spell.\nAt the beginning of your upkeep, if there are three or more instant and/or sorcery cards in your graveyard, transform this creature.\nProwess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nInstant and sorcery spells you cast cost {1} less to cast.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", CURIOUS_HOMUNCULUS_VORACIOUS_READER.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");

// "as long as there are three or more instant and/or sorcery cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.zones.graveyard[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (face.typeLine.types.includes('Instant') || face.typeLine.types.includes('Sorcery'))) n++;
  }
  return n >= 3;
}


export const CURIOUS_HOMUNCULUS_VORACIOUS_READER_SCRIPT: CardScript = {
  oracleId: CURIOUS_HOMUNCULUS_VORACIOUS_READER.oracleId,
  name: CURIOUS_HOMUNCULUS_VORACIOUS_READER.name,
  triggers: [
    {
      abilityId: 'upkeep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Curious Homunculus // Voracious Reader - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
