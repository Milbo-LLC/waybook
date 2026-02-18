import { create } from "zustand";

type QueuedUpload = {
  entryId: string;
  uri: string;
  mimeType: string;
  bytes: number;
  fileName: string;
};

type UploadQueueState = {
  queue: QueuedUpload[];
  enqueue: (item: QueuedUpload) => void;
  dequeue: () => QueuedUpload | undefined;
};

export const useUploadQueue = create<UploadQueueState>((set, get) => ({
  queue: [],
  enqueue: (item) => set((state) => ({ queue: [...state.queue, item] })),
  dequeue: () => {
    const [first, ...rest] = get().queue;
    set({ queue: rest });
    return first;
  }
}));
