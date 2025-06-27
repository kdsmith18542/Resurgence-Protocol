import { create } from 'zustand';

interface ResurgenceProtocolState {
  resurgePrice: number | null;
  setResurgePrice: (price: number) => void;
}

export const useResurgenceProtocolStore = create<ResurgenceProtocolState>((set) => ({
  resurgePrice: null,
  setResurgePrice: (price) => set({ resurgePrice: price }),
})); 