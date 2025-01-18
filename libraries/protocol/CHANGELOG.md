# Change Log - @yuants/protocol

This log was last generated on Sat, 18 Jan 2025 11:58:42 GMT and should not be manually modified.

## 0.28.0
Sat, 18 Jan 2025 11:58:42 GMT

### Minor changes

- support service_id to allow multiple methods
- support new publishChannel and subscribeChannel methods
- support disable Terminate and Metrics options

### Patches

- use new channel in provideXXX helpers
- refactor

## 0.27.5
Tue, 14 Jan 2025 12:10:21 GMT

_Version update only_

## 0.27.4
Mon, 13 Jan 2025 17:14:27 GMT

_Version update only_

## 0.27.3
Mon, 13 Jan 2025 15:36:19 GMT

_Version update only_

## 0.27.2
Mon, 13 Jan 2025 14:31:04 GMT

_Version update only_

## 0.27.1
Wed, 08 Jan 2025 19:37:36 GMT

_Version update only_

## 0.27.0
Thu, 02 Jan 2025 07:08:15 GMT

### Minor changes

- simpify SINGLE-IN-SINGLE-OUT pattern

## 0.26.1
Thu, 19 Dec 2024 15:28:50 GMT

_Version update only_

## 0.26.0
Wed, 04 Dec 2024 09:36:47 GMT

### Minor changes

- allow disposing service and channel

## 0.25.0
Wed, 27 Nov 2024 15:48:19 GMT

### Minor changes

- support has_header

## 0.24.6
Sun, 24 Nov 2024 06:27:35 GMT

### Patches

- amend fix

## 0.24.5
Sun, 24 Nov 2024 05:13:22 GMT

### Patches

- clear positions metric if removed

## 0.24.4
Sat, 23 Nov 2024 15:55:38 GMT

### Patches

- fix: webrtc fix

## 0.24.3
Sat, 23 Nov 2024 05:37:50 GMT

### Patches

- remove default log

## 0.24.2
Sat, 16 Nov 2024 06:09:31 GMT

_Version update only_

## 0.24.1
Sat, 02 Nov 2024 10:25:33 GMT

### Patches

- fast timeout when syncing terminal info

## 0.24.0
Thu, 24 Oct 2024 19:57:43 GMT

### Minor changes

- add nodejs process stats

## 0.23.4
Wed, 25 Sep 2024 08:29:52 GMT

_Version update only_

## 0.23.3
Tue, 17 Sep 2024 20:07:02 GMT

### Patches

- WebRTC chunk

## 0.23.2
Tue, 17 Sep 2024 14:54:15 GMT

_Version update only_

## 0.23.1
Sun, 15 Sep 2024 14:00:45 GMT

### Patches

- fix(WebRTC): catch error in case peer destoryed

## 0.23.0
Sun, 15 Sep 2024 05:36:59 GMT

### Minor changes

- experimental webrtc support

## 0.22.1
Mon, 09 Sep 2024 14:05:59 GMT

_Version update only_

## 0.22.0
Sun, 08 Sep 2024 10:16:35 GMT

### Minor changes

- add HandShake service utils

## 0.21.4
Wed, 04 Sep 2024 12:44:10 GMT

_Version update only_

## 0.21.3
Fri, 30 Aug 2024 14:29:33 GMT

_Version update only_

## 0.21.2
Sun, 21 Jul 2024 07:51:05 GMT

_Version update only_

## 0.21.1
Sat, 13 Jul 2024 14:49:29 GMT

_Version update only_

## 0.21.0
Fri, 12 Jul 2024 09:19:54 GMT

### Minor changes

- addAccountTransferAddress

### Patches

- migrating data-model: interfaces, schema, module augmentation, wrappers

## 0.20.0
Fri, 12 Jul 2024 01:50:37 GMT

### Minor changes

- make Observable internal
- removed rx's Subject type

## 0.19.1
Wed, 03 Jul 2024 10:05:02 GMT

### Patches

- catch provideChannel handler error 

## 0.19.0
Sun, 30 Jun 2024 11:56:32 GMT

### Minor changes

- support multi currencies

## 0.18.2
Fri, 28 Jun 2024 12:37:38 GMT

### Patches

- add message for transfer apply data

## 0.18.1
Fri, 21 Jun 2024 16:20:19 GMT

### Patches

- fix Local Loop Back

## 0.18.0
Thu, 20 Jun 2024 09:43:34 GMT

### Minor changes

- add more utils, deprecate many terminal methods
- remove _conn, add input$, output$
- Local Loop Back Tunnel

## 0.17.0
Mon, 10 Jun 2024 08:50:50 GMT

### Minor changes

- DataStorageRequest adds include_expired and json schema filter

## 0.16.4
Fri, 07 Jun 2024 19:05:13 GMT

_Version update only_

## 0.16.3
Wed, 05 Jun 2024 09:35:22 GMT

### Patches

- ISSUE: pipe broken if UpdateTerminalInfo failed

## 0.16.2
Fri, 24 May 2024 18:00:17 GMT

### Patches

- update transfer service definition

## 0.16.1
Thu, 23 May 2024 13:52:31 GMT

### Patches

- add new transfer network models

## 0.16.0
Wed, 22 May 2024 04:53:53 GMT

### Minor changes

