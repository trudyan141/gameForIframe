# Event Bridge Documentation

The `EventBridge` service (`src/services/event-bridge.ts`) facilitates type-safe communication between the Game Iframe and the Parent Application using the `postMessage` API.

## 1. Usage Guide

### Sending Messages

**From Game (Child) -> Parent**

Use the `send` method. This safely checks if the code is running inside an iframe before sending.

```typescript
// Import the singleton instance and enum
import { eventBridge, GameMessageType } from '@/services/event-bridge';

// Send a payload (e.g., wallet created)
eventBridge.send(GameMessageType.WALLET_CREATED, {
  walletAddress: '0x123...'
});

// Send a signal without payload (e.g., logout)
eventBridge.send(GameMessageType.GAME_LOGOUT);
```

**From Parent -> Game (Child)**

Use the `sendToIframe` method. You must provide the `iframe` DOM element.

```typescript
// In your Vue/React component where you have reference to the Iframe element
const iframeElement = this.$refs.iframe; // or ref.current in React

eventBridge.sendToIframe(iframeElement, GameMessageType.HOUSE_CHANGED, {
  addressPaysReward: '0xabc...'
});
```

### Listening for Messages

Use the `listen` method. It returns a cleanup function that removes the event listener.

```typescript
import { useEffect } from 'react';
import { eventBridge, GameMessageType } from '@/services/event-bridge';

// Inside a React Component
useEffect(() => {
  // Subscribe to messages
  const unsubscribe = eventBridge.listen((event) => {
    switch (event.type) {
      case GameMessageType.WALLET_CONFIRMED:
        console.log('Wallet status:', event.value.status);
        break;
        
      case GameMessageType.REWARD_SENT:
        console.log('Reward info:', event.value.rewardAmount);
        break;
    }
  });

  // Cleanup on unmount
  return unsubscribe;
}, []);
```

---

## 2. Extending the Bridge

To add a new message type (e.g., `GAME_ERROR`), follow these steps in `src/services/event-bridge.ts`:

### Step 1: Add to Enum

Add the new message type to `GameMessageType`.

```typescript
export enum GameMessageType {
  // Existing...
  WALLET_CREATED = 'WALLET_CREATED',
  
  // NEW: Add your type here
  GAME_ERROR = 'GAME_ERROR', 
}
```

### Step 2: Define Payload Interface

Define what data acts as the payload for this message.

```typescript
export interface GameErrorPayload {
  code: number;
  message: string;
}
```

### Step 3: Map Enum to Payload

Add the mapping to `GameMessagePayloadMap`. This ensures TypeScript auto-completion works.

```typescript
export type GameMessagePayloadMap = {
  // Existing...
  [GameMessageType.WALLET_CREATED]: WalletCreatedPayload;
  
  // NEW: Map your enum to interface
  [GameMessageType.GAME_ERROR]: GameErrorPayload;
};
```

### Step 4: Usage

Now you can use it with full type support:

```typescript
// 1. Sending the event
// TypeScript knows specifically that 'value' must contain 'code' and 'message'
eventBridge.send(GameMessageType.GAME_ERROR, {
  code: 500,
  message: 'Internal Server Error'
});

// 2. Listening for the event
eventBridge.listen((event) => {
  if (event.type === GameMessageType.GAME_ERROR) {
    // TypeScript knows event.value is GameErrorPayload
    console.error(`Error ${event.value.code}: ${event.value.message}`);
  }
});
```
