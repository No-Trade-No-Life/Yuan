// THIS FILE IS AUTO GENERATED

// DO NOT MODIFY MANUALLY



#include <cstdlib>

#include <cstring>

#include <stdexcept>

#include <string>

#include "spdlog/spdlog.h"

#include "NTNL-CTP-Md-Bridge-Interface.GENERATED.hpp"



MdBridge::MdBridge(zmq::context_t *ctx)

    : md_api_(CThostFtdcMdApi::CreateFtdcMdApi()), md_push_sock_(*ctx, zmq::socket_type::push) {

  if (ctx == nullptr) {

    throw std::runtime_error("ctx must not be null when constructing MdBridge");

  }

  char *market_addr = getenv("MARKET_ADDR");

  const char *pull_url = getenv("ZMQ_PULL_URL");

  std::string pull_endpoint = pull_url != nullptr ? pull_url : "tcp://127.0.0.1:5700";

  auto star_pos = pull_endpoint.find('*');

  if (star_pos != std::string::npos) {

    pull_endpoint.replace(star_pos, 1, "127.0.0.1");

  }

  md_push_sock_.connect(pull_endpoint);

  spdlog::info("Init, connecting market addr: {}", market_addr);

  md_api_->RegisterSpi(this);

  md_api_->RegisterFront(market_addr);

  md_api_->Init();

}



CThostFtdcMdApi *MdBridge::md_api() {

  return md_api_;

}



void MdBridge::OnFrontConnected() {

  spdlog::info("MdBridge FrontConnected, login proceeding...");

  char *broker_id = getenv("BROKER_ID");

  char *user_id = getenv("USER_ID");

  char *password = getenv("PASSWORD");

  if (broker_id == nullptr || user_id == nullptr || password == nullptr) {

    spdlog::error("Environment variables BROKER_ID/USER_ID/PASSWORD must be set before Md login");

  } else {

    CThostFtdcReqUserLoginField req;

    memset(&req, 0, sizeof(CThostFtdcReqUserLoginField));

    strncpy(req.BrokerID, broker_id, sizeof(req.BrokerID));

    strncpy(req.UserID, user_id, sizeof(req.UserID));

    strncpy(req.Password, password, sizeof(req.Password));

    auto ret = md_api_->ReqUserLogin(&req, 0);

    if (ret != 0) {

      spdlog::error("Md ReqUserLogin failed, code {}", ret);

    }

  }

  Message msg = {.event = "Md_OnFrontConnected",

                 .error_code = 0,

                 .error_message = "",

                 .is_last = true};

  json j;

  j["request_id"] = 0;

  j["res"] = msg;

  try {

    std::string string_msg = j.dump();

    spdlog::info("ZMQ PUSH: {}", string_msg);

    md_push_sock_.send(zmq::buffer(string_msg));

    spdlog::info("SentZMQ");

  } catch (json::exception &e) {

    spdlog::error("error: {}", e.what());

    throw;

  }

}



void MdBridge::OnFrontDisconnected(int nReason) {

  Message msg = {.event = "Md_OnFrontDisconnected",

                 .error_code = nReason,

                 .error_message = "",

                 .is_last = true};

  json j;

  j["request_id"] = 0;

  j["res"] = msg;

  try {

    std::string string_msg = j.dump();

    spdlog::info("ZMQ PUSH: {}", string_msg);

    md_push_sock_.send(zmq::buffer(string_msg));

    spdlog::info("SentZMQ");

  } catch (json::exception &e) {

    spdlog::error("error: {}", e.what());

    throw;

  }

}



void MdBridge::OnHeartBeatWarning(int nTimeLapse) {

  Message msg = {.event = "Md_OnHeartBeatWarning",

                 .error_code = 0,

                 .error_message = std::to_string(nTimeLapse),

                 .is_last = true};

  json j;

  j["request_id"] = 0;

  j["res"] = msg;

  try {

    std::string string_msg = j.dump();

    spdlog::info("ZMQ PUSH: {}", string_msg);

    md_push_sock_.send(zmq::buffer(string_msg));

    spdlog::info("SentZMQ");

  } catch (json::exception &e) {

    spdlog::error("error: {}", e.what());

    throw;

  }

}



