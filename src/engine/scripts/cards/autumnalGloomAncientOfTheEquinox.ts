// `Autumnal Gloom // Ancient of the Equinox` - an activation mill, a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AUTUMNAL_GLOOM_ANCIENT_OF_THE_EQUINOX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AUTUMNAL_GLOOM_ANCIENT_OF_THE_EQUINOX, "{B}: Mill a card.\nDelirium — At the beginning of your end step, if there are four or more card types among cards in your graveyard, transform this enchantment.\nTrample, hexproof");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this enchantment.", AUTUMNAL_GLOOM_ANCIENT_OF_THE_EQUINOX.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this enchantment.");

// "as long as there are four or more card types among cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  const types = new Set<string>();
  for (const id of ctx.state.zones.graveyard[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (!face) continue;
    for (const ty of face.typeLine.types) types.add(ty);
  }
  return types.size >= 4;
}


export const AUTUMNAL_GLOOM_ANCIENT_OF_THE_EQUINOX_SCRIPT: CardScript = {
  oracleId: AUTUMNAL_GLOOM_ANCIENT_OF_THE_EQUINOX.oracleId,
  name: AUTUMNAL_GLOOM_ANCIENT_OF_THE_EQUINOX.name,
  activated: [
    {
      ref: `${AUTUMNAL_GLOOM_ANCIENT_OF_THE_EQUINOX.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 1));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'endStep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Autumnal Gloom // Ancient of the Equinox - Transform this enchantment.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
