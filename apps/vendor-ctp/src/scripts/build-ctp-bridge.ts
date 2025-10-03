import fs from 'fs';
import path from 'path';
import {
  filter,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  OperatorFunction,
  pairwise,
  reduce,
  toArray,
  withLatestFrom,
} from 'rxjs';
import { IDataTypeMeta, IStructMeta, makeDataTypeMeta, makeStructMeta } from './ctp-meta';

const apiInterfaceName = 'NTNL-CTP-Bridge-Interface.GENERATED.hpp';
const apiImplementationName = 'NTNL-CTP-Bridge-Implementation.GENERATED.cpp';
const mdApiInterfaceName = 'NTNL-CTP-Md-Bridge-Interface.GENERATED.hpp';
const mdApiImplementationName = 'NTNL-CTP-Md-Bridge-Implementation.GENERATED.cpp';

const apiInterfacePath = path.join(__dirname, '../../ctp/include', apiInterfaceName);
const apiImplementationPath = path.join(__dirname, '../../ctp/src', apiImplementationName);
const mdApiInterfacePath = path.join(__dirname, '../../ctp/include', mdApiInterfaceName);
const mdApiImplementationPath = path.join(__dirname, '../../ctp/src', mdApiImplementationName);

interface ISpiMeta {
  name: string;
  comment: string;
  fieldType: string;
  fieldName: string;
  withErrorInfo: boolean;
  withTraceInfo: boolean;
}

interface IApiMeta {
  name: string;
  comment: string;
  fieldType: string;
  fieldName: string;
}

interface IMdCharArrayApiMeta {
  name: string;
  comment: string;
  paramName: string;
  countName: string;
}

const makeCTPTraderSpiMeta: OperatorFunction<string, ISpiMeta> = (line$: Observable<string>) =>
  line$.pipe(
    //
    pairwise(),
    map(([prev, next]): ISpiMeta | undefined => {
      const matched = next.match(
        /\svirtual void (On\w+)\((\w+)\s\*(\w+)(,\sCThostFtdcRspInfoField\s\*pRspInfo(,\sint\snRequestID,\sbool\sbIsLast)?)?\)/,
      );
      if (matched) {
        return {
          name: matched[1],
          comment: prev.slice(4),
          fieldType: matched[2],
          fieldName: matched[3],
          withErrorInfo: !!matched[4],
          withTraceInfo: !!matched[5],
        };
      }
    }),
    filter((v): v is Exclude<typeof v, undefined> => !!v),
  );

const makeCTPTraderSpiInterfaceLiteral: OperatorFunction<ISpiMeta, string> = (
  traderSpiMeta$: Observable<ISpiMeta>,
) =>
  traderSpiMeta$.pipe(
    //
    map(
      (meta) =>
        `  void ${meta.name}(${meta.fieldType} *${meta.fieldName}${
          meta.withErrorInfo
            ? //
              ', CThostFtdcRspInfoField *pRspInfo'
            : ''
        }${
          meta.withTraceInfo
            ? //
              ', int nRequestID, bool bIsLast'
            : ''
        }) override;`,
    ),
  );

const makeCTPTraderSpiImplementationLiteral =
  (className: string): OperatorFunction<ISpiMeta, string> =>
  (traderSpiMeta$: Observable<ISpiMeta>) =>
    traderSpiMeta$.pipe(
      //
      filter((meta) => !['OnRspAuthenticate', 'OnRspUserLogin'].includes(meta.name)),
      map((meta) =>
        [
          `/* ${meta.comment} */`,
          `void ${className}::${meta.name}(${meta.fieldType} *${meta.fieldName}${
            meta.withErrorInfo
              ? //
                ', CThostFtdcRspInfoField *pRspInfo'
              : ''
          }${
            meta.withTraceInfo
              ? //
                ', int nRequestID, bool bIsLast'
              : ''
          }) {`,
          // meta.withErrorInfo ? `  g2uForCThostFtdcRspInfoField(pRspInfo);` : ``,
          `  Message msg = {.event = "${meta.name}",`,
          `                 .error_code = ${
            meta.withErrorInfo ? 'pRspInfo != nullptr ? pRspInfo->ErrorID : 0' : 0
          },`,
          `                 .error_message = ${
            meta.withErrorInfo
              ? 'pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): ""'
              : '""'
          },`,
          `                 .is_last = ${meta.withTraceInfo ? 'bIsLast' : 'true'}};`,
          `  json j;`,
          `  j["request_id"] = ${meta.withTraceInfo ? 'nRequestID' : 0};`,
          `  j["res"] = msg;`,
          `  if (${meta.fieldName} != nullptr) {`,
          // `    g2uFor${meta.fieldType}(${meta.fieldName});`,
          `    j["res"]["value"] = *${meta.fieldName};`,
          `  }`,
          `  try {`,
          `    std::string string_msg = j.dump();`,
          `    spdlog::info("ZMQ PUSH: {}", string_msg);`,
          `    push_sock_.send(zmq::buffer(string_msg));`,
          `    spdlog::info("SentZMQ");`,
          `  } catch (json::exception &e) {`,
          `    spdlog::error("error: {}", e.what());`,
          `    throw;`,
          `  }`,
          `}`,
          ``,
          ``,
        ].join('\n'),
      ),
    );

