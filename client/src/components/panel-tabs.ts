import { ChatsCircle, DiceFive, Lightning, MapTrifold, Scroll } from '@phosphor-icons/react';

/** The table panel's tabs, in order, for the panel and its folded rail. Mapa exists on the full screen only. */
export const PANEL_TABS = [
  { id: 'map', label: 'Mapa', icon: MapTrifold },
  { id: 'actions', label: 'Ações', icon: Lightning },
  { id: 'dice', label: 'Dados', icon: DiceFive },
  { id: 'feed', label: 'Feed', icon: Scroll },
  { id: 'chat', label: 'Chat', icon: ChatsCircle },
] as const;
