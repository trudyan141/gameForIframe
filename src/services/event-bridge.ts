export enum GameMessageType {
  // Outgoing (Game -> Parent)
  WALLET_CREATED = 'WALLET_CREATED',
  GAME_PLAY_RESULT = 'GAME_PLAY_RESULT',
  GAME_LOGOUT = 'GAME_LOGOUT',

  // Incoming (Parent -> Game)
  WALLET_CONFIRMED = 'WALLET_CONFIRMED',
  REWARD_SENT = 'REWARD_SENT',
  HOUSE_CHANGED = 'HOUSE_CHANGED',
}

export interface WalletCreatedPayload {
  walletAddress: string;
}

export interface GamePlayResultPayload {
  isWin: boolean;
  diceValues: [number, number, number];
  total: number;
  choice: 'big' | 'small';
  winAmount: number;
}

export interface WalletConfirmedPayload {
  status: 'SUCCESS' | 'FAIL';
  abstractAccountAddress?: string;
  tokenAddress?: string;
  tx?: string;
  error?: string;
}

export interface RewardSentPayload {
  status: 'success' | 'failure';
  txHash?: string;
  rewardAmount?: string | number;
  error?: string;
}

export interface HouseChangedPayload {
  addressPaysReward: string;
}

export type GameMessagePayloadMap = {
  [GameMessageType.WALLET_CREATED]: WalletCreatedPayload;
  [GameMessageType.GAME_PLAY_RESULT]: GamePlayResultPayload;
  [GameMessageType.GAME_LOGOUT]: undefined;
  [GameMessageType.WALLET_CONFIRMED]: WalletConfirmedPayload;
  [GameMessageType.REWARD_SENT]: RewardSentPayload;
  [GameMessageType.HOUSE_CHANGED]: HouseChangedPayload;
};

export interface GameEvent<T extends GameMessageType> {
  type: T;
  value?: string | GameMessagePayloadMap[T] | unknown;
}

class EventBridge {
  private isIframe(): boolean {
    return typeof window !== 'undefined' && window.parent !== window;
  }

  /**
   * Send a message to the parent frame
   */
  send<T extends GameMessageType>(type: T, payload?: GameMessagePayloadMap[T]) {
    if (!this.isIframe()) return;

    const message: GameEvent<T> = {
      type,
      value: payload ? JSON.stringify(payload) : undefined,
    };

    window.parent.postMessage(message, '*');
    console.log(`[EventBridge] Sent ${type}:`, payload);
  }

  /**
   * Send a message to a specific iframe (Dashboard -> Game)
   */
  sendToIframe<T extends GameMessageType>(iframe: HTMLIFrameElement | null, type: T, payload?: GameMessagePayloadMap[T]) {
    if (!iframe || !iframe.contentWindow) return;

    const message: GameEvent<T> = {
      type,
      value: payload ? JSON.stringify(payload) : undefined,
    };

    iframe.contentWindow.postMessage(message, '*');
    console.log(`[EventBridge] Sent to Iframe ${type}:`, payload);
  }

  /**
   * Listen for messages
   */
  listen(callback: (event: GameEvent<GameMessageType>) => void) {
    if (typeof window === 'undefined') return () => {};

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as GameEvent<GameMessageType>;
      if (!data || !data.type) return;

      // Handle both stringified and object values
      let parsedValue = data.value;
      if (typeof data.value === 'string') {
        try {
          parsedValue = JSON.parse(data.value);
        } catch {
          // Not JSON, keep as string
        }
      }

      callback({
        type: data.type,
        value: parsedValue as any, // Cast back to any for dynamic payload matching
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }
}

export const eventBridge = new EventBridge();