const makeCTPMdSpiMeta: OperatorFunction<string, ISpiMeta> = (line$: Observable<string>) =>
  line$.pipe(
    pairwise(),
    map(([prev, next]): ISpiMeta | undefined => {
      const matched = next.match(
        /\svirtual void (On\w+)\((\w+)\s\*(\w+)(,\sCThostFtdcRspInfoField\s\*pRspInfo(,\sint\snRequestID,\sbool\sbIsLast)?)?\)/,
      );
      if (matched) {
        return {
          name: matched[1],
          comment: prev.slice(4),
          fieldType: matched[2],
          fieldName: matched[3],
          withErrorInfo: !!matched[4],
          withTraceInfo: !!matched[5],
        };
      }
    }),
    filter((v): v is Exclude<typeof v, undefined> => !!v),
  );

const makeCTPMdSpiInterfaceLiteral: OperatorFunction<ISpiMeta, string> = (mdSpiMeta$: Observable<ISpiMeta>) =>
  mdSpiMeta$.pipe(
    map(
      (meta) =>
        `  void ${meta.name}(${meta.fieldType} *${meta.fieldName}${
          meta.withErrorInfo ? ', CThostFtdcRspInfoField *pRspInfo' : ''
        }${meta.withTraceInfo ? ', int nRequestID, bool bIsLast' : ''}) override;`,
    ),
  );

const makeCTPMdSpiImplementationLiteral =
  (className: string): OperatorFunction<ISpiMeta, string> =>
  (mdSpiMeta$: Observable<ISpiMeta>) =>
    mdSpiMeta$.pipe(
      map((meta) =>
        (() => {
          const lines = [
            `/* ${meta.comment} */`,
            `void ${className}::${meta.name}(${meta.fieldType} *${meta.fieldName}${
              meta.withErrorInfo ? ', CThostFtdcRspInfoField *pRspInfo' : ''
            }${meta.withTraceInfo ? ', int nRequestID, bool bIsLast' : ''}) {`,
          ];
          if (meta.name === 'OnFrontConnected') {
            lines.push(
              `  spdlog::info("MdBridge FrontConnected, login proceeding...");`,
              `  char *broker_id = getenv("BROKER_ID");`,
              `  char *user_id = getenv("USER_ID");`,
              `  char *password = getenv("PASSWORD");`,
              `  if (broker_id == nullptr || user_id == nullptr || password == nullptr) {`,
              `    spdlog::error("Environment variables BROKER_ID/USER_ID/PASSWORD must be set before Md login");`,
              `  } else {`,
              `    CThostFtdcReqUserLoginField req;`,
              `    memset(&req, 0, sizeof(CThostFtdcReqUserLoginField));`,
              `    strncpy(req.BrokerID, broker_id, sizeof(req.BrokerID));`,
              `    strncpy(req.UserID, user_id, sizeof(req.UserID));`,
              `    strncpy(req.Password, password, sizeof(req.Password));`,
              `    auto ret = md_api_->ReqUserLogin(&req, 0);`,
              `    if (ret != 0) {`,
              `      spdlog::error("Md ReqUserLogin failed, code {}", ret);`,
              `    }`,
              `  }`,
            );
          }
          lines.push(
            `  Message msg = {.event = "Md_${meta.name}",`,
            `                 .error_code = ${
              meta.withErrorInfo ? 'pRspInfo != nullptr ? pRspInfo->ErrorID : 0' : 0
            },`,
            `                 .error_message = ${
              meta.withErrorInfo
                ? 'pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): ""'
                : '""'
            },`,
            `                 .is_last = ${meta.withTraceInfo ? 'bIsLast' : 'true'}};`,
            `  json j;`,
            `  j["request_id"] = ${meta.withTraceInfo ? 'nRequestID' : 0};`,
            `  j["res"] = msg;`,
            `  if (${meta.fieldName} != nullptr) {`,
            `    j["res"]["value"] = *${meta.fieldName};`,
            `  }`,
            `  try {`,
            `    std::string string_msg = j.dump();`,
            `    spdlog::info("ZMQ PUSH: {}", string_msg);`,
            `    md_push_sock_.send(zmq::buffer(string_msg));`,
            `    spdlog::info("SentZMQ");`,
            `  } catch (json::exception &e) {`,
            `    spdlog::error("error: {}", e.what());`,
            `    throw;`,
            `  }`,
            `}`,
            ``,
            ``,
          );
          return lines.join('\n');
        })(),
      ),
    );

const makeCTPTraderApiMeta: OperatorFunction<string, IApiMeta> = (line$: Observable<string>) =>
  line$.pipe(
    //
    pairwise(),
    map(([prev, next]): IApiMeta | undefined => {
      const matched = next.match(/\svirtual int (Req\w+)\((\w+)\s\*(\w+),\sint\snRequestID\)/);
      if (matched) {
        return {
          name: matched[1],
          comment: prev.slice(4),
          fieldType: matched[2],
          fieldName: matched[3],
        };
      }
    }),
    filter((v): v is Exclude<typeof v, undefined> => !!v),
  );

