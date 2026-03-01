/// <reference types="vite/client" />

declare namespace chrome {
  namespace runtime {
    const id: string | undefined;
    function sendMessage(
      message: any,
      responseCallback?: (response: any) => void
    ): void;
    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: any,
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
    };
    const onInstalled: {
      addListener(callback: () => void): void;
    };
  }
  namespace storage {
    const local: {
      get(
        keys: string | string[],
        callback: (items: Record<string, any>) => void
      ): void;
      set(items: Record<string, any>, callback?: () => void): void;
      remove(keys: string | string[], callback?: () => void): void;
    };
  }
}
