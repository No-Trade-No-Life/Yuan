# Providing Account Information

When integrating with an exchange, the vendor needs to convert the account opened on the exchange into the standard [account information](../basics/what-is-account.md) of Yuan.

```ts
import { Terminal, provideAccountInfo } from '@yuants/protocol';
import { combineLatest, defer, map, shareReplay } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

// Assume the vendor's name is VENDOR_NAME and the user ID is USER_ID, AccountId must be globally unique
const ACCOUNT_ID = `${VENDOR_NAME}/${USER_ID}`;

// Create an Observable to provide account information
const accountInfo$ = combineLatest([
  defer(() => Api.getAccountWallet()), // Fetch account wallet balance
  defer(() => Api.getAccountPositions()), // Fetch account positions
  defer(() => Api.getAccountOrders()), // Fetch ongoing orders of the account
]).pipe(
  map(([wallet, positions, orders]) => {
    // Convert the vendor's account information into Yuan's standard account information
    return {
      updated_at: Date.now(),
      account_id: ACCOUNT_ID,
      // ...
    };
  }),
  shareReplay(1),
);

// Declare to the host through the terminal that you are providing account information
provideAccountInfo(terminal, accountInfo$);
```

After successfully integrating the vendor's account information, other terminals in the host can subscribe to this channel to obtain the account information in real time.

For example, in the GUI, you can open the **Account List**, find the corresponding account, click **Details**, and then open the account details page to view the vendor's account information in real time.

Other considerations:

1. A terminal can provide multiple account information. Throughout the host, the `account_id` must be globally unique. If multiple accounts declare the same `account_id`, the subscriber will consider them as multiple backup data sources of the same publisher and will choose one of them to subscribe to. For more details, refer to [Technical Protocol - Message Pattern Layer - Publish/Subscribe Pattern](../protocol/message-pattern-layer.md#publish-subscribe-pattern).
2. External systems usually do not directly provide interfaces that exactly match Yuan's standard account information. Instead, they typically provide account balance, positions, orders, etc., through RESTful interfaces. Vendors need to convert and integrate this information into Yuan's standard account information.
3. Automatic push of account information can be achieved by polling the RESTful interfaces of external systems or by connecting to push interfaces such as WebSocket. It is recommended to use push interfaces due to their higher efficiency.
4. The frequency of pushing account information is determined by the vendor. In principle, data should be pushed as frequently as possible without causing pressure on external systems. It should not be too sparse to avoid outdated account information in the Yuan system. For accounts involved in high-frequency trading, the push frequency should be higher.