const makeCTPMdApiMeta: OperatorFunction<string, IApiMeta> = (line$: Observable<string>) =>
  line$.pipe(
    pairwise(),
    map(([prev, next]): IApiMeta | undefined => {
      const matched = next.match(/\svirtual int (Req\w+)\((\w+)\s\*(\w+),\sint\snRequestID\)/);
      if (matched) {
        return {
          name: matched[1],
          comment: prev.slice(4),
          fieldType: matched[2],
          fieldName: matched[3],
        };
      }
    }),
    filter((v): v is Exclude<typeof v, undefined> => !!v),
  );

const makeCTPMdCharArrayApiMeta: OperatorFunction<string, IMdCharArrayApiMeta> = (
  line$: Observable<string>,
) =>
  line$.pipe(
    pairwise(),
    map(([prev, next]): IMdCharArrayApiMeta | undefined => {
      const matched = next.match(
        /\svirtual int (Subscribe\w+|UnSubscribe\w+)\(char \*(\w+)\[\],\sint\s(\w+)\)/,
      );
      if (matched) {
        return {
          name: matched[1],
          comment: prev.slice(4),
          paramName: matched[2],
          countName: matched[3],
        };
      }
    }),
    filter((v): v is Exclude<typeof v, undefined> => !!v),
  );

const buildListenReqLiteral = (
  className: string,
  traderMetas: IApiMeta[],
  mdStructMetas: IApiMeta[],
  mdCharArrayMetas: IMdCharArrayApiMeta[],
) => {
  const traderCases = traderMetas.map((meta) =>
    [
      `      /* ${meta.comment} */`,
      `      if (method_name == "${meta.name}") {`,
      `        auto field = data["req"]["params"].get<${meta.fieldType}>();`,
      `        auto a = trader_api->${meta.name}(&field, data["request_id"].get<int>());`,
      `        if (a != 0) {`,
      `          spdlog::error("RTN CODE: {}", a);`,
      `          Message msg = {.event = "${meta.name}",`,
      `                         .error_code = a,`,
      `                         .error_message = "error",`,
      `                         .is_last = true};`,
      `          json j;`,
      `          j["request_id"] = data["request_id"];`,
      `          j["res"] = msg;`,
      `          try {`,
      `            std::string string_msg = j.dump();`,
      `            spdlog::info("ZMQ PUSH: {}", string_msg);`,
      `            push_sock->send(zmq::buffer(string_msg));`,
      `            spdlog::info("SentZMQ");`,
      `          } catch (json::exception &e) {`,
      `            spdlog::error("error: {}", e.what());`,
      `            throw;`,
      `          }`,
      `        } else {`,
      `          spdlog::info("RTN CODE: {}", a);`,
      `        }`,
      `        continue;`,
      `      }`,
      ``,
    ].join('\n'),
  );

  const mdStructCases = mdStructMetas.map((meta) =>
    [
      `      /* ${meta.comment} */`,
      `      if (method_name == "${meta.name}") {`,
      `        if (md_api == nullptr) {`,
      `          spdlog::error("MdApi not initialized when invoking ${meta.name}");`,
      `          continue;`,
      `        }`,
      `        auto field = data["req"]["params"].get<${meta.fieldType}>();`,
      `        auto a = md_api->${meta.name}(&field, data["request_id"].get<int>());`,
      `        if (a != 0) {`,
      `          spdlog::error("RTN CODE: {}", a);`,
      `          Message msg = {.event = "Md_${meta.name}",`,
      `                         .error_code = a,`,
      `                         .error_message = "error",`,
      `                         .is_last = true};`,
      `          json j;`,
      `          j["request_id"] = data["request_id"];`,
      `          j["res"] = msg;`,
      `          try {`,
      `            std::string string_msg = j.dump();`,
      `            spdlog::info("ZMQ PUSH: {}", string_msg);`,
      `            push_sock->send(zmq::buffer(string_msg));`,
      `            spdlog::info("SentZMQ");`,
      `          } catch (json::exception &e) {`,
      `            spdlog::error("error: {}", e.what());`,
      `            throw;`,
      `          }`,
      `        } else {`,
      `          spdlog::info("RTN CODE: {}", a);`,
      `        }`,
      `        continue;`,
      `      }`,
      ``,
    ].join('\n'),
  );

  const mdCharCases = mdCharArrayMetas.map((meta) =>
    [
      `      /* ${meta.comment} */`,
      `      if (method_name == "${meta.name}") {`,
      `        if (md_api == nullptr) {`,
      `          spdlog::error("MdApi not initialized when invoking ${meta.name}");`,
      `          continue;`,
      `        }`,
      `        auto instrument_ids = data["req"]["params"].at("instrument_ids").get<std::vector<std::string>>();`,
      `        std::vector<std::string> buffer;`,
      `        buffer.reserve(instrument_ids.size());`,
      `        for (auto &id : instrument_ids) {`,
      `          buffer.emplace_back(id);`,
      `        }`,
      `        std::vector<char *> ptrs;`,
      `        ptrs.reserve(buffer.size());`,
      `        for (auto &id : buffer) {`,
      `          ptrs.emplace_back(const_cast<char *>(id.c_str()));`,
      `        }`,
      `        auto count = static_cast<int>(ptrs.size());`,
      `        auto ptr = count > 0 ? ptrs.data() : nullptr;`,
      `        auto a = md_api->${meta.name}(ptr, count);`,
      `        if (a != 0) {`,
      `          spdlog::error("RTN CODE: {}", a);`,
      `          Message msg = {.event = "Md_${meta.name}",`,
      `                         .error_code = a,`,
      `                         .error_message = "error",`,
      `                         .is_last = false};`,
      `          json j;`,
      `          j["request_id"] = data["request_id"];`,
      `          j["res"] = msg;`,
      `          try {`,
      `            std::string string_msg = j.dump();`,
      `            spdlog::info("ZMQ PUSH: {}", string_msg);`,
      `            push_sock->send(zmq::buffer(string_msg));`,
      `            spdlog::info("SentZMQ");`,
      `          } catch (json::exception &e) {`,
      `            spdlog::error("error: {}", e.what());`,
      `            throw;`,
      `          }`,
      `        } else {`,
      `          spdlog::info("RTN CODE: {}", a);`,
      `        }`,
      `        continue;`,
      `      }`,
      ``,
    ].join('\n'),
  );

  const switchCases = [...traderCases, ...mdStructCases, ...mdCharCases].join('\n');

  return [
    `void ${className}::ListenReq(CThostFtdcTraderApi *trader_api, zmq::socket_t *push_sock, zmq::socket_t *pull_sock, CThostFtdcMdApi *md_api) {`,
    `  while (true) {`,
    `    zmq::message_t msg;`,
    `    spdlog::info("ReceivingZMQ");`,
    `    auto res = pull_sock->recv(msg, zmq::recv_flags::none);`,
    `    spdlog::info("ReceivedZMQ");`,
    `    std::string string_msg = msg.to_string();`,
    `    spdlog::info("ZMQ PULL: {}", string_msg);`,
    `    json data_array = json::parse(string_msg);`,
    `    for (json::iterator it = data_array.begin(); it != data_array.end(); ++it) {`,
    `      json data = *it;`,
    `      std::string method_name = data["req"]["method"].get<std::string>();`,
    switchCases,
    `      Message resp = {.event="UNKNOWN",`,
    `                      .error_code=0,`,
    `                      .error_message="",`,
    `                      .is_last=true};`,
    `      json j;`,
    `      j["request_id"] = data["request_id"];`,
    `      j["res"] = resp;`,
    `      std::string string_resp = j.dump();`,
    `      spdlog::info("ZMQ PUSH: {}", string_resp);`,
    `      push_sock->send(zmq::buffer(string_resp));`,
    `      spdlog::info("SentZMQ");`,
    `    }`,
    `  }`,
    `}`,
  ].join('\n');
};

