# Change Log - @yuants/protocol

This log was last generated on Thu, 21 Dec 2023 11:26:42 GMT and should not be manually modified.

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

