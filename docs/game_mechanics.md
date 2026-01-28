# Game Mechanics Documentation

This document explains how the game handles contract submissions (specifically ERC-4337 UserOperations) and how it communicates with the external parent application via an event bridge.

## 1. Contract Submission (ERC-4337)

The game uses the ERC-4337 standard (Account Abstraction) to perform blockchain transactions. This allows for features like session keys and gas sponsorship (paymaster).

### Overview

When a game result needs to be submitted (e.g., a win or loss), the game client performs the following steps:
1.  **Builds the Call Data**: Encodes the necessary token transfer instructions (bet amount to house + fee to paymaster).
2.  **Creates UserOperation**: Constructs the UserOp object required by ERC-4337.
3.  **Signs UserOperation**: Uses a temporary session key (generated when the user enters the game) to sign the operation.
4.  **Submits to Backend**: The signed UserOp is sent to the backend, which forwards it to a bundler/entry point.

### Implementation Details

**Location**: `src/app/page.tsx` - `submitResultToBE` function.

#### Code Illustration

```typescript
// src/app/page.tsx

const submitResultToBE = async (amount: number, isWin: boolean) => {
  // ... (setup provider, interfaces) ...

  // 1. Prepare Call Data
  // Encode transfer of bet amount to the House Address
  const tTransfer = tokenIface.encodeFunctionData('transfer', [
    payRewardAddress, 
    ethers.parseUnits(amount.toString(), 18)
  ])
  
  // Encode transfer of fee to the Paymaster
  const tPayFee = tokenIface.encodeFunctionData('transfer', [
    PAYMASTER_ADDRESS, 
    requiredTokenFee
  ])

  // Create Batch Execution Data (execute both transfers in one tx)
  const callData = delegationAccountIface.encodeFunctionData('executeBatch', [[
      { target: TOKEN_ADDRESS, value: 0, data: tTransfer },
      { target: TOKEN_ADDRESS, value: 0, data: tPayFee }
  ]])

  // 2. Build UserOperation
  const userOp = {
    sender: walletAddress,
    nonce: nonce.toString(),
    callData,
    // ... gas limits and paymaster data ...
  }

  // 3. Sign with Session Key (EIP-191)
  // The 'owner' here is the temporary session wallet created for the game
  const userOpHash = await entryPoint.getUserOpHash(userOp)
  const signature = await owner.signMessage(ethers.getBytes(userOpHash))
  
  const signedUserOp = { ...userOp, signature }

  // 4. Submit to Backend
  // The backend handles the final submission to the blockchain network
  const result = await defaultBackendService.submitUserOp({
    userOp: signedUserOp,
    entryPointAddress: ENTRY_POINT_ADDRESS,
  })
}
```

The `BackendService` (`src/services/backend.service.ts`) simply acts as a proxy to forward this signed object to the configured API endpoint:

```typescript
// src/services/backend.service.ts
async submitUserOp(params: { userOp: any; entryPointAddress: string }) {
  const response = await fetch(API_ENDPOINTS.submit, {
    method: 'POST',
    body: JSON.stringify(params),
    // ...
  });
  return response.json();
}
```

---

## 2. Event Bridge Communication

The game is designed to run within an `iframe`. It uses the `postMessage` API to communicate with the parent window (the main application). This "Bridge" handles authentication, wallet synchronization, and game results.

### Implementation Details

**Location**: `src/services/event-bridge.ts`

The `EventBridge` class encapsulates the logic for sending and listening to messages. It ensures messages are typed and structured correctly.

#### Key Mechanisms

1.  **Sending Messages (`Game -> Parent`)**:
    Uses `window.parent.postMessage` to send data out.
    
    ```typescript
    // src/services/event-bridge.ts
    send<T extends GameMessageType>(type: T, payload?: GameMessagePayloadMap[T]) {
      if (!this.isIframe()) return;

      const message: GameEvent<T> = {
        type,
        value: payload ? JSON.stringify(payload) : undefined,
      };

      window.parent.postMessage(message, '*');
    }
    ```

    **Example Usage**: When a session wallet is created, the game sends it to the parent for approval.
    ```typescript
    // src/app/page.tsx
    eventBridge.send(GameMessageType.WALLET_CREATED, { walletAddress })
    ```

2.  **Receiving Messages (`Parent -> Game`)**:
    Uses `window.addEventListener('message', ...)` to listen for incoming data.

    ```typescript
    // src/services/event-bridge.ts
    listen(callback: (event: GameEvent<GameMessageType>) => void) {
      const handleMessage = (event: MessageEvent) => {
        const data = event.data;
        // ... validation & parsing ...
        callback({ type: data.type, value: parsedValue });
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
    ```

    **Example Usage**: The game listens for wallet confirmation or balance updates.
    ```typescript
    // src/app/page.tsx
    useEffect(() => {
      return eventBridge.listen(async (event) => {
        if (event.type === GameMessageType.WALLET_CONFIRMED) {
          // Handle wallet confirmation, store addresses, verify balance
        }
      });
    }, []);
    ```

### Event Types

The communication is typed via `GameMessageType` enum:

| Event Type | Direction | Description |
| :--- | :--- | :--- |
| `WALLET_CREATED` | Game -> Parent | Sent when the game generates a temporary session key/wallet. |
| `GAME_PLAY_RESULT` | Game -> Parent | Sent after a game round (dice roll) is completed. |
| `GAME_LOGOUT` | Game -> Parent | Sent when the user logs out from the game. |
| `WALLET_CONFIRMED` | Parent -> Game | Response from parent confirming the session delegation. |
| `REWARD_SENT` | Parent -> Game | Notification that a reward payout tx was successful. |
| `HOUSE_CHANGED` | Parent -> Game | Updates the "House" address that receives/pays funds. |