const joinBlocks = (blocks: string[]) => blocks.filter((block) => block.trim().length > 0).join('\n');

const buildBridgeHeader = (traderMethodDecls: string[], serializerDecls: string[]) => {
  return [
    `// THIS FILE IS AUTO GENERATED`,
    `// DO NOT MODIFY MANUALLY`,
    ``,
    `#pragma once`,
    `#include <string>`,
    `#include <future>`,
    `#include <stdexcept>`,
    `#include <iconv.h>`,
    `#include "zmq.hpp"`,
    `#include "json.hpp"`,
    `#include "spdlog/spdlog.h"`,
    `#include "ThostFtdcTraderApi.h"`,
    `#include "ThostFtdcMdApi.h"`,
    `#include "ThostFtdcUserApiStruct.h"`,
    `#include "ThostFtdcUserApiDataType.h"`,
    ``,
    `struct Message {`,
    `  std::string event;`,
    `  int error_code;`,
    `  std::string error_message;`,
    `  bool is_last;`,
    `};`,
    ``,
    `class IConv {`,
    `  iconv_t ic_;`,
    `public:`,
    `  IConv(const char *to, const char *from)`,
    `    : ic_(iconv_open(to, from)) {`,
    `    if (iconv_t(-1) == ic_) {`,
    `      throw std::runtime_error("error from iconv_open()");`,
    `    }`,
    `  }`,
    ``,
    `  ~IConv() { if (iconv_t(-1) != ic_) iconv_close(ic_); }`,
    `  bool convert(char *input, char* output, size_t &out_size) {`,
    `    size_t inbufsize = strlen(input)+1;`,
    `    return size_t(-1) != iconv(ic_, &input, &inbufsize, &output, &out_size);`,
    `  }`,
    `};`,
    ``,
    `std::string codec_convert(const char *to, const char *from, const char *input);`,
    ``,
    `using json = nlohmann::json;`,
    ``,
    `class Bridge : public CThostFtdcTraderSpi {`,
    `private:`,
    `  CThostFtdcTraderApi *trader_api_;`,
    `  zmq::socket_t push_sock_;`,
    `  zmq::socket_t pull_sock_;`,
    `  CThostFtdcMdApi *md_api_;`,
    `public:`,
    `  Bridge(zmq::context_t *ctx);`,
    `  void SetMdApi(CThostFtdcMdApi *md_api);`,
    `  void OnFrontConnected() override;`,
    `  void OnFrontDisconnected(int nReason) override;`,
    `  void OnHeartBeatWarning(int nTimeLapse) override;`,
    `  void OnRspError(CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;`,
    ...traderMethodDecls,
    `  static void ListenReq(CThostFtdcTraderApi *trader_api, zmq::socket_t *push_sock, zmq::socket_t *pull_sock, CThostFtdcMdApi *md_api);`,
    `  void Serve();`,
    `};`,
    ``,
    joinBlocks(serializerDecls),
    ``,
    `NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(Message, event, error_code, error_message, is_last);`,
  ].join('\n');
};