- Metric of position valuation

## 0.15.1
Thu, 16 May 2024 18:00:51 GMT

_Version update only_

## 0.15.0
Tue, 23 Apr 2024 16:29:03 GMT

### Minor changes

- Remove deprecated fields

### Patches

- fix terminalInfo report while reconnection

## 0.14.0
Thu, 11 Apr 2024 14:45:56 GMT

### Minor changes

- speed up terminalInfo updating

## 0.13.0
Mon, 08 Apr 2024 11:05:31 GMT

### Minor changes

- new Transfer interface

## 0.12.0
Fri, 22 Mar 2024 10:10:02 GMT

### Minor changes

- realtime TerminalInfo channel

## 0.11.1
Thu, 22 Feb 2024 18:28:20 GMT

_Version update only_

## 0.11.0
Sat, 17 Feb 2024 23:28:07 GMT

### Minor changes

- update data record wrapper function of Product

## 0.10.3
Sat, 10 Feb 2024 21:26:26 GMT

_Version update only_

## 0.10.2
Wed, 07 Feb 2024 08:31:35 GMT

_Version update only_

## 0.10.1
Fri, 29 Dec 2023 16:44:24 GMT

_Version update only_

## 0.10.0
Thu, 21 Dec 2023 11:26:42 GMT

### Minor changes

- merge model interfaces with data-model package

### Patches

- refactor some interface (useless)

## 0.9.4
Wed, 13 Dec 2023 12:12:11 GMT

### Patches

- chore: remove useless files as it has been moved out

## 0.9.3
Mon, 11 Dec 2023 13:08:40 GMT

### Patches

- fix provideChannel

## 0.9.2
Mon, 11 Dec 2023 11:13:42 GMT

### Patches

- Ajv Compiler Performance Issue
- Recognize account and datasource in new way

## 0.9.1
Sun, 10 Dec 2023 15:01:12 GMT

### Patches

- refactor(protocol): compile method validator only if it changed

## 0.9.0
Sat, 09 Dec 2023 20:53:56 GMT

### Minor changes

- metric channel_id messages

### Patches

- fix channel regexp escape issue

## 0.8.0
Sat, 09 Dec 2023 19:25:13 GMT

### Minor changes

- consumeChannel, requestService

## 0.7.3
Sat, 09 Dec 2023 16:37:39 GMT

_Version update only_

## 0.7.2
Sat, 09 Dec 2023 16:08:43 GMT

### Patches

- fix typo

## 0.7.1
Sat, 09 Dec 2023 15:43:11 GMT

_Version update only_

## 0.7.0
Sat, 09 Dec 2023 11:57:57 GMT

### Minor changes

- feat: use new provideChannel API; fix: Ajv strict warning log; fix: requestService routing; feat: terminalInfos$ use new API from host

## 0.6.0
Fri, 08 Dec 2023 17:01:42 GMT

### Minor changes

- terminal's services is undefined. mark services and discriminator as deprecated. add validator cache to speed up request
- migrate to provideService API, remove setupService API

## 0.5.1
Fri, 08 Dec 2023 14:47:10 GMT

### Patches

- apply the new optimized prom client

## 0.5.0
Thu, 07 Dec 2023 19:30:49 GMT

### Minor changes

- feat: provideService, requestService, provideChannel, consumeChannel API

## 0.4.0
Sun, 03 Dec 2023 04:38:50 GMT

### Minor changes

- new terminal info syncing & subscription

## 0.3.2
Fri, 24 Nov 2023 16:07:44 GMT

### Patches

- fix subscribe periods with multiple period_in_sec issue

## 0.3.1
Tue, 21 Nov 2023 12:39:54 GMT

### Patches

- fix request load balancer

## 0.3.0
Tue, 21 Nov 2023 10:59:13 GMT

### Minor changes

- add discriminator

## 0.2.2
Sat, 18 Nov 2023 18:35:47 GMT

### Patches

- fix provide period data type

## 0.2.1
Sat, 18 Nov 2023 17:16:51 GMT

### Patches

- QueryPeriods may returns out of range periods

## 0.2.0
Sat, 18 Nov 2023 15:49:27 GMT

### Minor changes

- dispose terminal

### Patches

- fix terminal disposing

## 0.1.7
Wed, 15 Nov 2023 16:04:13 GMT

### Patches

- polling terminal_info interval changed to reduce storage workload

## 0.1.6
Thu, 26 Oct 2023 18:03:30 GMT

_Version update only_

## 0.1.5
Thu, 19 Oct 2023 18:36:28 GMT

_Version update only_

## 0.1.4
Tue, 03 Oct 2023 17:45:31 GMT

### Patches

- use formatTime and UUID from data-model

## 0.1.3
Wed, 06 Sep 2023 15:33:08 GMT

_Version update only_

## 0.1.2
Tue, 05 Sep 2023 17:24:13 GMT

### Patches

- fix metrics

## 0.1.1
Tue, 05 Sep 2023 10:00:19 GMT

### Patches

- add copyDataRecords in terminal
- keepalive for queued request

## 0.1.0
Fri, 01 Sep 2023 14:25:44 GMT

### Minor changes

- add CopyDataRecords method

## 0.0.1
Tue, 29 Aug 2023 15:01:01 GMT

### Patches

- init

