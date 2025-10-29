---
slug: do-we-really-need-python-for-quant
title: Do we really need Python for Quant?
authors: [zccz14]
tags: [Yuan, Tech]
---

Nowadays, Python is the most popular programming language in quantitative trading. VNPY, Zipline, PyAlgoTrade, and Backtrader are all written in Python. Python is widely used in quantitative trading, but it may not be the best language for the job. While it has many advantages, such as being easy to learn and having a great ecosystem for data science, quantitative investment platforms like Quantopian, JoinQuant, and QuantConnect have struggled to be profitable, despite the decreasing costs of internet infrastructure. This is because the software depends on computing power, which remains expensive.

Local installed software can be cheaper, but it can be difficult for non-professional traders to install and use. Platforms often provide a web GUI for users to overcome this issue. Some argue that local installed software is not cross-platform, cannot utilize cloud computing power, and are not highly available.

The reason why users don't want to pay for cloud computing power is that they do not see the value in it. Quantitative trading requires a lot of research and development, which can be costly in terms of computing power and time. If users are not convinced that they can make money from the platform, they will not pay for it.

Therefore, we propose a solution: replace Python with JavaScript. JavaScript can be used in the browser, allowing users to utilize their own computing power and eliminating the need for a local installation. The JavaScript ecosystem is mature and growing, making it the best ecosystem for web development and data science. And JavaScript is faster than Python.

We have built a quantitative platform with JavaScript that can run in a browser and on cloud servers. The research and development can be done completely free in the browser until users want to run the model in cloud servers. This way, users can gain value from the platform before paying for it, and the platform can pay for the computing power after receiving payment, making it a win-win solution.

In the future, we will share how we store and distribute data without cost, ensuring that the platform will always be running. With these advantages, we are confident that JavaScript is the best choice for the future of quantitative trading.