interface IBridgeImplementationPieces {
  serializerImpls: string[];
  traderSpiImpls: string[];
  listenReq: string;
}

const buildBridgeImplementation = ({
  serializerImpls,
  traderSpiImpls,
  listenReq,
}: IBridgeImplementationPieces) => {
  return [
    `// THIS FILE IS AUTO GENERATED`,
    `// DO NOT MODIFY MANUALLY`,
    ``,
    `#include <cstdio>`,
    `#include <cstdlib>`,
    `#include <cstring>`,
    `#include <string>`,
    `#include <vector>`,
    `#include "spdlog/spdlog.h"`,
    `#include "${apiInterfaceName}"`,
    ``,
    `std::string codec_convert(const char *to, const char *from, const char *input) {`,
    `  if (from == nullptr) return "";`,
    `  IConv ic(to, from);`,
    `  char out[255];`,
    `  size_t outsize = 255;`,
    `  bool ret = ic.convert((char *)input, out, outsize);`,
    `  if (ret == false) {`,
    `    spdlog::error("iconv failed for, original value: {}, converted value: {}", input, out);`,
    `    return "";`,
    `  } else {`,
    `    return std::string(out);`,
    `  }`,
    `}`,
    ``,
    joinBlocks(serializerImpls),
    `void Bridge::SetMdApi(CThostFtdcMdApi *md_api) {`,
    `  md_api_ = md_api;`,
    `}`,
    ``,
    joinBlocks(traderSpiImpls),
    `void Bridge::Serve() {`,
    `  if (md_api_ == nullptr) {`,
    `    spdlog::warn("MdApi has not been set before Serve; market data requests will not be handled");`,
    `  }`,
    `  auto serveThread = std::async(std::launch::async, ListenReq, trader_api_, &push_sock_, &pull_sock_, md_api_);`,
    `  serveThread.wait();`,
    `}`,
    ``,
    listenReq,
  ].join('\n');
};

const buildMdHeader = (mdMethodDecls: string[]) => {
  return [
    `// THIS FILE IS AUTO GENERATED`,
    `// DO NOT MODIFY MANUALLY`,
    ``,
    `#pragma once`,
    `#include "${apiInterfaceName}"`,
    `#include "ThostFtdcMdApi.h"`,
    ``,
    `class MdBridge : public CThostFtdcMdSpi {`,
    `private:`,
    `  CThostFtdcMdApi *md_api_;`,
    `  zmq::socket_t md_push_sock_;`,
    `public:`,
    `  MdBridge(zmq::context_t *ctx);`,
    `  CThostFtdcMdApi *md_api();`,
    `  void OnFrontConnected() override;`,
    `  void OnFrontDisconnected(int nReason) override;`,
    `  void OnHeartBeatWarning(int nTimeLapse) override;`,
    ...mdMethodDecls,
    `};`,
  ].join('\n');
};

