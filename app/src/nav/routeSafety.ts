import type { Route } from './Nav';

/** A game remains active while any game screen is still on the navigation stack. */
export function stackHasActiveGame(stack: readonly { r: Route }[]): boolean {
  return stack.some(({ r }) => r.name === 'game');
}