/* 登录请求响应 */
void MdBridge::OnRspUserLogin(CThostFtdcRspUserLoginField *pRspUserLogin, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  Message msg = {.event = "Md_OnRspUserLogin",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = nRequestID;
  j["res"] = msg;
  if (pRspUserLogin != nullptr) {
    j["res"]["value"] = *pRspUserLogin;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 登出请求响应 */
void MdBridge::OnRspUserLogout(CThostFtdcUserLogoutField *pUserLogout, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  Message msg = {.event = "Md_OnRspUserLogout",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = nRequestID;
  j["res"] = msg;
  if (pUserLogout != nullptr) {
    j["res"]["value"] = *pUserLogout;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 请求查询组播合约响应 */
void MdBridge::OnRspQryMulticastInstrument(CThostFtdcMulticastInstrumentField *pMulticastInstrument, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  Message msg = {.event = "Md_OnRspQryMulticastInstrument",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = nRequestID;
  j["res"] = msg;
  if (pMulticastInstrument != nullptr) {
    j["res"]["value"] = *pMulticastInstrument;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 订阅行情应答 */
void MdBridge::OnRspSubMarketData(CThostFtdcSpecificInstrumentField *pSpecificInstrument, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  Message msg = {.event = "Md_OnRspSubMarketData",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = nRequestID;
  j["res"] = msg;
  if (pSpecificInstrument != nullptr) {
    j["res"]["value"] = *pSpecificInstrument;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 取消订阅行情应答 */
void MdBridge::OnRspUnSubMarketData(CThostFtdcSpecificInstrumentField *pSpecificInstrument, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  Message msg = {.event = "Md_OnRspUnSubMarketData",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = nRequestID;
  j["res"] = msg;
  if (pSpecificInstrument != nullptr) {
    j["res"]["value"] = *pSpecificInstrument;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 订阅询价应答 */
void MdBridge::OnRspSubForQuoteRsp(CThostFtdcSpecificInstrumentField *pSpecificInstrument, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  Message msg = {.event = "Md_OnRspSubForQuoteRsp",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = nRequestID;
  j["res"] = msg;
  if (pSpecificInstrument != nullptr) {
    j["res"]["value"] = *pSpecificInstrument;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 取消订阅询价应答 */
void MdBridge::OnRspUnSubForQuoteRsp(CThostFtdcSpecificInstrumentField *pSpecificInstrument, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  Message msg = {.event = "Md_OnRspUnSubForQuoteRsp",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg): "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = nRequestID;
  j["res"] = msg;
  if (pSpecificInstrument != nullptr) {
    j["res"]["value"] = *pSpecificInstrument;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 深度行情通知 */
void MdBridge::OnRtnDepthMarketData(CThostFtdcDepthMarketDataField *pDepthMarketData) {
  Message msg = {.event = "Md_OnRtnDepthMarketData",
                 .error_code = 0,
                 .error_message = "",
                 .is_last = true};
  json j;
  j["request_id"] = 0;
  j["res"] = msg;
  if (pDepthMarketData != nullptr) {
    j["res"]["value"] = *pDepthMarketData;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}



/* 询价通知 */
void MdBridge::OnRtnForQuoteRsp(CThostFtdcForQuoteRspField *pForQuoteRsp) {
  Message msg = {.event = "Md_OnRtnForQuoteRsp",
                 .error_code = 0,
                 .error_message = "",
                 .is_last = true};
  json j;
  j["request_id"] = 0;
  j["res"] = msg;
  if (pForQuoteRsp != nullptr) {
    j["res"]["value"] = *pForQuoteRsp;
  }
  try {
    std::string string_msg = j.dump();
    spdlog::info("ZMQ PUSH: {}", string_msg);
    md_push_sock_.send(zmq::buffer(string_msg));
    spdlog::info("SentZMQ");
  } catch (json::exception &e) {
    spdlog::error("error: {}", e.what());
    throw;
  }
}

