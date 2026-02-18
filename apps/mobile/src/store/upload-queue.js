import { create } from "zustand";
export const useUploadQueue = create((set, get) => ({
    queue: [],
    enqueue: (item) => set((state) => ({ queue: [...state.queue, item] })),
    dequeue: () => {
        const [first, ...rest] = get().queue;
        set({ queue: rest });
        return first;
    }
}));
