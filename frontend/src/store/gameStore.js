import { create } from 'zustand';

const useGameStore = create((set) => ({
  gameId: null,
  cards: { head: [], middle: [], tail: [] }, // {id, suit, rank, value, image}
  setInitialCards: (gameId, cards) => set({ gameId, cards }),
  setCards: (newCards) => set({ cards: newCards }),
  clearGame: () => set({ gameId: null, cards: { head: [], middle: [], tail: [] } }),
}));

export default useGameStore;