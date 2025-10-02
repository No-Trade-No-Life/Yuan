#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <vector>

#include "NTNL-CTP-Bridge-Interface.GENERATED.hpp"
#include "NTNL-CTP-Md-Bridge-Interface.GENERATED.hpp"
#include "spdlog/spdlog.h"

void ensure_envs(std::vector<std::string> env_names) {
  for (auto &env_name : env_names) {
    char *val = getenv(env_name.c_str());
    if (val == nullptr) {
      spdlog::error("Environment variable {} must exists!", env_name);
      exit(EXIT_FAILURE);
    }
  }
}

Bridge::Bridge(zmq::context_t *ctx)
    : trader_api_(CThostFtdcTraderApi::CreateFtdcTraderApi()) {
  char *trader_addr = getenv("TRADER_ADDR");
  push_sock_ = zmq::socket_t(*ctx, zmq::socket_type::push);
  push_sock_.connect("tcp://localhost:5700");
  pull_sock_ = zmq::socket_t(*ctx, zmq::socket_type::pull);
  pull_sock_.bind("tcp://*:5701");
  // TODO(wsy): timeout
  spdlog::info("Init, connecting trader addr: {}", trader_addr);
  trader_api_->RegisterSpi(this);
  trader_api_->SubscribePublicTopic(THOST_TERT_QUICK);
  trader_api_->SubscribePrivateTopic(THOST_TERT_QUICK);
  trader_api_->RegisterFront(trader_addr);
  trader_api_->Init();
}

MdBridge::MdBridge(zmq::context_t *ctx)
    : md_api_(CThostFtdcMdApi::CreateFtdcMdApi()), md_push_sock_(*ctx, zmq::socket_type::push) {
  if (ctx == nullptr) {
    throw std::runtime_error("ctx must not be null when constructing MdBridge");
  }
  char *market_addr = getenv("MARKET_ADDR");
  md_push_sock_.connect("tcp://localhost:5700");
  spdlog::info("Init, connecting market addr: {}", market_addr);
  md_api_->RegisterSpi(this);
  md_api_->RegisterFront(market_addr);
  md_api_->Init();
}

void Bridge::OnFrontConnected() {
  char *broker_id = getenv("BROKER_ID");
  char *user_id = getenv("USER_ID");
  char *app_id = getenv("APP_ID");
  char *auth_code = getenv("AUTH_CODE");
  CThostFtdcReqAuthenticateField auth;
  spdlog::info("FrontConnected, auth proceeding...");
  memset(&auth, 0, sizeof(CThostFtdcReqAuthenticateField));
  strncpy(auth.BrokerID, broker_id, sizeof(auth.BrokerID));
  strncpy(auth.UserID, user_id, sizeof(auth.UserID));
  strncpy(auth.AppID, app_id, sizeof(auth.AppID));
  strncpy(auth.AuthCode, auth_code, sizeof(auth.AuthCode));
  trader_api_->ReqAuthenticate(&auth, 0);
}

void Bridge::OnFrontDisconnected(int nReason) {
  Message msg = {.event = "OnFrontDisconnected",
                 .error_code = nReason,
                 .error_message = "",
                 .is_last = true};
  json j;
  j["request_id"] = 0;
  j["res"] = msg;
  std::string string_msg = j.dump();
  spdlog::info("ZMQ PUSH: {}", string_msg);
  push_sock_.send(zmq::buffer(string_msg));
  // // ISSUE: CTP 宣称会自动重连，实际也观测到这个现象，然而 node 端会在 OnFrontDisconnected 之后直接卡死，因此目前还是使 cpp 端自杀
  // exit(EXIT_FAILURE);
}

void Bridge::OnHeartBeatWarning(int nTimeLapse) {
  std::ostringstream stringStream;
  stringStream << "time elapse: " << nTimeLapse;
  Message msg = {.event = "OnFrontDisconnected",
                 .error_code = 0,
                 .error_message = stringStream.str(),
                 .is_last = true};
  json j;
  j["request_id"] = 0;
  j["res"] = msg;
  std::string string_msg = j.dump();
  spdlog::info("ZMQ PUSH: {}", string_msg);
  push_sock_.send(zmq::buffer(string_msg));
}

void Bridge::OnRspError(CThostFtdcRspInfoField *pRspInfo, int nRequestID,
                        bool bIsLast) {
  // g2uForCThostFtdcRspInfoField(pRspInfo);
  Message msg = {.event = "OnRspError",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg) : "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = 0;
  j["res"] = msg;
  std::string string_msg = j.dump();
  spdlog::info("ZMQ PUSH: {}", string_msg);
  push_sock_.send(zmq::buffer(string_msg));
}

void Bridge::OnRspAuthenticate(
    CThostFtdcRspAuthenticateField *pRspAuthenticateField,
    CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) {
  CThostFtdcReqUserLoginField user;
  char *broker_id = getenv("BROKER_ID");
  char *user_id = getenv("USER_ID");
  char *password = getenv("PASSWORD");
  spdlog::info("AuthSucceed, login proceeding...");
  memset(&user, 0, sizeof(CThostFtdcReqUserLoginField));
  strncpy(user.BrokerID, broker_id, sizeof(user.BrokerID));
  strncpy(user.UserID, user_id, sizeof(user.UserID));
  strncpy(user.Password, password, sizeof(user.Password));
  trader_api_->ReqUserLogin(&user, 0);
}

void Bridge::OnRspUserLogin(CThostFtdcRspUserLoginField *pRspUserLogin,
                            CThostFtdcRspInfoField *pRspInfo, int nRequestID,
                            bool bIsLast) {
  char *broker_id = getenv("BROKER_ID");
  char *user_id = getenv("USER_ID");
  CThostFtdcSettlementInfoConfirmField confirm;
  memset(&confirm, 0, sizeof(CThostFtdcSettlementInfoConfirmField));
  strncpy(confirm.BrokerID, broker_id, sizeof(confirm.BrokerID));
  strncpy(confirm.InvestorID, user_id, sizeof(confirm.InvestorID));
  trader_api_->ReqSettlementInfoConfirm(&confirm, 0);

  // g2uForCThostFtdcRspInfoField(pRspInfo);
  Message msg = {.event = "OnRspUserLogin",
                 .error_code = pRspInfo != nullptr ? pRspInfo->ErrorID : 0,
                 .error_message = pRspInfo != nullptr ? codec_convert("UTF-8//TRANSLIT", "GBK", pRspInfo->ErrorMsg) : "",
                 .is_last = bIsLast};
  json j;
  j["request_id"] = 0;
  j["res"] = msg;
  if (pRspUserLogin != nullptr) {
    // g2uForCThostFtdcRspUserLoginField(pRspUserLogin);
    j["res"]["value"] = *pRspUserLogin;
  }
  std::string string_msg = j.dump();
  spdlog::info("ZMQ PUSH: {}", string_msg);
  push_sock_.send(zmq::buffer(string_msg));
}

int main() {
  ensure_envs({
      "TRADER_ADDR", "MARKET_ADDR", "BROKER_ID", "USER_ID", "PASSWORD",
      "APP_ID", "AUTH_CODE",
      // "ZMQ_PUSH_URL",
      // "ZMQ_PULL_URL",
  });

  zmq::context_t ctx;

  Bridge bridge = {&ctx};
  MdBridge md_bridge = {&ctx};

  bridge.SetMdApi(md_bridge.md_api());

  bridge.Serve();

  return 0;
}
