---
sidebar_position: 1
---

# Introduction

### Why use Yuan

**Powerful Web GUI**

With Yuan Web GUI, you have access to a comprehensive solution for creating, testing, and managing your trading system, as well as deploying and monitoring your applications. The GUI is completely open-source and can be deployed anywhere, without an internet connection. You can easily switch between multiple environments using just one GUI, making your experience more streamlined.

We have designed the GUI with modern browsers in mind, and it integrates with the latest web technologies, such as WebWorker, FileSystemHandle, WebRTC, and more. It is highly responsive and fast, and we are constantly working to make it even better for you.

Although the GUI is currently written in Chinese, we have plans to make it internationalized, so you can use it in your native language in the future. We welcome contributions to the project's translation, so everyone can benefit from this amazing tool. You can access the GUI for free under the MIT license, without the need to install anything - simply use the [GUI](https://y.ntnl.io).

**Simple language and AI assistant**

If you're interested in developing a trading strategy without the need to learn a new language or DSL, the modern JavaScript/TypeScript language is an excellent option. You can use any IDE to write your code and any version control system to manage it. If you have difficulty with coding, you can seek assistance from an AI assistant by communicating your idea to it.

```ts
// It's a simple trend-tracking trading strategy that uses the SMA indicator.
import { useSMA, useSimplePositionManager } from '@libs';
export default () => {
  const { close } = useOHLC('Y', 'XAUUSD', 'PT1H');
  const ma20 = useSMA(close, 20);
  const accountInfo = useAccountInfo();
  const [targetVolume, setTargetVolume] = useSimplePositionManager(accountInfo.account_id, 'XAUUSD');
  useEffect(() => {
    const idx = close.length - 2;
    if (close[idx] > ma20[idx]) {
      setTargetVolume(1);
    } else {
      setTargetVolume(0);
    }
  }, [close.length]);
};
```

More examples can be found [here](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace).

**Local, cloud...or hybrid!**

Yuan is a hybrid-cloud software that allows you to deploy your trading system in your home or public cloud simultaneously. You can start using your home PC and then gradually switch to the public cloud as your business grows. Choosing between your home PC or the public cloud will depend on your availability, costs, privacy, and security requirements.

**Extension-first Ecosystem**

In Yuan, extensions are treated as first-class citizens. Many core features are built and distributed as extensions. You can use extensions to add new features, connect with more markets, and enhance your experience. You can download extensions from the community or create your own extension to share with others.
