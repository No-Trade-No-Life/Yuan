import fs from 'fs';
import path from 'path';
import {
  concatWith,
  filter,
  from,
  map,
  mergeMap,
  Observable,
  of,
  OperatorFunction,
  pairwise,
  reduce,
  toArray,
  withLatestFrom,
} from 'rxjs';
import { IDataTypeMeta, IStructMeta, makeDataTypeMeta, makeFileContent, makeStructMeta } from './ctp-meta';

const apiInterfaceName = 'NTNL-CTP-Bridge-Interface.GENERATED.hpp';
const apiImplementationName = 'NTNL-CTP-Bridge-Implementation.GENERATED.cpp';

const apiInterfacePath = path.join(__dirname, '../../ctp/include', apiInterfaceName);
const apiImplementationPath = path.join(__dirname, '../../ctp/src', apiImplementationName);

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

const makeCTPTraderApiLiteral = (className: string) => (traderApiMeta$: Observable<IApiMeta>) =>
  traderApiMeta$.pipe(
    //
    map((meta) =>
      [
        //
        `      /* ${meta.comment} */`,
        `      if (method_name == "${meta.name}") {`,
        `        auto field = data["req"]["params"].get<${meta.fieldType}>();`,
        // `        u2gFor${meta.fieldType}(&field);`,
        `        auto a = trader_api->${meta.name}(&field, data["request_id"].get<int>());`,
        // TODO(wsy): push error to zmq if non-zero.
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
    ),
    toArray(),
    map((content) =>
      [
        `void ${className}::ListenReq(CThostFtdcTraderApi *trader_api, zmq::socket_t *push_sock, zmq::socket_t *pull_sock) {`,
        `  while (true) {`,
        `    zmq::message_t msg;`,
        `    spdlog::info("ReceivingZMQ");`,
        `    auto res = pull_sock->recv(msg, zmq::recv_flags::none);`,
        `    spdlog::info("ReceivedZMQ");`,
        // `    auto res = pull_sock->recv(msg, zmq::recv_flags::dontwait);`,
        // `    if (!res.has_value()) {`,
        // `      continue;`,
        // `    }`,
        `    std::string string_msg = msg.to_string();`,
        `    spdlog::info("ZMQ PULL: {}", string_msg);`,
        `    json data_array = json::parse(string_msg);`,
        `    for (json::iterator it = data_array.begin(); it != data_array.end(); ++it) {`,
        `      json data = *it;`,
        `      std::string method_name = data["req"]["method"].get<std::string>();`,
        ...content,
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
      ].join('\n'),
    ),
  );

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

const makeCTPServeImplementation = (className: string) =>
  of(0).pipe(
    //
    map(() =>
      [
        //
        `void ${className}::Serve() {`,
        `  auto serveThread = std::async(std::launch::async, ListenReq, trader_api_, &push_sock_, &pull_sock_);`,
        `  serveThread.wait();`,
        `}`,
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

const sourceDataTypeLines = fs
  .readFileSync(path.join(__dirname, '../../ctp/include/ThostFtdcUserApiDataType.h'))
  .toString()
  .split('\n');

const structLine$ = from(sourceStructLines);
const structMeta$ = structLine$.pipe(
  //
  makeStructMeta,
);

const dataTypeLine$ = from(sourceDataTypeLines);
const dataTypeMeta$ = dataTypeLine$.pipe(
  //
  makeDataTypeMeta,
);

const traderApiLine$ = from(sourceTraderApiLines);

const traderSpiMeta$ = traderApiLine$.pipe(
  //
  makeCTPTraderSpiMeta,
);

traderSpiMeta$
  .pipe(
    //
    makeCTPTraderSpiInterfaceLiteral,
    makeCTPInterfaceLiteral('Bridge'),
    // concatWith(
    //   structMeta$.pipe(
    //     //
    //     makeCTPEncodeConvertFunctionInterfaceLiteral
    //   )
    // ),
    concatWith(
      structMeta$.pipe(
        //
        makeCTPMessageJsonSerializerInterfaceLiteral,
      ),
    ),
    makeFileContent,
  )
  .subscribe((v) => {
    fs.writeFileSync(apiInterfacePath, v);
  });

of(0)
  .pipe(
    //
    map(() =>
      [
        `// THIS FILE IS AUTO GENERATED`,
        `// DO NOT MODIFY MANUALLY`,
        ``,
        // `#include <string>`,
        // `#include <zmq.hpp>`,
        // `#include <json.hpp>`,
        // `#include <future>`,
        // `#include "ThostFtdcTraderApi.h"`,
        // `#include "ThostFtdcUserApiStruct.h"`,
        // `#include "ThostFtdcUserApiDataType.h"`,
        `#include <cstdio>`,
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
        // `    spdlog::info("convert: {} -> {}", input, out);`,
        `    return std::string(out);`,
        `  }`,
        `}`,
        ``,
        ``,
      ].join('\n'),
    ),
    concatWith(
      structMeta$.pipe(
        //
        makeCTPMessageJsonSerializerImplementationLiteral(dataTypeMeta$),
      ),
    ),
    // concatWith(
    //   structMeta$.pipe(
    //     //
    //     makeCTPEncodeConvertFunctionImplementationLiteral(dataTypeMeta$)
    //   )
    // ),
    concatWith(
      traderSpiMeta$.pipe(
        //
        makeCTPTraderSpiImplementationLiteral('Bridge'),
      ),
    ),
    concatWith(makeCTPServeImplementation('Bridge')),
    concatWith(
      traderApiLine$.pipe(
        //
        makeCTPTraderApiMeta,
        makeCTPTraderApiLiteral('Bridge'),
      ),
    ),
    makeFileContent,
  )
  .subscribe((v) => {
    fs.writeFileSync(apiImplementationPath, v);
  });