const buildMdImplementation = (mdMethodImpls: string[]) => {
  return [
    `// THIS FILE IS AUTO GENERATED`,
    `// DO NOT MODIFY MANUALLY`,
    ``,
    `#include <cstdlib>`,
    `#include <cstring>`,
    `#include <stdexcept>`,
    `#include <string>`,
    `#include "spdlog/spdlog.h"`,
    `#include "${mdApiInterfaceName}"`,
    ``,
    `CThostFtdcMdApi *MdBridge::md_api() {`,
    `  return md_api_;`,
    `}`,
    ``,
    `void MdBridge::OnFrontConnected() {`,
    `  spdlog::info("MdBridge FrontConnected, login proceeding...");`,
    `  char *broker_id = getenv("BROKER_ID");`,
    `  char *user_id = getenv("USER_ID");`,
    `  char *password = getenv("PASSWORD");`,
    `  if (broker_id == nullptr || user_id == nullptr || password == nullptr) {`,
    `    spdlog::error("Environment variables BROKER_ID/USER_ID/PASSWORD must be set before Md login");`,
    `  } else {`,
    `    CThostFtdcReqUserLoginField req;`,
    `    memset(&req, 0, sizeof(CThostFtdcReqUserLoginField));`,
    `    strncpy(req.BrokerID, broker_id, sizeof(req.BrokerID));`,
    `    strncpy(req.UserID, user_id, sizeof(req.UserID));`,
    `    strncpy(req.Password, password, sizeof(req.Password));`,
    `    auto ret = md_api_->ReqUserLogin(&req, 0);`,
    `    if (ret != 0) {`,
    `      spdlog::error("Md ReqUserLogin failed, code {}", ret);`,
    `    }`,
    `  }`,
    `  Message msg = {.event = "Md_OnFrontConnected",`,
    `                 .error_code = 0,`,
    `                 .error_message = "",`,
    `                 .is_last = true};`,
    `  json j;`,
    `  j["request_id"] = 0;`,
    `  j["res"] = msg;`,
    `  try {`,
    `    std::string string_msg = j.dump();`,
    `    spdlog::info("ZMQ PUSH: {}", string_msg);`,
    `    md_push_sock_.send(zmq::buffer(string_msg));`,
    `    spdlog::info("SentZMQ");`,
    `  } catch (json::exception &e) {`,
    `    spdlog::error("error: {}", e.what());`,
    `    throw;`,
    `  }`,
    `}`,
    ``,
    `void MdBridge::OnFrontDisconnected(int nReason) {`,
    `  Message msg = {.event = "Md_OnFrontDisconnected",`,
    `                 .error_code = nReason,`,
    `                 .error_message = "",`,
    `                 .is_last = true};`,
    `  json j;`,
    `  j["request_id"] = 0;`,
    `  j["res"] = msg;`,
    `  try {`,
    `    std::string string_msg = j.dump();`,
    `    spdlog::info("ZMQ PUSH: {}", string_msg);`,
    `    md_push_sock_.send(zmq::buffer(string_msg));`,
    `    spdlog::info("SentZMQ");`,
    `  } catch (json::exception &e) {`,
    `    spdlog::error("error: {}", e.what());`,
    `    throw;`,
    `  }`,
    `}`,
    ``,
    `void MdBridge::OnHeartBeatWarning(int nTimeLapse) {`,
    `  Message msg = {.event = "Md_OnHeartBeatWarning",`,
    `                 .error_code = 0,`,
    `                 .error_message = std::to_string(nTimeLapse),`,
    `                 .is_last = true};`,
    `  json j;`,
    `  j["request_id"] = 0;`,
    `  j["res"] = msg;`,
    `  try {`,
    `    std::string string_msg = j.dump();`,
    `    spdlog::info("ZMQ PUSH: {}", string_msg);`,
    `    md_push_sock_.send(zmq::buffer(string_msg));`,
    `    spdlog::info("SentZMQ");`,
    `  } catch (json::exception &e) {`,
    `    spdlog::error("error: {}", e.what());`,
    `    throw;`,
    `  }`,
    `}`,
    ``,
    joinBlocks(mdMethodImpls),
  ].join('\n');
};

const makeCTPMessageJsonSerializerInterfaceLiteral = (structMeta$: Observable<IStructMeta>) =>
  structMeta$.pipe(
    //
    map((meta) =>
      [
        //
        `void to_json(json& j, const ${meta.name}& p);`,
        `void from_json(const json& j, ${meta.name}& p);`,
      ].join('\n'),
    ),
  );

const makeCTPMessageJsonSerializerImplementationLiteral =
  (dataTypeMeta$: Observable<IDataTypeMeta>): OperatorFunction<IStructMeta, string> =>
  (structMeta$) =>
    structMeta$.pipe(
      //
      withLatestFrom(
        dataTypeMeta$.pipe(
          //
          reduce(
            (acc: Record<string, IDataTypeMeta>, cur) => ({
              ...acc,
              [cur.name]: cur,
            }),
            {},
          ),
        ),
      ),
      map(([meta, mapTypeNameToDataTypeMeta]) =>
        [
          // 我们无法使用通过宏生成的 from_json & to_json, FYI: https://github.com/nlohmann/json/discussions/3591
          `void to_json(json& j, const ${meta.name}& p) {`,
          `  j = json{`,
          ...meta.fields.map((field) =>
            mapTypeNameToDataTypeMeta[field.type].length === 1 &&
            mapTypeNameToDataTypeMeta[field.type].type === 'string'
              ? [
                  //
                  `           {"${field.name}", std::string(1, p.${field.name})},`,
                ]
              : mapTypeNameToDataTypeMeta[field.type].type === 'string'
              ? [
                  //
                  `           {"${field.name}", codec_convert("UTF-8//TRANSLIT", "GBK", p.${field.name})},`,
                ]
              : [
                  //
                  `           {"${field.name}", p.${field.name}},`,
                ],
          ),
          `  };`,
          `}`,
          ``,
          `void from_json(const json& j, ${meta.name}& p) {`,
          ...meta.fields.map((field, index) =>
            mapTypeNameToDataTypeMeta[field.type].type === 'string'
              ? [
                  `  auto &v${index} = j.at("${field.name}").get_ref<const std::string &>();`,
                  mapTypeNameToDataTypeMeta[field.type].length === 1
                    ? `  p.${field.name} = v${index}.at(0);`
                    : `  std::strncpy(p.${field.name}, codec_convert("GBK//TRANSLIT", "UTF-8", v${index}.c_str()).c_str(), sizeof(p.${field.name}));`,
                ].join('\n')
              : [
                  //
                  `  j.at("${field.name}").get_to(p.${field.name});`,
                ].join('\n'),
          ),
          ``,
          `}`,
          ``,
          ``,
        ].join('\n'),
      ),
    );

