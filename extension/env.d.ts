/// <reference types="vite/client" />

declare namespace chrome {
  namespace identity {
    function getRedirectURL(path?: string): string;
    function launchWebAuthFlow(
      details: { url: string; interactive: boolean },
      callback: (responseUrl?: string) => void
    ): void;
  }

  namespace tabs {
    function create(props: { url: string; active?: boolean }): void;
  }

  namespace runtime {
    const id: string | undefined;
    const lastError: { message?: string } | undefined;
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
      addListener(callback: (details: { reason: string }) => void): void;
    };
  }

  namespace storage {
    const local: {
      get(keys: string | string[]): Promise<Record<string, any>>;
      get(
        keys: string | string[],
        callback: (items: Record<string, any>) => void
      ): void;
      set(items: Record<string, any>): Promise<void>;
      set(items: Record<string, any>, callback?: () => void): void;
      remove(keys: string | string[]): Promise<void>;
      remove(keys: string | string[], callback?: () => void): void;
    };
    const onChanged: {
      addListener(
        callback: (
          changes: Record<string, { oldValue?: any; newValue?: any }>,
          areaName: string
        ) => void
      ): void;
    };
  }
}
