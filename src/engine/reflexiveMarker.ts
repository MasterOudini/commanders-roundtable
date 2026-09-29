// D584 / D586 - THE REFLEXIVE TRIGGER'S MARKER (CR 603.12), one builder for both of its sources: D584's paid price (the
// payment's answer, handlers.ts) and D586's mandatory action (after the action's last step, effects.ts). The source is the
// ability's permanent or the spell's card, wherever it is now; a token that has ceased still makes it, off its printing
// (CR 113.7a). Nothing to name - no instance and no printing - and nothing triggers.
import type { EngineDeps } from './loop';
import type { EventBody } from './types/events';
import type { InstanceId, PlayerId, PrintingId } from './types/ids';
import type { ColorLetter } from '../data/cardTypes';
import type { ReflexiveSpec } from './types/oracle';
import type { GameState } from './types/state';
import { faceOf } from './oracle';

export function reflexiveMarker(
  state: GameState,
  deps: EngineDeps,
  src: InstanceId,
  controller: PlayerId,
  reflexive: ReflexiveSpec,
  lkiGone: { readonly printingId: PrintingId; readonly faceIndex: number } | undefined,
  /** D586 - a recoloured spell copy's colours (the copy is the trigger's source, CR 603.7d). */
  sourceColors?: readonly ColorLetter[],
): EventBody | null {
  const inst = state.cards[src];
  const lki = inst ? (inst.isToken ? { printingId: inst.printingId, faceIndex: inst.faceIndex } : undefined) : lkiGone;
  const gonePrinting = !inst && lki ? deps.oracle.byPrinting(lki.printingId) : undefined;
  if (!inst && !gonePrinting) return null;
  const printing = inst ? deps.oracle.byPrinting(inst.printingId) : undefined;
  const name = inst
    ? inst.faceDown ? 'A face-down permanent' : printing ? faceOf(printing, inst.faceIndex).name : 'a card'
    : gonePrinting ? faceOf(gonePrinting, lki?.faceIndex ?? 0).name : 'A token';
  return {
    t: 'ReflexiveTriggered',
    source: src,
    controller,
    label: `${name} - ${reflexive.text.split('~').join(name)}`,
    effects: reflexive.effects,
    specs: reflexive.targets,
    ...(lki !== undefined ? { lki } : {}),
    ...(sourceColors !== undefined ? { sourceColors } : {}),
  };
}