const makeCTPInterfaceLiteral = (className: string) => (tradeSpiInterface$: Observable<string>) =>
  tradeSpiInterface$.pipe(
    //
    toArray(),
    map((content) =>
      [
        `// THIS FILE IS AUTO GENERATED`,
        `// DO NOT MODIFY MANUALLY`,
        ``,
        `#pragma once`,
        `#include <string>`,
        `#include <future>`,
        `#include <iconv.h>`,
        `#include "zmq.hpp"`,
        `#include "json.hpp"`,
        `#include "spdlog/spdlog.h"`,
        `#include "ThostFtdcTraderApi.h"`,
        `#include "ThostFtdcUserApiStruct.h"`,
        `#include "ThostFtdcUserApiDataType.h"`,
        ``,
        `struct Message {`,
        `  std::string event;`,
        `  int error_code;`,
        `  std::string error_message;`,
        `  bool is_last;`,
        `};`,
        ``,
        ``,
        `class IConv {`,
        `  iconv_t ic_;`,
        `public:`,
        `  IConv(const char *to, const char *from)`,
        `    : ic_(iconv_open(to, from)) {`,
        `    if (iconv_t(-1) == ic_) {`,
        `      throw std::runtime_error("error from iconv_open()");`,
        `    }`,
        `  }`,
        ``,
        `  ~IConv() { if (iconv_t(-1) != ic_) iconv_close(ic_); }`,
        `  bool convert(char *input, char* output, size_t &out_size) {`,
        `    size_t inbufsize = strlen(input)+1;`,
        `    return size_t(-1) != iconv(ic_, &input, &inbufsize, &output, &out_size);`,
        `  }`,
        `};`,
        ``,
        `std::string codec_convert(const char *to, const char *from, const char *input);`,
        ``,
        `using json = nlohmann::json;`,
        ``,
        `class ${className} : public CThostFtdcTraderSpi {`,
        `private:`,
        `  CThostFtdcTraderApi *trader_api_;`,
        `  zmq::socket_t push_sock_;`,
        `  zmq::socket_t pull_sock_;`,
        `public:`,
        `  ${className}(zmq::context_t *ctx);`,
        `  void OnFrontConnected() override;`,
        `  void OnFrontDisconnected(int nReason) override;`,
        `  void OnHeartBeatWarning(int nTimeLapse) override;`,
        `  void OnRspError(CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;`,
        ...content,
        `  static void ListenReq(CThostFtdcTraderApi *trader_api, zmq::socket_t *push_sock, zmq::socket_t *pull_sock);`,
        `  void Serve();`,
        `};`,
        ``,
        `NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(Message, event, error_code, error_message, is_last);`,
        ``,
        ``,
      ].join('\n'),
    ),
  );

const makeCTPEncodeConvertFunctionInterfaceLiteral = (structMeta$: Observable<IStructMeta>) =>
  structMeta$.pipe(
    //
    map((meta) =>
      [
        //
        `void g2uFor${meta.name}(${meta.name} *data);`,
        `void u2gFor${meta.name}(${meta.name} *data);`,
      ].join('\n'),
    ),
  );

const makeCTPEncodeConvertFunctionImplementationLiteral =
  (dataTypeMeta$: Observable<IDataTypeMeta>) => (structMeta$: Observable<IStructMeta>) =>
    structMeta$.pipe(
      //
      withLatestFrom(
        dataTypeMeta$.pipe(
          //
          reduce(
            (acc: Record<string, IDataTypeMeta>, cur) => ({
              ...acc,
              [cur.name]: cur,
            }),
            {},
          ),
        ),
      ),
      mergeMap(([meta, mapTypeNameToDataTypeMeta]) =>
        from(meta.fields).pipe(
          //
          filter((field) => mapTypeNameToDataTypeMeta[field.type].length > 1),
          map((field, index) =>
            [
              //
              `  char out${index}[${mapTypeNameToDataTypeMeta[field.type].length}];`,
              // `  size_t outsize${index} = ${mapTypeNameToDataTypeMeta[field.type].length};`,
              // `  size_t outsize${index} = sizeof(data->${field.name});`,
              `  size_t outsize${index} = 256;`,
              `  bool ret${index} = ic.convert(data->${field.name}, out${index}, outsize${index});`,
              `  if (ret${index} == false) {`,
              `    spdlog::error("iconv failed for type: ${field.type} in ${meta.name}, original value: {}, converted value: {}", data->${field.name}, out${index});`,
              `  } else {`,
              // `    spdlog::info("value for ${field.name}: {} -> {}", data->${field.name}, out${index});`,
              `    memcpy(data->${field.name}, out${index}, sizeof(data->${field.name}) - 1);`,
              // `    data->${field.name}[sizeof(data->${field.name}) - 1];`,
              `  }`,
              ``,
            ].join('\n'),
          ),
          toArray(),
          map((literals): [IStructMeta, string] => [meta, literals.join('\n')]),
        ),
      ),
      map(([meta, literals]) =>
        [
          `void g2uFor${meta.name}(${meta.name} *data) {`,
          `  if (data == nullptr) return;`,
          `  IConv ic("UTF-8//TRANSLIT", "GBK");`,
          literals,
          `}`,
          ``,
          `void u2gFor${meta.name}(${meta.name} *data) {`,
          `  if (data == nullptr) return;`,
          `  IConv ic("GBK//TRANSLIT", "UTF-8");`,
          literals,
          `}`,
          ``,
          ``,
        ].join('\n'),
      ),
    );

const sourceStructLines = fs
  .readFileSync(path.join(__dirname, '../../ctp/include/ThostFtdcUserApiStruct.h'))
  .toString()
  .split('\n');

const sourceTraderApiLines = fs
  .readFileSync(path.join(__dirname, '../../ctp/include/ThostFtdcTraderApi.h'))
  .toString()
  .split('\n');

const sourceMdApiLines = fs
  .readFileSync(path.join(__dirname, '../../ctp/include/ThostFtdcMdApi.h'))
  .toString()
  .split('\n');

const sourceDataTypeLines = fs
  .readFileSync(path.join(__dirname, '../../ctp/include/ThostFtdcUserApiDataType.h'))
  .toString()
  .split('\n');

const structLine$ = from(sourceStructLines);
const structMeta$ = structLine$.pipe(makeStructMeta);

const dataTypeLine$ = from(sourceDataTypeLines);
const dataTypeMeta$ = dataTypeLine$.pipe(makeDataTypeMeta);

const traderApiLine$ = from(sourceTraderApiLines);
const mdApiLine$ = from(sourceMdApiLines);

const traderSpiMeta$ = traderApiLine$.pipe(makeCTPTraderSpiMeta);
const mdSpiMeta$ = mdApiLine$.pipe(makeCTPMdSpiMeta);

const traderApiMeta$ = traderApiLine$.pipe(makeCTPTraderApiMeta);
const mdApiStructMeta$ = mdApiLine$.pipe(makeCTPMdApiMeta);
const mdCharArrayApiMeta$ = mdApiLine$.pipe(makeCTPMdCharArrayApiMeta);

forkJoin({
  traderMethods: traderSpiMeta$.pipe(makeCTPTraderSpiInterfaceLiteral, toArray()),
  serializerDecls: structMeta$.pipe(makeCTPMessageJsonSerializerInterfaceLiteral, toArray()),
}).subscribe(({ traderMethods, serializerDecls }) => {
  fs.writeFileSync(apiInterfacePath, buildBridgeHeader(traderMethods, serializerDecls));
});

forkJoin({
  serializerImpls: structMeta$.pipe(
    makeCTPMessageJsonSerializerImplementationLiteral(dataTypeMeta$),
    toArray(),
  ),
  traderSpiImpls: traderSpiMeta$.pipe(makeCTPTraderSpiImplementationLiteral('Bridge'), toArray()),
  listenReq: forkJoin({
    traderMetas: traderApiMeta$.pipe(toArray()),
    mdStructMetas: mdApiStructMeta$.pipe(toArray()),
    mdCharMetas: mdCharArrayApiMeta$.pipe(toArray()),
  }).pipe(
    map(({ traderMetas, mdStructMetas, mdCharMetas }) =>
      buildListenReqLiteral('Bridge', traderMetas, mdStructMetas, mdCharMetas),
    ),
  ),
}).subscribe(({ serializerImpls, traderSpiImpls, listenReq }) => {
  fs.writeFileSync(
    apiImplementationPath,
    buildBridgeImplementation({ serializerImpls, traderSpiImpls, listenReq }),
  );
});

forkJoin({
  mdMethods: mdSpiMeta$.pipe(makeCTPMdSpiInterfaceLiteral, toArray()),
}).subscribe(({ mdMethods }) => {
  fs.writeFileSync(mdApiInterfacePath, buildMdHeader(mdMethods));
});

forkJoin({
  mdImpls: mdSpiMeta$.pipe(makeCTPMdSpiImplementationLiteral('MdBridge'), toArray()),
}).subscribe(({ mdImpls }) => {
  fs.writeFileSync(mdApiImplementationPath, buildMdImplementation(mdImpls));
});
