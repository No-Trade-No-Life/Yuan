// THIS FILE IS AUTO GENERATED
// DO NOT MODIFY MANUALLY

#pragma once
#include <string>
#include <future>
#include <stdexcept>
#include <iconv.h>
#include "zmq.hpp"
#include "json.hpp"
#include "spdlog/spdlog.h"
#include "ThostFtdcTraderApi.h"
#include "ThostFtdcMdApi.h"
#include "ThostFtdcUserApiStruct.h"
#include "ThostFtdcUserApiDataType.h"

struct Message {
  std::string event;
  int error_code;
  std::string error_message;
  bool is_last;
};

class IConv {
  iconv_t ic_;
public:
  IConv(const char *to, const char *from)
    : ic_(iconv_open(to, from)) {
    if (iconv_t(-1) == ic_) {
      throw std::runtime_error("error from iconv_open()");
    }
  }

  ~IConv() { if (iconv_t(-1) != ic_) iconv_close(ic_); }
  bool convert(char *input, char* output, size_t &out_size) {
    size_t inbufsize = strlen(input)+1;
    return size_t(-1) != iconv(ic_, &input, &inbufsize, &output, &out_size);
  }
};

std::string codec_convert(const char *to, const char *from, const char *input);

using json = nlohmann::json;

class Bridge : public CThostFtdcTraderSpi {
private:
  CThostFtdcTraderApi *trader_api_;
  zmq::socket_t push_sock_;
  zmq::socket_t pull_sock_;
  CThostFtdcMdApi *md_api_;
public:
  Bridge(zmq::context_t *ctx);
  void SetMdApi(CThostFtdcMdApi *md_api);
  void OnFrontConnected() override;
  void OnFrontDisconnected(int nReason) override;
  void OnHeartBeatWarning(int nTimeLapse) override;
  void OnRspError(CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspAuthenticate(CThostFtdcRspAuthenticateField *pRspAuthenticateField, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspUserLogin(CThostFtdcRspUserLoginField *pRspUserLogin, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspUserLogout(CThostFtdcUserLogoutField *pUserLogout, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspUserPasswordUpdate(CThostFtdcUserPasswordUpdateField *pUserPasswordUpdate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspTradingAccountPasswordUpdate(CThostFtdcTradingAccountPasswordUpdateField *pTradingAccountPasswordUpdate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspUserAuthMethod(CThostFtdcRspUserAuthMethodField *pRspUserAuthMethod, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspGenUserCaptcha(CThostFtdcRspGenUserCaptchaField *pRspGenUserCaptcha, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspGenUserText(CThostFtdcRspGenUserTextField *pRspGenUserText, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspOrderInsert(CThostFtdcInputOrderField *pInputOrder, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspParkedOrderInsert(CThostFtdcParkedOrderField *pParkedOrder, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspParkedOrderAction(CThostFtdcParkedOrderActionField *pParkedOrderAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspOrderAction(CThostFtdcInputOrderActionField *pInputOrderAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryMaxOrderVolume(CThostFtdcQryMaxOrderVolumeField *pQryMaxOrderVolume, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspSettlementInfoConfirm(CThostFtdcSettlementInfoConfirmField *pSettlementInfoConfirm, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspRemoveParkedOrder(CThostFtdcRemoveParkedOrderField *pRemoveParkedOrder, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspRemoveParkedOrderAction(CThostFtdcRemoveParkedOrderActionField *pRemoveParkedOrderAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspExecOrderInsert(CThostFtdcInputExecOrderField *pInputExecOrder, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspExecOrderAction(CThostFtdcInputExecOrderActionField *pInputExecOrderAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspForQuoteInsert(CThostFtdcInputForQuoteField *pInputForQuote, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQuoteInsert(CThostFtdcInputQuoteField *pInputQuote, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQuoteAction(CThostFtdcInputQuoteActionField *pInputQuoteAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspBatchOrderAction(CThostFtdcInputBatchOrderActionField *pInputBatchOrderAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspOptionSelfCloseInsert(CThostFtdcInputOptionSelfCloseField *pInputOptionSelfClose, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspOptionSelfCloseAction(CThostFtdcInputOptionSelfCloseActionField *pInputOptionSelfCloseAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspCombActionInsert(CThostFtdcInputCombActionField *pInputCombAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryOrder(CThostFtdcOrderField *pOrder, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryTrade(CThostFtdcTradeField *pTrade, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorPosition(CThostFtdcInvestorPositionField *pInvestorPosition, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryTradingAccount(CThostFtdcTradingAccountField *pTradingAccount, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestor(CThostFtdcInvestorField *pInvestor, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryTradingCode(CThostFtdcTradingCodeField *pTradingCode, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInstrumentMarginRate(CThostFtdcInstrumentMarginRateField *pInstrumentMarginRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInstrumentCommissionRate(CThostFtdcInstrumentCommissionRateField *pInstrumentCommissionRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryExchange(CThostFtdcExchangeField *pExchange, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryProduct(CThostFtdcProductField *pProduct, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInstrument(CThostFtdcInstrumentField *pInstrument, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryDepthMarketData(CThostFtdcDepthMarketDataField *pDepthMarketData, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryTraderOffer(CThostFtdcTraderOfferField *pTraderOffer, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySettlementInfo(CThostFtdcSettlementInfoField *pSettlementInfo, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryTransferBank(CThostFtdcTransferBankField *pTransferBank, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorPositionDetail(CThostFtdcInvestorPositionDetailField *pInvestorPositionDetail, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryNotice(CThostFtdcNoticeField *pNotice, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySettlementInfoConfirm(CThostFtdcSettlementInfoConfirmField *pSettlementInfoConfirm, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorPositionCombineDetail(CThostFtdcInvestorPositionCombineDetailField *pInvestorPositionCombineDetail, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryCFMMCTradingAccountKey(CThostFtdcCFMMCTradingAccountKeyField *pCFMMCTradingAccountKey, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryEWarrantOffset(CThostFtdcEWarrantOffsetField *pEWarrantOffset, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorProductGroupMargin(CThostFtdcInvestorProductGroupMarginField *pInvestorProductGroupMargin, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryExchangeMarginRate(CThostFtdcExchangeMarginRateField *pExchangeMarginRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryExchangeMarginRateAdjust(CThostFtdcExchangeMarginRateAdjustField *pExchangeMarginRateAdjust, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryExchangeRate(CThostFtdcExchangeRateField *pExchangeRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySecAgentACIDMap(CThostFtdcSecAgentACIDMapField *pSecAgentACIDMap, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryProductExchRate(CThostFtdcProductExchRateField *pProductExchRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryProductGroup(CThostFtdcProductGroupField *pProductGroup, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryMMInstrumentCommissionRate(CThostFtdcMMInstrumentCommissionRateField *pMMInstrumentCommissionRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryMMOptionInstrCommRate(CThostFtdcMMOptionInstrCommRateField *pMMOptionInstrCommRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInstrumentOrderCommRate(CThostFtdcInstrumentOrderCommRateField *pInstrumentOrderCommRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySecAgentTradingAccount(CThostFtdcTradingAccountField *pTradingAccount, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySecAgentCheckMode(CThostFtdcSecAgentCheckModeField *pSecAgentCheckMode, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySecAgentTradeInfo(CThostFtdcSecAgentTradeInfoField *pSecAgentTradeInfo, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryOptionInstrTradeCost(CThostFtdcOptionInstrTradeCostField *pOptionInstrTradeCost, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryOptionInstrCommRate(CThostFtdcOptionInstrCommRateField *pOptionInstrCommRate, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryExecOrder(CThostFtdcExecOrderField *pExecOrder, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryForQuote(CThostFtdcForQuoteField *pForQuote, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryQuote(CThostFtdcQuoteField *pQuote, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryOptionSelfClose(CThostFtdcOptionSelfCloseField *pOptionSelfClose, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestUnit(CThostFtdcInvestUnitField *pInvestUnit, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryCombInstrumentGuard(CThostFtdcCombInstrumentGuardField *pCombInstrumentGuard, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryCombAction(CThostFtdcCombActionField *pCombAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryTransferSerial(CThostFtdcTransferSerialField *pTransferSerial, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryAccountregister(CThostFtdcAccountregisterField *pAccountregister, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRtnOrder(CThostFtdcOrderField *pOrder) override;
  void OnRtnTrade(CThostFtdcTradeField *pTrade) override;
  void OnErrRtnOrderInsert(CThostFtdcInputOrderField *pInputOrder, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnOrderAction(CThostFtdcOrderActionField *pOrderAction, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRtnInstrumentStatus(CThostFtdcInstrumentStatusField *pInstrumentStatus) override;
  void OnRtnBulletin(CThostFtdcBulletinField *pBulletin) override;
  void OnRtnTradingNotice(CThostFtdcTradingNoticeInfoField *pTradingNoticeInfo) override;
  void OnRtnErrorConditionalOrder(CThostFtdcErrorConditionalOrderField *pErrorConditionalOrder) override;
  void OnRtnExecOrder(CThostFtdcExecOrderField *pExecOrder) override;
  void OnErrRtnExecOrderInsert(CThostFtdcInputExecOrderField *pInputExecOrder, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnExecOrderAction(CThostFtdcExecOrderActionField *pExecOrderAction, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnForQuoteInsert(CThostFtdcInputForQuoteField *pInputForQuote, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRtnQuote(CThostFtdcQuoteField *pQuote) override;
  void OnErrRtnQuoteInsert(CThostFtdcInputQuoteField *pInputQuote, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnQuoteAction(CThostFtdcQuoteActionField *pQuoteAction, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRtnForQuoteRsp(CThostFtdcForQuoteRspField *pForQuoteRsp) override;
  void OnRtnCFMMCTradingAccountToken(CThostFtdcCFMMCTradingAccountTokenField *pCFMMCTradingAccountToken) override;
  void OnErrRtnBatchOrderAction(CThostFtdcBatchOrderActionField *pBatchOrderAction, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRtnOptionSelfClose(CThostFtdcOptionSelfCloseField *pOptionSelfClose) override;
  void OnErrRtnOptionSelfCloseInsert(CThostFtdcInputOptionSelfCloseField *pInputOptionSelfClose, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnOptionSelfCloseAction(CThostFtdcOptionSelfCloseActionField *pOptionSelfCloseAction, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRtnCombAction(CThostFtdcCombActionField *pCombAction) override;
  void OnErrRtnCombActionInsert(CThostFtdcInputCombActionField *pInputCombAction, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRspQryContractBank(CThostFtdcContractBankField *pContractBank, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryParkedOrder(CThostFtdcParkedOrderField *pParkedOrder, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryParkedOrderAction(CThostFtdcParkedOrderActionField *pParkedOrderAction, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryTradingNotice(CThostFtdcTradingNoticeField *pTradingNotice, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryBrokerTradingParams(CThostFtdcBrokerTradingParamsField *pBrokerTradingParams, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryBrokerTradingAlgos(CThostFtdcBrokerTradingAlgosField *pBrokerTradingAlgos, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQueryCFMMCTradingAccountToken(CThostFtdcQueryCFMMCTradingAccountTokenField *pQueryCFMMCTradingAccountToken, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRtnFromBankToFutureByBank(CThostFtdcRspTransferField *pRspTransfer) override;
  void OnRtnFromFutureToBankByBank(CThostFtdcRspTransferField *pRspTransfer) override;
  void OnRtnRepealFromBankToFutureByBank(CThostFtdcRspRepealField *pRspRepeal) override;
  void OnRtnRepealFromFutureToBankByBank(CThostFtdcRspRepealField *pRspRepeal) override;
  void OnRtnFromBankToFutureByFuture(CThostFtdcRspTransferField *pRspTransfer) override;
  void OnRtnFromFutureToBankByFuture(CThostFtdcRspTransferField *pRspTransfer) override;
  void OnRtnRepealFromBankToFutureByFutureManual(CThostFtdcRspRepealField *pRspRepeal) override;
  void OnRtnRepealFromFutureToBankByFutureManual(CThostFtdcRspRepealField *pRspRepeal) override;
  void OnRtnQueryBankBalanceByFuture(CThostFtdcNotifyQueryAccountField *pNotifyQueryAccount) override;
  void OnErrRtnBankToFutureByFuture(CThostFtdcReqTransferField *pReqTransfer, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnFutureToBankByFuture(CThostFtdcReqTransferField *pReqTransfer, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnRepealBankToFutureByFutureManual(CThostFtdcReqRepealField *pReqRepeal, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnRepealFutureToBankByFutureManual(CThostFtdcReqRepealField *pReqRepeal, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnQueryBankBalanceByFuture(CThostFtdcReqQueryAccountField *pReqQueryAccount, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRtnRepealFromBankToFutureByFuture(CThostFtdcRspRepealField *pRspRepeal) override;
  void OnRtnRepealFromFutureToBankByFuture(CThostFtdcRspRepealField *pRspRepeal) override;
  void OnRspFromBankToFutureByFuture(CThostFtdcReqTransferField *pReqTransfer, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspFromFutureToBankByFuture(CThostFtdcReqTransferField *pReqTransfer, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQueryBankAccountMoneyByFuture(CThostFtdcReqQueryAccountField *pReqQueryAccount, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRtnOpenAccountByBank(CThostFtdcOpenAccountField *pOpenAccount) override;
  void OnRtnCancelAccountByBank(CThostFtdcCancelAccountField *pCancelAccount) override;
  void OnRtnChangeAccountByBank(CThostFtdcChangeAccountField *pChangeAccount) override;
  void OnRspQryClassifiedInstrument(CThostFtdcInstrumentField *pInstrument, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryCombPromotionParam(CThostFtdcCombPromotionParamField *pCombPromotionParam, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRiskSettleInvstPosition(CThostFtdcRiskSettleInvstPositionField *pRiskSettleInvstPosition, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRiskSettleProductStatus(CThostFtdcRiskSettleProductStatusField *pRiskSettleProductStatus, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPBMFutureParameter(CThostFtdcSPBMFutureParameterField *pSPBMFutureParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPBMOptionParameter(CThostFtdcSPBMOptionParameterField *pSPBMOptionParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPBMIntraParameter(CThostFtdcSPBMIntraParameterField *pSPBMIntraParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPBMInterParameter(CThostFtdcSPBMInterParameterField *pSPBMInterParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPBMPortfDefinition(CThostFtdcSPBMPortfDefinitionField *pSPBMPortfDefinition, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPBMInvestorPortfDef(CThostFtdcSPBMInvestorPortfDefField *pSPBMInvestorPortfDef, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorPortfMarginRatio(CThostFtdcInvestorPortfMarginRatioField *pInvestorPortfMarginRatio, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorProdSPBMDetail(CThostFtdcInvestorProdSPBMDetailField *pInvestorProdSPBMDetail, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorCommoditySPMMMargin(CThostFtdcInvestorCommoditySPMMMarginField *pInvestorCommoditySPMMMargin, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorCommodityGroupSPMMMargin(CThostFtdcInvestorCommodityGroupSPMMMarginField *pInvestorCommodityGroupSPMMMargin, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPMMInstParam(CThostFtdcSPMMInstParamField *pSPMMInstParam, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPMMProductParam(CThostFtdcSPMMProductParamField *pSPMMProductParam, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQrySPBMAddOnInterParameter(CThostFtdcSPBMAddOnInterParameterField *pSPBMAddOnInterParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRCAMSCombProductInfo(CThostFtdcRCAMSCombProductInfoField *pRCAMSCombProductInfo, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRCAMSInstrParameter(CThostFtdcRCAMSInstrParameterField *pRCAMSInstrParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRCAMSIntraParameter(CThostFtdcRCAMSIntraParameterField *pRCAMSIntraParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRCAMSInterParameter(CThostFtdcRCAMSInterParameterField *pRCAMSInterParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRCAMSShortOptAdjustParam(CThostFtdcRCAMSShortOptAdjustParamField *pRCAMSShortOptAdjustParam, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRCAMSInvestorCombPosition(CThostFtdcRCAMSInvestorCombPositionField *pRCAMSInvestorCombPosition, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorProdRCAMSMargin(CThostFtdcInvestorProdRCAMSMarginField *pInvestorProdRCAMSMargin, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRULEInstrParameter(CThostFtdcRULEInstrParameterField *pRULEInstrParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRULEIntraParameter(CThostFtdcRULEIntraParameterField *pRULEIntraParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryRULEInterParameter(CThostFtdcRULEInterParameterField *pRULEInterParameter, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorProdRULEMargin(CThostFtdcInvestorProdRULEMarginField *pInvestorProdRULEMargin, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorPortfSetting(CThostFtdcInvestorPortfSettingField *pInvestorPortfSetting, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryInvestorInfoCommRec(CThostFtdcInvestorInfoCommRecField *pInvestorInfoCommRec, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspQryCombLeg(CThostFtdcCombLegField *pCombLeg, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspOffsetSetting(CThostFtdcInputOffsetSettingField *pInputOffsetSetting, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRspCancelOffsetSetting(CThostFtdcInputOffsetSettingField *pInputOffsetSetting, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  void OnRtnOffsetSetting(CThostFtdcOffsetSettingField *pOffsetSetting) override;
  void OnErrRtnOffsetSetting(CThostFtdcInputOffsetSettingField *pInputOffsetSetting, CThostFtdcRspInfoField *pRspInfo) override;
  void OnErrRtnCancelOffsetSetting(CThostFtdcCancelOffsetSettingField *pCancelOffsetSetting, CThostFtdcRspInfoField *pRspInfo) override;
  void OnRspQryOffsetSetting(CThostFtdcOffsetSettingField *pOffsetSetting, CThostFtdcRspInfoField *pRspInfo, int nRequestID, bool bIsLast) override;
  static void ListenReq(CThostFtdcTraderApi *trader_api, zmq::socket_t *push_sock, zmq::socket_t *pull_sock, CThostFtdcMdApi *md_api);
  void Serve();
};

void to_json(json& j, const CThostFtdcDisseminationField& p);
void from_json(const json& j, CThostFtdcDisseminationField& p);

void to_json(json& j, const CThostFtdcReqUserLoginField& p);
void from_json(const json& j, CThostFtdcReqUserLoginField& p);

void to_json(json& j, const CThostFtdcRspUserLoginField& p);
void from_json(const json& j, CThostFtdcRspUserLoginField& p);

void to_json(json& j, const CThostFtdcUserLogoutField& p);
void from_json(const json& j, CThostFtdcUserLogoutField& p);

void to_json(json& j, const CThostFtdcForceUserLogoutField& p);
void from_json(const json& j, CThostFtdcForceUserLogoutField& p);

void to_json(json& j, const CThostFtdcReqAuthenticateField& p);
void from_json(const json& j, CThostFtdcReqAuthenticateField& p);

void to_json(json& j, const CThostFtdcRspAuthenticateField& p);
void from_json(const json& j, CThostFtdcRspAuthenticateField& p);

void to_json(json& j, const CThostFtdcAuthenticationInfoField& p);
void from_json(const json& j, CThostFtdcAuthenticationInfoField& p);

void to_json(json& j, const CThostFtdcRspUserLogin2Field& p);
void from_json(const json& j, CThostFtdcRspUserLogin2Field& p);

void to_json(json& j, const CThostFtdcTransferHeaderField& p);
void from_json(const json& j, CThostFtdcTransferHeaderField& p);

void to_json(json& j, const CThostFtdcTransferBankToFutureReqField& p);
void from_json(const json& j, CThostFtdcTransferBankToFutureReqField& p);

void to_json(json& j, const CThostFtdcTransferBankToFutureRspField& p);
void from_json(const json& j, CThostFtdcTransferBankToFutureRspField& p);

void to_json(json& j, const CThostFtdcTransferFutureToBankReqField& p);
void from_json(const json& j, CThostFtdcTransferFutureToBankReqField& p);

void to_json(json& j, const CThostFtdcTransferFutureToBankRspField& p);
void from_json(const json& j, CThostFtdcTransferFutureToBankRspField& p);

void to_json(json& j, const CThostFtdcTransferQryBankReqField& p);
void from_json(const json& j, CThostFtdcTransferQryBankReqField& p);

void to_json(json& j, const CThostFtdcTransferQryBankRspField& p);
void from_json(const json& j, CThostFtdcTransferQryBankRspField& p);

void to_json(json& j, const CThostFtdcTransferQryDetailReqField& p);
void from_json(const json& j, CThostFtdcTransferQryDetailReqField& p);

void to_json(json& j, const CThostFtdcTransferQryDetailRspField& p);
void from_json(const json& j, CThostFtdcTransferQryDetailRspField& p);

void to_json(json& j, const CThostFtdcRspInfoField& p);
void from_json(const json& j, CThostFtdcRspInfoField& p);

void to_json(json& j, const CThostFtdcExchangeField& p);
void from_json(const json& j, CThostFtdcExchangeField& p);

void to_json(json& j, const CThostFtdcProductField& p);
void from_json(const json& j, CThostFtdcProductField& p);

void to_json(json& j, const CThostFtdcInstrumentField& p);
void from_json(const json& j, CThostFtdcInstrumentField& p);

void to_json(json& j, const CThostFtdcBrokerField& p);
void from_json(const json& j, CThostFtdcBrokerField& p);

void to_json(json& j, const CThostFtdcTraderField& p);
void from_json(const json& j, CThostFtdcTraderField& p);

void to_json(json& j, const CThostFtdcInvestorField& p);
void from_json(const json& j, CThostFtdcInvestorField& p);

void to_json(json& j, const CThostFtdcTradingCodeField& p);
void from_json(const json& j, CThostFtdcTradingCodeField& p);

void to_json(json& j, const CThostFtdcPartBrokerField& p);
void from_json(const json& j, CThostFtdcPartBrokerField& p);

void to_json(json& j, const CThostFtdcSuperUserField& p);
void from_json(const json& j, CThostFtdcSuperUserField& p);

void to_json(json& j, const CThostFtdcSuperUserFunctionField& p);
void from_json(const json& j, CThostFtdcSuperUserFunctionField& p);

void to_json(json& j, const CThostFtdcInvestorGroupField& p);
void from_json(const json& j, CThostFtdcInvestorGroupField& p);

void to_json(json& j, const CThostFtdcTradingAccountField& p);
void from_json(const json& j, CThostFtdcTradingAccountField& p);

void to_json(json& j, const CThostFtdcInvestorPositionField& p);
void from_json(const json& j, CThostFtdcInvestorPositionField& p);

void to_json(json& j, const CThostFtdcInstrumentMarginRateField& p);
void from_json(const json& j, CThostFtdcInstrumentMarginRateField& p);

void to_json(json& j, const CThostFtdcInstrumentCommissionRateField& p);
void from_json(const json& j, CThostFtdcInstrumentCommissionRateField& p);

void to_json(json& j, const CThostFtdcDepthMarketDataField& p);
void from_json(const json& j, CThostFtdcDepthMarketDataField& p);

void to_json(json& j, const CThostFtdcInstrumentTradingRightField& p);
void from_json(const json& j, CThostFtdcInstrumentTradingRightField& p);

void to_json(json& j, const CThostFtdcBrokerUserField& p);
void from_json(const json& j, CThostFtdcBrokerUserField& p);

void to_json(json& j, const CThostFtdcBrokerUserPasswordField& p);
void from_json(const json& j, CThostFtdcBrokerUserPasswordField& p);

void to_json(json& j, const CThostFtdcBrokerUserFunctionField& p);
void from_json(const json& j, CThostFtdcBrokerUserFunctionField& p);

void to_json(json& j, const CThostFtdcTraderOfferField& p);
void from_json(const json& j, CThostFtdcTraderOfferField& p);

void to_json(json& j, const CThostFtdcSettlementInfoField& p);
void from_json(const json& j, CThostFtdcSettlementInfoField& p);

void to_json(json& j, const CThostFtdcInstrumentMarginRateAdjustField& p);
void from_json(const json& j, CThostFtdcInstrumentMarginRateAdjustField& p);

void to_json(json& j, const CThostFtdcExchangeMarginRateField& p);
void from_json(const json& j, CThostFtdcExchangeMarginRateField& p);

void to_json(json& j, const CThostFtdcExchangeMarginRateAdjustField& p);
void from_json(const json& j, CThostFtdcExchangeMarginRateAdjustField& p);

void to_json(json& j, const CThostFtdcExchangeRateField& p);
void from_json(const json& j, CThostFtdcExchangeRateField& p);

void to_json(json& j, const CThostFtdcSettlementRefField& p);
void from_json(const json& j, CThostFtdcSettlementRefField& p);

void to_json(json& j, const CThostFtdcCurrentTimeField& p);
void from_json(const json& j, CThostFtdcCurrentTimeField& p);

void to_json(json& j, const CThostFtdcCommPhaseField& p);
void from_json(const json& j, CThostFtdcCommPhaseField& p);

void to_json(json& j, const CThostFtdcLoginInfoField& p);
void from_json(const json& j, CThostFtdcLoginInfoField& p);

void to_json(json& j, const CThostFtdcLogoutAllField& p);
void from_json(const json& j, CThostFtdcLogoutAllField& p);

void to_json(json& j, const CThostFtdcFrontStatusField& p);
void from_json(const json& j, CThostFtdcFrontStatusField& p);

void to_json(json& j, const CThostFtdcUserPasswordUpdateField& p);
void from_json(const json& j, CThostFtdcUserPasswordUpdateField& p);

void to_json(json& j, const CThostFtdcInputOrderField& p);
void from_json(const json& j, CThostFtdcInputOrderField& p);

void to_json(json& j, const CThostFtdcOrderField& p);
void from_json(const json& j, CThostFtdcOrderField& p);

void to_json(json& j, const CThostFtdcExchangeOrderField& p);
void from_json(const json& j, CThostFtdcExchangeOrderField& p);

void to_json(json& j, const CThostFtdcExchangeOrderInsertErrorField& p);
void from_json(const json& j, CThostFtdcExchangeOrderInsertErrorField& p);

void to_json(json& j, const CThostFtdcInputOrderActionField& p);
void from_json(const json& j, CThostFtdcInputOrderActionField& p);

void to_json(json& j, const CThostFtdcOrderActionField& p);
void from_json(const json& j, CThostFtdcOrderActionField& p);

void to_json(json& j, const CThostFtdcExchangeOrderActionField& p);
void from_json(const json& j, CThostFtdcExchangeOrderActionField& p);

void to_json(json& j, const CThostFtdcExchangeOrderActionErrorField& p);
void from_json(const json& j, CThostFtdcExchangeOrderActionErrorField& p);

void to_json(json& j, const CThostFtdcExchangeTradeField& p);
void from_json(const json& j, CThostFtdcExchangeTradeField& p);

void to_json(json& j, const CThostFtdcTradeField& p);
void from_json(const json& j, CThostFtdcTradeField& p);

void to_json(json& j, const CThostFtdcUserSessionField& p);
void from_json(const json& j, CThostFtdcUserSessionField& p);

void to_json(json& j, const CThostFtdcQryMaxOrderVolumeField& p);
void from_json(const json& j, CThostFtdcQryMaxOrderVolumeField& p);

void to_json(json& j, const CThostFtdcSettlementInfoConfirmField& p);
void from_json(const json& j, CThostFtdcSettlementInfoConfirmField& p);

void to_json(json& j, const CThostFtdcSyncDepositField& p);
void from_json(const json& j, CThostFtdcSyncDepositField& p);

void to_json(json& j, const CThostFtdcSyncFundMortgageField& p);
void from_json(const json& j, CThostFtdcSyncFundMortgageField& p);

void to_json(json& j, const CThostFtdcBrokerSyncField& p);
void from_json(const json& j, CThostFtdcBrokerSyncField& p);

void to_json(json& j, const CThostFtdcSyncingInvestorField& p);
void from_json(const json& j, CThostFtdcSyncingInvestorField& p);

void to_json(json& j, const CThostFtdcSyncingTradingCodeField& p);
void from_json(const json& j, CThostFtdcSyncingTradingCodeField& p);

void to_json(json& j, const CThostFtdcSyncingInvestorGroupField& p);
void from_json(const json& j, CThostFtdcSyncingInvestorGroupField& p);

void to_json(json& j, const CThostFtdcSyncingTradingAccountField& p);
void from_json(const json& j, CThostFtdcSyncingTradingAccountField& p);

void to_json(json& j, const CThostFtdcSyncingInvestorPositionField& p);
void from_json(const json& j, CThostFtdcSyncingInvestorPositionField& p);

void to_json(json& j, const CThostFtdcSyncingInstrumentMarginRateField& p);
void from_json(const json& j, CThostFtdcSyncingInstrumentMarginRateField& p);

void to_json(json& j, const CThostFtdcSyncingInstrumentCommissionRateField& p);
void from_json(const json& j, CThostFtdcSyncingInstrumentCommissionRateField& p);

void to_json(json& j, const CThostFtdcSyncingInstrumentTradingRightField& p);
void from_json(const json& j, CThostFtdcSyncingInstrumentTradingRightField& p);

void to_json(json& j, const CThostFtdcQryOrderField& p);
void from_json(const json& j, CThostFtdcQryOrderField& p);

void to_json(json& j, const CThostFtdcQryTradeField& p);
void from_json(const json& j, CThostFtdcQryTradeField& p);

void to_json(json& j, const CThostFtdcQryInvestorPositionField& p);
void from_json(const json& j, CThostFtdcQryInvestorPositionField& p);

void to_json(json& j, const CThostFtdcQryTradingAccountField& p);
void from_json(const json& j, CThostFtdcQryTradingAccountField& p);

void to_json(json& j, const CThostFtdcQryInvestorField& p);
void from_json(const json& j, CThostFtdcQryInvestorField& p);

void to_json(json& j, const CThostFtdcQryTradingCodeField& p);
void from_json(const json& j, CThostFtdcQryTradingCodeField& p);

void to_json(json& j, const CThostFtdcQryInvestorGroupField& p);
void from_json(const json& j, CThostFtdcQryInvestorGroupField& p);

void to_json(json& j, const CThostFtdcQryInstrumentMarginRateField& p);
void from_json(const json& j, CThostFtdcQryInstrumentMarginRateField& p);

void to_json(json& j, const CThostFtdcQryInstrumentCommissionRateField& p);
void from_json(const json& j, CThostFtdcQryInstrumentCommissionRateField& p);

void to_json(json& j, const CThostFtdcQryInstrumentTradingRightField& p);
void from_json(const json& j, CThostFtdcQryInstrumentTradingRightField& p);

void to_json(json& j, const CThostFtdcQryBrokerField& p);
void from_json(const json& j, CThostFtdcQryBrokerField& p);

void to_json(json& j, const CThostFtdcQryTraderField& p);
void from_json(const json& j, CThostFtdcQryTraderField& p);

void to_json(json& j, const CThostFtdcQrySuperUserFunctionField& p);
void from_json(const json& j, CThostFtdcQrySuperUserFunctionField& p);

void to_json(json& j, const CThostFtdcQryUserSessionField& p);
void from_json(const json& j, CThostFtdcQryUserSessionField& p);

void to_json(json& j, const CThostFtdcQryPartBrokerField& p);
void from_json(const json& j, CThostFtdcQryPartBrokerField& p);

void to_json(json& j, const CThostFtdcQryFrontStatusField& p);
void from_json(const json& j, CThostFtdcQryFrontStatusField& p);

void to_json(json& j, const CThostFtdcQryExchangeOrderField& p);
void from_json(const json& j, CThostFtdcQryExchangeOrderField& p);

void to_json(json& j, const CThostFtdcQryOrderActionField& p);
void from_json(const json& j, CThostFtdcQryOrderActionField& p);

void to_json(json& j, const CThostFtdcQryExchangeOrderActionField& p);
void from_json(const json& j, CThostFtdcQryExchangeOrderActionField& p);

void to_json(json& j, const CThostFtdcQrySuperUserField& p);
void from_json(const json& j, CThostFtdcQrySuperUserField& p);

void to_json(json& j, const CThostFtdcQryExchangeField& p);
void from_json(const json& j, CThostFtdcQryExchangeField& p);

void to_json(json& j, const CThostFtdcQryProductField& p);
void from_json(const json& j, CThostFtdcQryProductField& p);

void to_json(json& j, const CThostFtdcQryInstrumentField& p);
void from_json(const json& j, CThostFtdcQryInstrumentField& p);

void to_json(json& j, const CThostFtdcQryDepthMarketDataField& p);
void from_json(const json& j, CThostFtdcQryDepthMarketDataField& p);

void to_json(json& j, const CThostFtdcQryBrokerUserField& p);
void from_json(const json& j, CThostFtdcQryBrokerUserField& p);

void to_json(json& j, const CThostFtdcQryBrokerUserFunctionField& p);
void from_json(const json& j, CThostFtdcQryBrokerUserFunctionField& p);

void to_json(json& j, const CThostFtdcQryTraderOfferField& p);
void from_json(const json& j, CThostFtdcQryTraderOfferField& p);

void to_json(json& j, const CThostFtdcQrySyncDepositField& p);
void from_json(const json& j, CThostFtdcQrySyncDepositField& p);

void to_json(json& j, const CThostFtdcQrySettlementInfoField& p);
void from_json(const json& j, CThostFtdcQrySettlementInfoField& p);

void to_json(json& j, const CThostFtdcQryExchangeMarginRateField& p);
void from_json(const json& j, CThostFtdcQryExchangeMarginRateField& p);

void to_json(json& j, const CThostFtdcQryExchangeMarginRateAdjustField& p);
void from_json(const json& j, CThostFtdcQryExchangeMarginRateAdjustField& p);

void to_json(json& j, const CThostFtdcQryExchangeRateField& p);
void from_json(const json& j, CThostFtdcQryExchangeRateField& p);

void to_json(json& j, const CThostFtdcQrySyncFundMortgageField& p);
void from_json(const json& j, CThostFtdcQrySyncFundMortgageField& p);

void to_json(json& j, const CThostFtdcQryHisOrderField& p);
void from_json(const json& j, CThostFtdcQryHisOrderField& p);

void to_json(json& j, const CThostFtdcOptionInstrMiniMarginField& p);
void from_json(const json& j, CThostFtdcOptionInstrMiniMarginField& p);

void to_json(json& j, const CThostFtdcOptionInstrMarginAdjustField& p);
void from_json(const json& j, CThostFtdcOptionInstrMarginAdjustField& p);

void to_json(json& j, const CThostFtdcOptionInstrCommRateField& p);
void from_json(const json& j, CThostFtdcOptionInstrCommRateField& p);

void to_json(json& j, const CThostFtdcOptionInstrTradeCostField& p);
void from_json(const json& j, CThostFtdcOptionInstrTradeCostField& p);

void to_json(json& j, const CThostFtdcQryOptionInstrTradeCostField& p);
void from_json(const json& j, CThostFtdcQryOptionInstrTradeCostField& p);

void to_json(json& j, const CThostFtdcQryOptionInstrCommRateField& p);
void from_json(const json& j, CThostFtdcQryOptionInstrCommRateField& p);

void to_json(json& j, const CThostFtdcIndexPriceField& p);
void from_json(const json& j, CThostFtdcIndexPriceField& p);

void to_json(json& j, const CThostFtdcInputExecOrderField& p);
void from_json(const json& j, CThostFtdcInputExecOrderField& p);

void to_json(json& j, const CThostFtdcInputExecOrderActionField& p);
void from_json(const json& j, CThostFtdcInputExecOrderActionField& p);

void to_json(json& j, const CThostFtdcExecOrderField& p);
void from_json(const json& j, CThostFtdcExecOrderField& p);

void to_json(json& j, const CThostFtdcExecOrderActionField& p);
void from_json(const json& j, CThostFtdcExecOrderActionField& p);

void to_json(json& j, const CThostFtdcQryExecOrderField& p);
void from_json(const json& j, CThostFtdcQryExecOrderField& p);

void to_json(json& j, const CThostFtdcExchangeExecOrderField& p);
void from_json(const json& j, CThostFtdcExchangeExecOrderField& p);

void to_json(json& j, const CThostFtdcQryExchangeExecOrderField& p);
void from_json(const json& j, CThostFtdcQryExchangeExecOrderField& p);

void to_json(json& j, const CThostFtdcQryExecOrderActionField& p);
void from_json(const json& j, CThostFtdcQryExecOrderActionField& p);

void to_json(json& j, const CThostFtdcExchangeExecOrderActionField& p);
void from_json(const json& j, CThostFtdcExchangeExecOrderActionField& p);

void to_json(json& j, const CThostFtdcQryExchangeExecOrderActionField& p);
void from_json(const json& j, CThostFtdcQryExchangeExecOrderActionField& p);

void to_json(json& j, const CThostFtdcErrExecOrderField& p);
void from_json(const json& j, CThostFtdcErrExecOrderField& p);

void to_json(json& j, const CThostFtdcQryErrExecOrderField& p);
void from_json(const json& j, CThostFtdcQryErrExecOrderField& p);

void to_json(json& j, const CThostFtdcErrExecOrderActionField& p);
void from_json(const json& j, CThostFtdcErrExecOrderActionField& p);

void to_json(json& j, const CThostFtdcQryErrExecOrderActionField& p);
void from_json(const json& j, CThostFtdcQryErrExecOrderActionField& p);

void to_json(json& j, const CThostFtdcOptionInstrTradingRightField& p);
void from_json(const json& j, CThostFtdcOptionInstrTradingRightField& p);

void to_json(json& j, const CThostFtdcQryOptionInstrTradingRightField& p);
void from_json(const json& j, CThostFtdcQryOptionInstrTradingRightField& p);

void to_json(json& j, const CThostFtdcInputForQuoteField& p);
void from_json(const json& j, CThostFtdcInputForQuoteField& p);

void to_json(json& j, const CThostFtdcForQuoteField& p);
void from_json(const json& j, CThostFtdcForQuoteField& p);

void to_json(json& j, const CThostFtdcQryForQuoteField& p);
void from_json(const json& j, CThostFtdcQryForQuoteField& p);

void to_json(json& j, const CThostFtdcExchangeForQuoteField& p);
void from_json(const json& j, CThostFtdcExchangeForQuoteField& p);

void to_json(json& j, const CThostFtdcQryExchangeForQuoteField& p);
void from_json(const json& j, CThostFtdcQryExchangeForQuoteField& p);

void to_json(json& j, const CThostFtdcInputQuoteField& p);
void from_json(const json& j, CThostFtdcInputQuoteField& p);

void to_json(json& j, const CThostFtdcInputQuoteActionField& p);
void from_json(const json& j, CThostFtdcInputQuoteActionField& p);

void to_json(json& j, const CThostFtdcQuoteField& p);
void from_json(const json& j, CThostFtdcQuoteField& p);

void to_json(json& j, const CThostFtdcQuoteActionField& p);
void from_json(const json& j, CThostFtdcQuoteActionField& p);

void to_json(json& j, const CThostFtdcQryQuoteField& p);
void from_json(const json& j, CThostFtdcQryQuoteField& p);

void to_json(json& j, const CThostFtdcExchangeQuoteField& p);
void from_json(const json& j, CThostFtdcExchangeQuoteField& p);

void to_json(json& j, const CThostFtdcQryExchangeQuoteField& p);
void from_json(const json& j, CThostFtdcQryExchangeQuoteField& p);

void to_json(json& j, const CThostFtdcQryQuoteActionField& p);
void from_json(const json& j, CThostFtdcQryQuoteActionField& p);

void to_json(json& j, const CThostFtdcExchangeQuoteActionField& p);
void from_json(const json& j, CThostFtdcExchangeQuoteActionField& p);

void to_json(json& j, const CThostFtdcQryExchangeQuoteActionField& p);
void from_json(const json& j, CThostFtdcQryExchangeQuoteActionField& p);

void to_json(json& j, const CThostFtdcOptionInstrDeltaField& p);
void from_json(const json& j, CThostFtdcOptionInstrDeltaField& p);

void to_json(json& j, const CThostFtdcForQuoteRspField& p);
void from_json(const json& j, CThostFtdcForQuoteRspField& p);

void to_json(json& j, const CThostFtdcStrikeOffsetField& p);
void from_json(const json& j, CThostFtdcStrikeOffsetField& p);

void to_json(json& j, const CThostFtdcQryStrikeOffsetField& p);
void from_json(const json& j, CThostFtdcQryStrikeOffsetField& p);

void to_json(json& j, const CThostFtdcInputBatchOrderActionField& p);
void from_json(const json& j, CThostFtdcInputBatchOrderActionField& p);

void to_json(json& j, const CThostFtdcBatchOrderActionField& p);
void from_json(const json& j, CThostFtdcBatchOrderActionField& p);

void to_json(json& j, const CThostFtdcExchangeBatchOrderActionField& p);
void from_json(const json& j, CThostFtdcExchangeBatchOrderActionField& p);

void to_json(json& j, const CThostFtdcQryBatchOrderActionField& p);
void from_json(const json& j, CThostFtdcQryBatchOrderActionField& p);

void to_json(json& j, const CThostFtdcCombInstrumentGuardField& p);
void from_json(const json& j, CThostFtdcCombInstrumentGuardField& p);

void to_json(json& j, const CThostFtdcQryCombInstrumentGuardField& p);
void from_json(const json& j, CThostFtdcQryCombInstrumentGuardField& p);

void to_json(json& j, const CThostFtdcInputCombActionField& p);
void from_json(const json& j, CThostFtdcInputCombActionField& p);

void to_json(json& j, const CThostFtdcCombActionField& p);
void from_json(const json& j, CThostFtdcCombActionField& p);

void to_json(json& j, const CThostFtdcQryCombActionField& p);
void from_json(const json& j, CThostFtdcQryCombActionField& p);

void to_json(json& j, const CThostFtdcExchangeCombActionField& p);
void from_json(const json& j, CThostFtdcExchangeCombActionField& p);

void to_json(json& j, const CThostFtdcQryExchangeCombActionField& p);
void from_json(const json& j, CThostFtdcQryExchangeCombActionField& p);

void to_json(json& j, const CThostFtdcProductExchRateField& p);
void from_json(const json& j, CThostFtdcProductExchRateField& p);

void to_json(json& j, const CThostFtdcQryProductExchRateField& p);
void from_json(const json& j, CThostFtdcQryProductExchRateField& p);

void to_json(json& j, const CThostFtdcQryForQuoteParamField& p);
void from_json(const json& j, CThostFtdcQryForQuoteParamField& p);

void to_json(json& j, const CThostFtdcForQuoteParamField& p);
void from_json(const json& j, CThostFtdcForQuoteParamField& p);

void to_json(json& j, const CThostFtdcMMOptionInstrCommRateField& p);
void from_json(const json& j, CThostFtdcMMOptionInstrCommRateField& p);

void to_json(json& j, const CThostFtdcQryMMOptionInstrCommRateField& p);
void from_json(const json& j, CThostFtdcQryMMOptionInstrCommRateField& p);

void to_json(json& j, const CThostFtdcMMInstrumentCommissionRateField& p);
void from_json(const json& j, CThostFtdcMMInstrumentCommissionRateField& p);

void to_json(json& j, const CThostFtdcQryMMInstrumentCommissionRateField& p);
void from_json(const json& j, CThostFtdcQryMMInstrumentCommissionRateField& p);

void to_json(json& j, const CThostFtdcInstrumentOrderCommRateField& p);
void from_json(const json& j, CThostFtdcInstrumentOrderCommRateField& p);

void to_json(json& j, const CThostFtdcQryInstrumentOrderCommRateField& p);
void from_json(const json& j, CThostFtdcQryInstrumentOrderCommRateField& p);

void to_json(json& j, const CThostFtdcTradeParamField& p);
void from_json(const json& j, CThostFtdcTradeParamField& p);

void to_json(json& j, const CThostFtdcInstrumentMarginRateULField& p);
void from_json(const json& j, CThostFtdcInstrumentMarginRateULField& p);

void to_json(json& j, const CThostFtdcFutureLimitPosiParamField& p);
void from_json(const json& j, CThostFtdcFutureLimitPosiParamField& p);

void to_json(json& j, const CThostFtdcLoginForbiddenIPField& p);
void from_json(const json& j, CThostFtdcLoginForbiddenIPField& p);

void to_json(json& j, const CThostFtdcIPListField& p);
void from_json(const json& j, CThostFtdcIPListField& p);

void to_json(json& j, const CThostFtdcInputOptionSelfCloseField& p);
void from_json(const json& j, CThostFtdcInputOptionSelfCloseField& p);

void to_json(json& j, const CThostFtdcInputOptionSelfCloseActionField& p);
void from_json(const json& j, CThostFtdcInputOptionSelfCloseActionField& p);

void to_json(json& j, const CThostFtdcOptionSelfCloseField& p);
void from_json(const json& j, CThostFtdcOptionSelfCloseField& p);

void to_json(json& j, const CThostFtdcOptionSelfCloseActionField& p);
void from_json(const json& j, CThostFtdcOptionSelfCloseActionField& p);

void to_json(json& j, const CThostFtdcQryOptionSelfCloseField& p);
void from_json(const json& j, CThostFtdcQryOptionSelfCloseField& p);

void to_json(json& j, const CThostFtdcExchangeOptionSelfCloseField& p);
void from_json(const json& j, CThostFtdcExchangeOptionSelfCloseField& p);

void to_json(json& j, const CThostFtdcQryOptionSelfCloseActionField& p);
void from_json(const json& j, CThostFtdcQryOptionSelfCloseActionField& p);

void to_json(json& j, const CThostFtdcExchangeOptionSelfCloseActionField& p);
void from_json(const json& j, CThostFtdcExchangeOptionSelfCloseActionField& p);

void to_json(json& j, const CThostFtdcSyncDelaySwapField& p);
void from_json(const json& j, CThostFtdcSyncDelaySwapField& p);

void to_json(json& j, const CThostFtdcQrySyncDelaySwapField& p);
void from_json(const json& j, CThostFtdcQrySyncDelaySwapField& p);

void to_json(json& j, const CThostFtdcInvestUnitField& p);
void from_json(const json& j, CThostFtdcInvestUnitField& p);

void to_json(json& j, const CThostFtdcQryInvestUnitField& p);
void from_json(const json& j, CThostFtdcQryInvestUnitField& p);

void to_json(json& j, const CThostFtdcSecAgentCheckModeField& p);
void from_json(const json& j, CThostFtdcSecAgentCheckModeField& p);

void to_json(json& j, const CThostFtdcSecAgentTradeInfoField& p);
void from_json(const json& j, CThostFtdcSecAgentTradeInfoField& p);

void to_json(json& j, const CThostFtdcMarketDataField& p);
void from_json(const json& j, CThostFtdcMarketDataField& p);

void to_json(json& j, const CThostFtdcMarketDataBaseField& p);
void from_json(const json& j, CThostFtdcMarketDataBaseField& p);

void to_json(json& j, const CThostFtdcMarketDataStaticField& p);
void from_json(const json& j, CThostFtdcMarketDataStaticField& p);

void to_json(json& j, const CThostFtdcMarketDataLastMatchField& p);
void from_json(const json& j, CThostFtdcMarketDataLastMatchField& p);

void to_json(json& j, const CThostFtdcMarketDataBestPriceField& p);
void from_json(const json& j, CThostFtdcMarketDataBestPriceField& p);

void to_json(json& j, const CThostFtdcMarketDataBid23Field& p);
void from_json(const json& j, CThostFtdcMarketDataBid23Field& p);

void to_json(json& j, const CThostFtdcMarketDataAsk23Field& p);
void from_json(const json& j, CThostFtdcMarketDataAsk23Field& p);

void to_json(json& j, const CThostFtdcMarketDataBid45Field& p);
void from_json(const json& j, CThostFtdcMarketDataBid45Field& p);

void to_json(json& j, const CThostFtdcMarketDataAsk45Field& p);
void from_json(const json& j, CThostFtdcMarketDataAsk45Field& p);

void to_json(json& j, const CThostFtdcMarketDataUpdateTimeField& p);
void from_json(const json& j, CThostFtdcMarketDataUpdateTimeField& p);

void to_json(json& j, const CThostFtdcMarketDataBandingPriceField& p);
void from_json(const json& j, CThostFtdcMarketDataBandingPriceField& p);

void to_json(json& j, const CThostFtdcMarketDataExchangeField& p);
void from_json(const json& j, CThostFtdcMarketDataExchangeField& p);

void to_json(json& j, const CThostFtdcSpecificInstrumentField& p);
void from_json(const json& j, CThostFtdcSpecificInstrumentField& p);

void to_json(json& j, const CThostFtdcInstrumentStatusField& p);
void from_json(const json& j, CThostFtdcInstrumentStatusField& p);

void to_json(json& j, const CThostFtdcQryInstrumentStatusField& p);
void from_json(const json& j, CThostFtdcQryInstrumentStatusField& p);

void to_json(json& j, const CThostFtdcInvestorAccountField& p);
void from_json(const json& j, CThostFtdcInvestorAccountField& p);

void to_json(json& j, const CThostFtdcPositionProfitAlgorithmField& p);
void from_json(const json& j, CThostFtdcPositionProfitAlgorithmField& p);

void to_json(json& j, const CThostFtdcDiscountField& p);
void from_json(const json& j, CThostFtdcDiscountField& p);

void to_json(json& j, const CThostFtdcQryTransferBankField& p);
void from_json(const json& j, CThostFtdcQryTransferBankField& p);

void to_json(json& j, const CThostFtdcTransferBankField& p);
void from_json(const json& j, CThostFtdcTransferBankField& p);

void to_json(json& j, const CThostFtdcQryInvestorPositionDetailField& p);
void from_json(const json& j, CThostFtdcQryInvestorPositionDetailField& p);

void to_json(json& j, const CThostFtdcInvestorPositionDetailField& p);
void from_json(const json& j, CThostFtdcInvestorPositionDetailField& p);

void to_json(json& j, const CThostFtdcTradingAccountPasswordField& p);
void from_json(const json& j, CThostFtdcTradingAccountPasswordField& p);

void to_json(json& j, const CThostFtdcMDTraderOfferField& p);
void from_json(const json& j, CThostFtdcMDTraderOfferField& p);

void to_json(json& j, const CThostFtdcQryMDTraderOfferField& p);
void from_json(const json& j, CThostFtdcQryMDTraderOfferField& p);

void to_json(json& j, const CThostFtdcQryNoticeField& p);
void from_json(const json& j, CThostFtdcQryNoticeField& p);

void to_json(json& j, const CThostFtdcNoticeField& p);
void from_json(const json& j, CThostFtdcNoticeField& p);

void to_json(json& j, const CThostFtdcUserRightField& p);
void from_json(const json& j, CThostFtdcUserRightField& p);

void to_json(json& j, const CThostFtdcQrySettlementInfoConfirmField& p);
void from_json(const json& j, CThostFtdcQrySettlementInfoConfirmField& p);

void to_json(json& j, const CThostFtdcLoadSettlementInfoField& p);
void from_json(const json& j, CThostFtdcLoadSettlementInfoField& p);

void to_json(json& j, const CThostFtdcBrokerWithdrawAlgorithmField& p);
void from_json(const json& j, CThostFtdcBrokerWithdrawAlgorithmField& p);

void to_json(json& j, const CThostFtdcTradingAccountPasswordUpdateV1Field& p);
void from_json(const json& j, CThostFtdcTradingAccountPasswordUpdateV1Field& p);

void to_json(json& j, const CThostFtdcTradingAccountPasswordUpdateField& p);
void from_json(const json& j, CThostFtdcTradingAccountPasswordUpdateField& p);

void to_json(json& j, const CThostFtdcQryCombinationLegField& p);
void from_json(const json& j, CThostFtdcQryCombinationLegField& p);

void to_json(json& j, const CThostFtdcQrySyncStatusField& p);
void from_json(const json& j, CThostFtdcQrySyncStatusField& p);

void to_json(json& j, const CThostFtdcCombinationLegField& p);
void from_json(const json& j, CThostFtdcCombinationLegField& p);

void to_json(json& j, const CThostFtdcSyncStatusField& p);
void from_json(const json& j, CThostFtdcSyncStatusField& p);

void to_json(json& j, const CThostFtdcQryLinkManField& p);
void from_json(const json& j, CThostFtdcQryLinkManField& p);

void to_json(json& j, const CThostFtdcLinkManField& p);
void from_json(const json& j, CThostFtdcLinkManField& p);

void to_json(json& j, const CThostFtdcQryBrokerUserEventField& p);
void from_json(const json& j, CThostFtdcQryBrokerUserEventField& p);

void to_json(json& j, const CThostFtdcBrokerUserEventField& p);
void from_json(const json& j, CThostFtdcBrokerUserEventField& p);

void to_json(json& j, const CThostFtdcQryContractBankField& p);
void from_json(const json& j, CThostFtdcQryContractBankField& p);

void to_json(json& j, const CThostFtdcContractBankField& p);
void from_json(const json& j, CThostFtdcContractBankField& p);

void to_json(json& j, const CThostFtdcInvestorPositionCombineDetailField& p);
void from_json(const json& j, CThostFtdcInvestorPositionCombineDetailField& p);

void to_json(json& j, const CThostFtdcParkedOrderField& p);
void from_json(const json& j, CThostFtdcParkedOrderField& p);

void to_json(json& j, const CThostFtdcParkedOrderActionField& p);
void from_json(const json& j, CThostFtdcParkedOrderActionField& p);

void to_json(json& j, const CThostFtdcQryParkedOrderField& p);
void from_json(const json& j, CThostFtdcQryParkedOrderField& p);

void to_json(json& j, const CThostFtdcQryParkedOrderActionField& p);
void from_json(const json& j, CThostFtdcQryParkedOrderActionField& p);

void to_json(json& j, const CThostFtdcRemoveParkedOrderField& p);
void from_json(const json& j, CThostFtdcRemoveParkedOrderField& p);

void to_json(json& j, const CThostFtdcRemoveParkedOrderActionField& p);
void from_json(const json& j, CThostFtdcRemoveParkedOrderActionField& p);

void to_json(json& j, const CThostFtdcInvestorWithdrawAlgorithmField& p);
void from_json(const json& j, CThostFtdcInvestorWithdrawAlgorithmField& p);

void to_json(json& j, const CThostFtdcQryInvestorPositionCombineDetailField& p);
void from_json(const json& j, CThostFtdcQryInvestorPositionCombineDetailField& p);

void to_json(json& j, const CThostFtdcMarketDataAveragePriceField& p);
void from_json(const json& j, CThostFtdcMarketDataAveragePriceField& p);

void to_json(json& j, const CThostFtdcVerifyInvestorPasswordField& p);
void from_json(const json& j, CThostFtdcVerifyInvestorPasswordField& p);

void to_json(json& j, const CThostFtdcUserIPField& p);
void from_json(const json& j, CThostFtdcUserIPField& p);

void to_json(json& j, const CThostFtdcTradingNoticeInfoField& p);
void from_json(const json& j, CThostFtdcTradingNoticeInfoField& p);

void to_json(json& j, const CThostFtdcTradingNoticeField& p);
void from_json(const json& j, CThostFtdcTradingNoticeField& p);

void to_json(json& j, const CThostFtdcQryTradingNoticeField& p);
void from_json(const json& j, CThostFtdcQryTradingNoticeField& p);

void to_json(json& j, const CThostFtdcQryErrOrderField& p);
void from_json(const json& j, CThostFtdcQryErrOrderField& p);

void to_json(json& j, const CThostFtdcErrOrderField& p);
void from_json(const json& j, CThostFtdcErrOrderField& p);

void to_json(json& j, const CThostFtdcErrorConditionalOrderField& p);
void from_json(const json& j, CThostFtdcErrorConditionalOrderField& p);

void to_json(json& j, const CThostFtdcQryErrOrderActionField& p);
void from_json(const json& j, CThostFtdcQryErrOrderActionField& p);

void to_json(json& j, const CThostFtdcErrOrderActionField& p);
void from_json(const json& j, CThostFtdcErrOrderActionField& p);

void to_json(json& j, const CThostFtdcQryExchangeSequenceField& p);
void from_json(const json& j, CThostFtdcQryExchangeSequenceField& p);

void to_json(json& j, const CThostFtdcExchangeSequenceField& p);
void from_json(const json& j, CThostFtdcExchangeSequenceField& p);

void to_json(json& j, const CThostFtdcQryMaxOrderVolumeWithPriceField& p);
void from_json(const json& j, CThostFtdcQryMaxOrderVolumeWithPriceField& p);

void to_json(json& j, const CThostFtdcQryBrokerTradingParamsField& p);
void from_json(const json& j, CThostFtdcQryBrokerTradingParamsField& p);

void to_json(json& j, const CThostFtdcBrokerTradingParamsField& p);
void from_json(const json& j, CThostFtdcBrokerTradingParamsField& p);

void to_json(json& j, const CThostFtdcQryBrokerTradingAlgosField& p);
void from_json(const json& j, CThostFtdcQryBrokerTradingAlgosField& p);

void to_json(json& j, const CThostFtdcBrokerTradingAlgosField& p);
void from_json(const json& j, CThostFtdcBrokerTradingAlgosField& p);

void to_json(json& j, const CThostFtdcQueryBrokerDepositField& p);
void from_json(const json& j, CThostFtdcQueryBrokerDepositField& p);

void to_json(json& j, const CThostFtdcBrokerDepositField& p);
void from_json(const json& j, CThostFtdcBrokerDepositField& p);

void to_json(json& j, const CThostFtdcQryCFMMCBrokerKeyField& p);
void from_json(const json& j, CThostFtdcQryCFMMCBrokerKeyField& p);

void to_json(json& j, const CThostFtdcCFMMCBrokerKeyField& p);
void from_json(const json& j, CThostFtdcCFMMCBrokerKeyField& p);

void to_json(json& j, const CThostFtdcCFMMCTradingAccountKeyField& p);
void from_json(const json& j, CThostFtdcCFMMCTradingAccountKeyField& p);

void to_json(json& j, const CThostFtdcQryCFMMCTradingAccountKeyField& p);
void from_json(const json& j, CThostFtdcQryCFMMCTradingAccountKeyField& p);

void to_json(json& j, const CThostFtdcBrokerUserOTPParamField& p);
void from_json(const json& j, CThostFtdcBrokerUserOTPParamField& p);

void to_json(json& j, const CThostFtdcManualSyncBrokerUserOTPField& p);
void from_json(const json& j, CThostFtdcManualSyncBrokerUserOTPField& p);

void to_json(json& j, const CThostFtdcCommRateModelField& p);
void from_json(const json& j, CThostFtdcCommRateModelField& p);

void to_json(json& j, const CThostFtdcQryCommRateModelField& p);
void from_json(const json& j, CThostFtdcQryCommRateModelField& p);

void to_json(json& j, const CThostFtdcMarginModelField& p);
void from_json(const json& j, CThostFtdcMarginModelField& p);

void to_json(json& j, const CThostFtdcQryMarginModelField& p);
void from_json(const json& j, CThostFtdcQryMarginModelField& p);

void to_json(json& j, const CThostFtdcEWarrantOffsetField& p);
void from_json(const json& j, CThostFtdcEWarrantOffsetField& p);

void to_json(json& j, const CThostFtdcQryEWarrantOffsetField& p);
void from_json(const json& j, CThostFtdcQryEWarrantOffsetField& p);

void to_json(json& j, const CThostFtdcQryInvestorProductGroupMarginField& p);
void from_json(const json& j, CThostFtdcQryInvestorProductGroupMarginField& p);

void to_json(json& j, const CThostFtdcInvestorProductGroupMarginField& p);
void from_json(const json& j, CThostFtdcInvestorProductGroupMarginField& p);

void to_json(json& j, const CThostFtdcQueryCFMMCTradingAccountTokenField& p);
void from_json(const json& j, CThostFtdcQueryCFMMCTradingAccountTokenField& p);

void to_json(json& j, const CThostFtdcCFMMCTradingAccountTokenField& p);
void from_json(const json& j, CThostFtdcCFMMCTradingAccountTokenField& p);

void to_json(json& j, const CThostFtdcQryProductGroupField& p);
void from_json(const json& j, CThostFtdcQryProductGroupField& p);

void to_json(json& j, const CThostFtdcProductGroupField& p);
void from_json(const json& j, CThostFtdcProductGroupField& p);

void to_json(json& j, const CThostFtdcBulletinField& p);
void from_json(const json& j, CThostFtdcBulletinField& p);

void to_json(json& j, const CThostFtdcQryBulletinField& p);
void from_json(const json& j, CThostFtdcQryBulletinField& p);

void to_json(json& j, const CThostFtdcMulticastInstrumentField& p);
void from_json(const json& j, CThostFtdcMulticastInstrumentField& p);

void to_json(json& j, const CThostFtdcQryMulticastInstrumentField& p);
void from_json(const json& j, CThostFtdcQryMulticastInstrumentField& p);

void to_json(json& j, const CThostFtdcAppIDAuthAssignField& p);
void from_json(const json& j, CThostFtdcAppIDAuthAssignField& p);

void to_json(json& j, const CThostFtdcReqOpenAccountField& p);
void from_json(const json& j, CThostFtdcReqOpenAccountField& p);

void to_json(json& j, const CThostFtdcReqCancelAccountField& p);
void from_json(const json& j, CThostFtdcReqCancelAccountField& p);

void to_json(json& j, const CThostFtdcReqChangeAccountField& p);
void from_json(const json& j, CThostFtdcReqChangeAccountField& p);

void to_json(json& j, const CThostFtdcReqTransferField& p);
void from_json(const json& j, CThostFtdcReqTransferField& p);

void to_json(json& j, const CThostFtdcRspTransferField& p);
void from_json(const json& j, CThostFtdcRspTransferField& p);

void to_json(json& j, const CThostFtdcReqRepealField& p);
void from_json(const json& j, CThostFtdcReqRepealField& p);

void to_json(json& j, const CThostFtdcRspRepealField& p);
void from_json(const json& j, CThostFtdcRspRepealField& p);

void to_json(json& j, const CThostFtdcReqQueryAccountField& p);
void from_json(const json& j, CThostFtdcReqQueryAccountField& p);

void to_json(json& j, const CThostFtdcRspQueryAccountField& p);
void from_json(const json& j, CThostFtdcRspQueryAccountField& p);

void to_json(json& j, const CThostFtdcFutureSignIOField& p);
void from_json(const json& j, CThostFtdcFutureSignIOField& p);

void to_json(json& j, const CThostFtdcRspFutureSignInField& p);
void from_json(const json& j, CThostFtdcRspFutureSignInField& p);

void to_json(json& j, const CThostFtdcReqFutureSignOutField& p);
void from_json(const json& j, CThostFtdcReqFutureSignOutField& p);

void to_json(json& j, const CThostFtdcRspFutureSignOutField& p);
void from_json(const json& j, CThostFtdcRspFutureSignOutField& p);

void to_json(json& j, const CThostFtdcReqQueryTradeResultBySerialField& p);
void from_json(const json& j, CThostFtdcReqQueryTradeResultBySerialField& p);

void to_json(json& j, const CThostFtdcRspQueryTradeResultBySerialField& p);
void from_json(const json& j, CThostFtdcRspQueryTradeResultBySerialField& p);

void to_json(json& j, const CThostFtdcReqDayEndFileReadyField& p);
void from_json(const json& j, CThostFtdcReqDayEndFileReadyField& p);

void to_json(json& j, const CThostFtdcReturnResultField& p);
void from_json(const json& j, CThostFtdcReturnResultField& p);

void to_json(json& j, const CThostFtdcVerifyFuturePasswordField& p);
void from_json(const json& j, CThostFtdcVerifyFuturePasswordField& p);

void to_json(json& j, const CThostFtdcVerifyCustInfoField& p);
void from_json(const json& j, CThostFtdcVerifyCustInfoField& p);

void to_json(json& j, const CThostFtdcVerifyFuturePasswordAndCustInfoField& p);
void from_json(const json& j, CThostFtdcVerifyFuturePasswordAndCustInfoField& p);

void to_json(json& j, const CThostFtdcDepositResultInformField& p);
void from_json(const json& j, CThostFtdcDepositResultInformField& p);

void to_json(json& j, const CThostFtdcReqSyncKeyField& p);
void from_json(const json& j, CThostFtdcReqSyncKeyField& p);

void to_json(json& j, const CThostFtdcRspSyncKeyField& p);
void from_json(const json& j, CThostFtdcRspSyncKeyField& p);

void to_json(json& j, const CThostFtdcNotifyQueryAccountField& p);
void from_json(const json& j, CThostFtdcNotifyQueryAccountField& p);

void to_json(json& j, const CThostFtdcTransferSerialField& p);
void from_json(const json& j, CThostFtdcTransferSerialField& p);

void to_json(json& j, const CThostFtdcQryTransferSerialField& p);
void from_json(const json& j, CThostFtdcQryTransferSerialField& p);

void to_json(json& j, const CThostFtdcNotifyFutureSignInField& p);
void from_json(const json& j, CThostFtdcNotifyFutureSignInField& p);

void to_json(json& j, const CThostFtdcNotifyFutureSignOutField& p);
void from_json(const json& j, CThostFtdcNotifyFutureSignOutField& p);

void to_json(json& j, const CThostFtdcNotifySyncKeyField& p);
void from_json(const json& j, CThostFtdcNotifySyncKeyField& p);

void to_json(json& j, const CThostFtdcQryAccountregisterField& p);
void from_json(const json& j, CThostFtdcQryAccountregisterField& p);

void to_json(json& j, const CThostFtdcAccountregisterField& p);
void from_json(const json& j, CThostFtdcAccountregisterField& p);

void to_json(json& j, const CThostFtdcOpenAccountField& p);
void from_json(const json& j, CThostFtdcOpenAccountField& p);

void to_json(json& j, const CThostFtdcCancelAccountField& p);
void from_json(const json& j, CThostFtdcCancelAccountField& p);

void to_json(json& j, const CThostFtdcChangeAccountField& p);
void from_json(const json& j, CThostFtdcChangeAccountField& p);

void to_json(json& j, const CThostFtdcSecAgentACIDMapField& p);
void from_json(const json& j, CThostFtdcSecAgentACIDMapField& p);

void to_json(json& j, const CThostFtdcQrySecAgentACIDMapField& p);
void from_json(const json& j, CThostFtdcQrySecAgentACIDMapField& p);

void to_json(json& j, const CThostFtdcUserRightsAssignField& p);
void from_json(const json& j, CThostFtdcUserRightsAssignField& p);

void to_json(json& j, const CThostFtdcBrokerUserRightAssignField& p);
void from_json(const json& j, CThostFtdcBrokerUserRightAssignField& p);

void to_json(json& j, const CThostFtdcDRTransferField& p);
void from_json(const json& j, CThostFtdcDRTransferField& p);

void to_json(json& j, const CThostFtdcFensUserInfoField& p);
void from_json(const json& j, CThostFtdcFensUserInfoField& p);

void to_json(json& j, const CThostFtdcCurrTransferIdentityField& p);
void from_json(const json& j, CThostFtdcCurrTransferIdentityField& p);

void to_json(json& j, const CThostFtdcLoginForbiddenUserField& p);
void from_json(const json& j, CThostFtdcLoginForbiddenUserField& p);

void to_json(json& j, const CThostFtdcQryLoginForbiddenUserField& p);
void from_json(const json& j, CThostFtdcQryLoginForbiddenUserField& p);

void to_json(json& j, const CThostFtdcTradingAccountReserveField& p);
void from_json(const json& j, CThostFtdcTradingAccountReserveField& p);

void to_json(json& j, const CThostFtdcQryLoginForbiddenIPField& p);
void from_json(const json& j, CThostFtdcQryLoginForbiddenIPField& p);

void to_json(json& j, const CThostFtdcQryIPListField& p);
void from_json(const json& j, CThostFtdcQryIPListField& p);

void to_json(json& j, const CThostFtdcQryUserRightsAssignField& p);
void from_json(const json& j, CThostFtdcQryUserRightsAssignField& p);

void to_json(json& j, const CThostFtdcReserveOpenAccountConfirmField& p);
void from_json(const json& j, CThostFtdcReserveOpenAccountConfirmField& p);

void to_json(json& j, const CThostFtdcReserveOpenAccountField& p);
void from_json(const json& j, CThostFtdcReserveOpenAccountField& p);

void to_json(json& j, const CThostFtdcAccountPropertyField& p);
void from_json(const json& j, CThostFtdcAccountPropertyField& p);

void to_json(json& j, const CThostFtdcQryCurrDRIdentityField& p);
void from_json(const json& j, CThostFtdcQryCurrDRIdentityField& p);

void to_json(json& j, const CThostFtdcCurrDRIdentityField& p);
void from_json(const json& j, CThostFtdcCurrDRIdentityField& p);

void to_json(json& j, const CThostFtdcQrySecAgentCheckModeField& p);
void from_json(const json& j, CThostFtdcQrySecAgentCheckModeField& p);

void to_json(json& j, const CThostFtdcQrySecAgentTradeInfoField& p);
void from_json(const json& j, CThostFtdcQrySecAgentTradeInfoField& p);

void to_json(json& j, const CThostFtdcReqUserAuthMethodField& p);
void from_json(const json& j, CThostFtdcReqUserAuthMethodField& p);

void to_json(json& j, const CThostFtdcRspUserAuthMethodField& p);
void from_json(const json& j, CThostFtdcRspUserAuthMethodField& p);

void to_json(json& j, const CThostFtdcReqGenUserCaptchaField& p);
void from_json(const json& j, CThostFtdcReqGenUserCaptchaField& p);

void to_json(json& j, const CThostFtdcRspGenUserCaptchaField& p);
void from_json(const json& j, CThostFtdcRspGenUserCaptchaField& p);

void to_json(json& j, const CThostFtdcReqGenUserTextField& p);
void from_json(const json& j, CThostFtdcReqGenUserTextField& p);

void to_json(json& j, const CThostFtdcRspGenUserTextField& p);
void from_json(const json& j, CThostFtdcRspGenUserTextField& p);

void to_json(json& j, const CThostFtdcReqUserLoginWithCaptchaField& p);
void from_json(const json& j, CThostFtdcReqUserLoginWithCaptchaField& p);

void to_json(json& j, const CThostFtdcReqUserLoginWithTextField& p);
void from_json(const json& j, CThostFtdcReqUserLoginWithTextField& p);

void to_json(json& j, const CThostFtdcReqUserLoginWithOTPField& p);
void from_json(const json& j, CThostFtdcReqUserLoginWithOTPField& p);

void to_json(json& j, const CThostFtdcReqApiHandshakeField& p);
void from_json(const json& j, CThostFtdcReqApiHandshakeField& p);

void to_json(json& j, const CThostFtdcRspApiHandshakeField& p);
void from_json(const json& j, CThostFtdcRspApiHandshakeField& p);

void to_json(json& j, const CThostFtdcReqVerifyApiKeyField& p);
void from_json(const json& j, CThostFtdcReqVerifyApiKeyField& p);

void to_json(json& j, const CThostFtdcDepartmentUserField& p);
void from_json(const json& j, CThostFtdcDepartmentUserField& p);

void to_json(json& j, const CThostFtdcQueryFreqField& p);
void from_json(const json& j, CThostFtdcQueryFreqField& p);

void to_json(json& j, const CThostFtdcAuthForbiddenIPField& p);
void from_json(const json& j, CThostFtdcAuthForbiddenIPField& p);

void to_json(json& j, const CThostFtdcQryAuthForbiddenIPField& p);
void from_json(const json& j, CThostFtdcQryAuthForbiddenIPField& p);

void to_json(json& j, const CThostFtdcSyncDelaySwapFrozenField& p);
void from_json(const json& j, CThostFtdcSyncDelaySwapFrozenField& p);

void to_json(json& j, const CThostFtdcUserSystemInfoField& p);
void from_json(const json& j, CThostFtdcUserSystemInfoField& p);

void to_json(json& j, const CThostFtdcAuthUserIDField& p);
void from_json(const json& j, CThostFtdcAuthUserIDField& p);

void to_json(json& j, const CThostFtdcAuthIPField& p);
void from_json(const json& j, CThostFtdcAuthIPField& p);

void to_json(json& j, const CThostFtdcQryClassifiedInstrumentField& p);
void from_json(const json& j, CThostFtdcQryClassifiedInstrumentField& p);

void to_json(json& j, const CThostFtdcQryCombPromotionParamField& p);
void from_json(const json& j, CThostFtdcQryCombPromotionParamField& p);

void to_json(json& j, const CThostFtdcCombPromotionParamField& p);
void from_json(const json& j, CThostFtdcCombPromotionParamField& p);

void to_json(json& j, const CThostFtdcReqUserLoginSMField& p);
void from_json(const json& j, CThostFtdcReqUserLoginSMField& p);

void to_json(json& j, const CThostFtdcQryRiskSettleInvstPositionField& p);
void from_json(const json& j, CThostFtdcQryRiskSettleInvstPositionField& p);

void to_json(json& j, const CThostFtdcQryRiskSettleProductStatusField& p);
void from_json(const json& j, CThostFtdcQryRiskSettleProductStatusField& p);

void to_json(json& j, const CThostFtdcRiskSettleInvstPositionField& p);
void from_json(const json& j, CThostFtdcRiskSettleInvstPositionField& p);

void to_json(json& j, const CThostFtdcRiskSettleProductStatusField& p);
void from_json(const json& j, CThostFtdcRiskSettleProductStatusField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInfoField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInfoField& p);

void to_json(json& j, const CThostFtdcSyncDeltaProductStatusField& p);
void from_json(const json& j, CThostFtdcSyncDeltaProductStatusField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInvstPosDtlField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInvstPosDtlField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInvstPosCombDtlField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInvstPosCombDtlField& p);

void to_json(json& j, const CThostFtdcSyncDeltaTradingAccountField& p);
void from_json(const json& j, CThostFtdcSyncDeltaTradingAccountField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInitInvstMarginField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInitInvstMarginField& p);

void to_json(json& j, const CThostFtdcSyncDeltaDceCombInstrumentField& p);
void from_json(const json& j, CThostFtdcSyncDeltaDceCombInstrumentField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInvstMarginRateField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInvstMarginRateField& p);

void to_json(json& j, const CThostFtdcSyncDeltaExchMarginRateField& p);
void from_json(const json& j, CThostFtdcSyncDeltaExchMarginRateField& p);

void to_json(json& j, const CThostFtdcSyncDeltaOptExchMarginField& p);
void from_json(const json& j, CThostFtdcSyncDeltaOptExchMarginField& p);

void to_json(json& j, const CThostFtdcSyncDeltaOptInvstMarginField& p);
void from_json(const json& j, CThostFtdcSyncDeltaOptInvstMarginField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInvstMarginRateULField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInvstMarginRateULField& p);

void to_json(json& j, const CThostFtdcSyncDeltaOptInvstCommRateField& p);
void from_json(const json& j, CThostFtdcSyncDeltaOptInvstCommRateField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInvstCommRateField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInvstCommRateField& p);

void to_json(json& j, const CThostFtdcSyncDeltaProductExchRateField& p);
void from_json(const json& j, CThostFtdcSyncDeltaProductExchRateField& p);

void to_json(json& j, const CThostFtdcSyncDeltaDepthMarketDataField& p);
void from_json(const json& j, CThostFtdcSyncDeltaDepthMarketDataField& p);

void to_json(json& j, const CThostFtdcSyncDeltaIndexPriceField& p);
void from_json(const json& j, CThostFtdcSyncDeltaIndexPriceField& p);

void to_json(json& j, const CThostFtdcSyncDeltaEWarrantOffsetField& p);
void from_json(const json& j, CThostFtdcSyncDeltaEWarrantOffsetField& p);

void to_json(json& j, const CThostFtdcSPBMFutureParameterField& p);
void from_json(const json& j, CThostFtdcSPBMFutureParameterField& p);

void to_json(json& j, const CThostFtdcSPBMOptionParameterField& p);
void from_json(const json& j, CThostFtdcSPBMOptionParameterField& p);

void to_json(json& j, const CThostFtdcSPBMIntraParameterField& p);
void from_json(const json& j, CThostFtdcSPBMIntraParameterField& p);

void to_json(json& j, const CThostFtdcSPBMInterParameterField& p);
void from_json(const json& j, CThostFtdcSPBMInterParameterField& p);

void to_json(json& j, const CThostFtdcSyncSPBMParameterEndField& p);
void from_json(const json& j, CThostFtdcSyncSPBMParameterEndField& p);

void to_json(json& j, const CThostFtdcQrySPBMFutureParameterField& p);
void from_json(const json& j, CThostFtdcQrySPBMFutureParameterField& p);

void to_json(json& j, const CThostFtdcQrySPBMOptionParameterField& p);
void from_json(const json& j, CThostFtdcQrySPBMOptionParameterField& p);

void to_json(json& j, const CThostFtdcQrySPBMIntraParameterField& p);
void from_json(const json& j, CThostFtdcQrySPBMIntraParameterField& p);

void to_json(json& j, const CThostFtdcQrySPBMInterParameterField& p);
void from_json(const json& j, CThostFtdcQrySPBMInterParameterField& p);

void to_json(json& j, const CThostFtdcSPBMPortfDefinitionField& p);
void from_json(const json& j, CThostFtdcSPBMPortfDefinitionField& p);

void to_json(json& j, const CThostFtdcSPBMInvestorPortfDefField& p);
void from_json(const json& j, CThostFtdcSPBMInvestorPortfDefField& p);

void to_json(json& j, const CThostFtdcInvestorPortfMarginRatioField& p);
void from_json(const json& j, CThostFtdcInvestorPortfMarginRatioField& p);

void to_json(json& j, const CThostFtdcQrySPBMPortfDefinitionField& p);
void from_json(const json& j, CThostFtdcQrySPBMPortfDefinitionField& p);

void to_json(json& j, const CThostFtdcQrySPBMInvestorPortfDefField& p);
void from_json(const json& j, CThostFtdcQrySPBMInvestorPortfDefField& p);

void to_json(json& j, const CThostFtdcQryInvestorPortfMarginRatioField& p);
void from_json(const json& j, CThostFtdcQryInvestorPortfMarginRatioField& p);

void to_json(json& j, const CThostFtdcInvestorProdSPBMDetailField& p);
void from_json(const json& j, CThostFtdcInvestorProdSPBMDetailField& p);

void to_json(json& j, const CThostFtdcQryInvestorProdSPBMDetailField& p);
void from_json(const json& j, CThostFtdcQryInvestorProdSPBMDetailField& p);

void to_json(json& j, const CThostFtdcPortfTradeParamSettingField& p);
void from_json(const json& j, CThostFtdcPortfTradeParamSettingField& p);

void to_json(json& j, const CThostFtdcInvestorTradingRightField& p);
void from_json(const json& j, CThostFtdcInvestorTradingRightField& p);

void to_json(json& j, const CThostFtdcMortgageParamField& p);
void from_json(const json& j, CThostFtdcMortgageParamField& p);

void to_json(json& j, const CThostFtdcWithDrawParamField& p);
void from_json(const json& j, CThostFtdcWithDrawParamField& p);

void to_json(json& j, const CThostFtdcThostUserFunctionField& p);
void from_json(const json& j, CThostFtdcThostUserFunctionField& p);

void to_json(json& j, const CThostFtdcQryThostUserFunctionField& p);
void from_json(const json& j, CThostFtdcQryThostUserFunctionField& p);

void to_json(json& j, const CThostFtdcSPBMAddOnInterParameterField& p);
void from_json(const json& j, CThostFtdcSPBMAddOnInterParameterField& p);

void to_json(json& j, const CThostFtdcQrySPBMAddOnInterParameterField& p);
void from_json(const json& j, CThostFtdcQrySPBMAddOnInterParameterField& p);

void to_json(json& j, const CThostFtdcQryInvestorCommoditySPMMMarginField& p);
void from_json(const json& j, CThostFtdcQryInvestorCommoditySPMMMarginField& p);

void to_json(json& j, const CThostFtdcQryInvestorCommodityGroupSPMMMarginField& p);
void from_json(const json& j, CThostFtdcQryInvestorCommodityGroupSPMMMarginField& p);

void to_json(json& j, const CThostFtdcQrySPMMInstParamField& p);
void from_json(const json& j, CThostFtdcQrySPMMInstParamField& p);

void to_json(json& j, const CThostFtdcQrySPMMProductParamField& p);
void from_json(const json& j, CThostFtdcQrySPMMProductParamField& p);

void to_json(json& j, const CThostFtdcInvestorCommoditySPMMMarginField& p);
void from_json(const json& j, CThostFtdcInvestorCommoditySPMMMarginField& p);

void to_json(json& j, const CThostFtdcInvestorCommodityGroupSPMMMarginField& p);
void from_json(const json& j, CThostFtdcInvestorCommodityGroupSPMMMarginField& p);

void to_json(json& j, const CThostFtdcSPMMInstParamField& p);
void from_json(const json& j, CThostFtdcSPMMInstParamField& p);

void to_json(json& j, const CThostFtdcSPMMProductParamField& p);
void from_json(const json& j, CThostFtdcSPMMProductParamField& p);

void to_json(json& j, const CThostFtdcQryTraderAssignField& p);
void from_json(const json& j, CThostFtdcQryTraderAssignField& p);

void to_json(json& j, const CThostFtdcTraderAssignField& p);
void from_json(const json& j, CThostFtdcTraderAssignField& p);

void to_json(json& j, const CThostFtdcInvestorInfoCntSettingField& p);
void from_json(const json& j, CThostFtdcInvestorInfoCntSettingField& p);

void to_json(json& j, const CThostFtdcRCAMSCombProductInfoField& p);
void from_json(const json& j, CThostFtdcRCAMSCombProductInfoField& p);

void to_json(json& j, const CThostFtdcRCAMSInstrParameterField& p);
void from_json(const json& j, CThostFtdcRCAMSInstrParameterField& p);

void to_json(json& j, const CThostFtdcRCAMSIntraParameterField& p);
void from_json(const json& j, CThostFtdcRCAMSIntraParameterField& p);

void to_json(json& j, const CThostFtdcRCAMSInterParameterField& p);
void from_json(const json& j, CThostFtdcRCAMSInterParameterField& p);

void to_json(json& j, const CThostFtdcRCAMSShortOptAdjustParamField& p);
void from_json(const json& j, CThostFtdcRCAMSShortOptAdjustParamField& p);

void to_json(json& j, const CThostFtdcRCAMSInvestorCombPositionField& p);
void from_json(const json& j, CThostFtdcRCAMSInvestorCombPositionField& p);

void to_json(json& j, const CThostFtdcInvestorProdRCAMSMarginField& p);
void from_json(const json& j, CThostFtdcInvestorProdRCAMSMarginField& p);

void to_json(json& j, const CThostFtdcQryRCAMSCombProductInfoField& p);
void from_json(const json& j, CThostFtdcQryRCAMSCombProductInfoField& p);

void to_json(json& j, const CThostFtdcQryRCAMSInstrParameterField& p);
void from_json(const json& j, CThostFtdcQryRCAMSInstrParameterField& p);

void to_json(json& j, const CThostFtdcQryRCAMSIntraParameterField& p);
void from_json(const json& j, CThostFtdcQryRCAMSIntraParameterField& p);

void to_json(json& j, const CThostFtdcQryRCAMSInterParameterField& p);
void from_json(const json& j, CThostFtdcQryRCAMSInterParameterField& p);

void to_json(json& j, const CThostFtdcQryRCAMSShortOptAdjustParamField& p);
void from_json(const json& j, CThostFtdcQryRCAMSShortOptAdjustParamField& p);

void to_json(json& j, const CThostFtdcQryRCAMSInvestorCombPositionField& p);
void from_json(const json& j, CThostFtdcQryRCAMSInvestorCombPositionField& p);

void to_json(json& j, const CThostFtdcQryInvestorProdRCAMSMarginField& p);
void from_json(const json& j, CThostFtdcQryInvestorProdRCAMSMarginField& p);

void to_json(json& j, const CThostFtdcRULEInstrParameterField& p);
void from_json(const json& j, CThostFtdcRULEInstrParameterField& p);

void to_json(json& j, const CThostFtdcRULEIntraParameterField& p);
void from_json(const json& j, CThostFtdcRULEIntraParameterField& p);

void to_json(json& j, const CThostFtdcRULEInterParameterField& p);
void from_json(const json& j, CThostFtdcRULEInterParameterField& p);

void to_json(json& j, const CThostFtdcQryRULEInstrParameterField& p);
void from_json(const json& j, CThostFtdcQryRULEInstrParameterField& p);

void to_json(json& j, const CThostFtdcQryRULEIntraParameterField& p);
void from_json(const json& j, CThostFtdcQryRULEIntraParameterField& p);

void to_json(json& j, const CThostFtdcQryRULEInterParameterField& p);
void from_json(const json& j, CThostFtdcQryRULEInterParameterField& p);

void to_json(json& j, const CThostFtdcInvestorProdRULEMarginField& p);
void from_json(const json& j, CThostFtdcInvestorProdRULEMarginField& p);

void to_json(json& j, const CThostFtdcQryInvestorProdRULEMarginField& p);
void from_json(const json& j, CThostFtdcQryInvestorProdRULEMarginField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPBMPortfDefinitionField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPBMPortfDefinitionField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPBMInvstPortfDefField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPBMInvstPortfDefField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPBMFutureParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPBMFutureParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPBMOptionParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPBMOptionParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPBMIntraParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPBMIntraParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPBMInterParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPBMInterParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPBMAddOnInterParamField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPBMAddOnInterParamField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPMMInstParamField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPMMInstParamField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPMMProductParamField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPMMProductParamField& p);

void to_json(json& j, const CThostFtdcSyncDeltaInvestorSPMMModelField& p);
void from_json(const json& j, CThostFtdcSyncDeltaInvestorSPMMModelField& p);

void to_json(json& j, const CThostFtdcSyncDeltaSPMMModelParamField& p);
void from_json(const json& j, CThostFtdcSyncDeltaSPMMModelParamField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRCAMSCombProdInfoField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRCAMSCombProdInfoField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRCAMSInstrParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRCAMSInstrParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRCAMSIntraParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRCAMSIntraParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRCAMSInterParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRCAMSInterParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRCAMSSOptAdjParamField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRCAMSSOptAdjParamField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRCAMSCombRuleDtlField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRCAMSCombRuleDtlField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRCAMSInvstCombPosField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRCAMSInvstCombPosField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRULEInstrParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRULEInstrParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRULEIntraParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRULEIntraParameterField& p);

void to_json(json& j, const CThostFtdcSyncDeltaRULEInterParameterField& p);
void from_json(const json& j, CThostFtdcSyncDeltaRULEInterParameterField& p);

void to_json(json& j, const CThostFtdcIpAddrParamField& p);
void from_json(const json& j, CThostFtdcIpAddrParamField& p);

void to_json(json& j, const CThostFtdcQryIpAddrParamField& p);
void from_json(const json& j, CThostFtdcQryIpAddrParamField& p);

void to_json(json& j, const CThostFtdcTGIpAddrParamField& p);
void from_json(const json& j, CThostFtdcTGIpAddrParamField& p);

void to_json(json& j, const CThostFtdcQryTGIpAddrParamField& p);
void from_json(const json& j, CThostFtdcQryTGIpAddrParamField& p);

void to_json(json& j, const CThostFtdcTGSessionQryStatusField& p);
void from_json(const json& j, CThostFtdcTGSessionQryStatusField& p);

void to_json(json& j, const CThostFtdcLocalAddrConfigField& p);
void from_json(const json& j, CThostFtdcLocalAddrConfigField& p);

void to_json(json& j, const CThostFtdcQryLocalAddrConfigField& p);
void from_json(const json& j, CThostFtdcQryLocalAddrConfigField& p);

void to_json(json& j, const CThostFtdcReqQueryBankAccountBySecField& p);
void from_json(const json& j, CThostFtdcReqQueryBankAccountBySecField& p);

void to_json(json& j, const CThostFtdcRspQueryBankAccountBySecField& p);
void from_json(const json& j, CThostFtdcRspQueryBankAccountBySecField& p);

void to_json(json& j, const CThostFtdcReqTransferBySecField& p);
void from_json(const json& j, CThostFtdcReqTransferBySecField& p);

void to_json(json& j, const CThostFtdcRspTransferBySecField& p);
void from_json(const json& j, CThostFtdcRspTransferBySecField& p);

void to_json(json& j, const CThostFtdcNotifyQueryFutureAccountBySecField& p);
void from_json(const json& j, CThostFtdcNotifyQueryFutureAccountBySecField& p);

void to_json(json& j, const CThostFtdcExitEmergencyField& p);
void from_json(const json& j, CThostFtdcExitEmergencyField& p);

void to_json(json& j, const CThostFtdcInvestorPortfMarginModelField& p);
void from_json(const json& j, CThostFtdcInvestorPortfMarginModelField& p);

void to_json(json& j, const CThostFtdcInvestorPortfSettingField& p);
void from_json(const json& j, CThostFtdcInvestorPortfSettingField& p);

void to_json(json& j, const CThostFtdcQryInvestorPortfSettingField& p);
void from_json(const json& j, CThostFtdcQryInvestorPortfSettingField& p);

void to_json(json& j, const CThostFtdcUserPasswordUpdateFromSecField& p);
void from_json(const json& j, CThostFtdcUserPasswordUpdateFromSecField& p);

void to_json(json& j, const CThostFtdcSettlementInfoConfirmFromSecField& p);
void from_json(const json& j, CThostFtdcSettlementInfoConfirmFromSecField& p);

void to_json(json& j, const CThostFtdcTradingAccountPasswordUpdateFromSecField& p);
void from_json(const json& j, CThostFtdcTradingAccountPasswordUpdateFromSecField& p);

void to_json(json& j, const CThostFtdcRiskForbiddenRightField& p);
void from_json(const json& j, CThostFtdcRiskForbiddenRightField& p);

void to_json(json& j, const CThostFtdcInvestorInfoCommRecField& p);
void from_json(const json& j, CThostFtdcInvestorInfoCommRecField& p);

void to_json(json& j, const CThostFtdcQryInvestorInfoCommRecField& p);
void from_json(const json& j, CThostFtdcQryInvestorInfoCommRecField& p);

void to_json(json& j, const CThostFtdcCombLegField& p);
void from_json(const json& j, CThostFtdcCombLegField& p);

void to_json(json& j, const CThostFtdcQryCombLegField& p);
void from_json(const json& j, CThostFtdcQryCombLegField& p);

void to_json(json& j, const CThostFtdcInputOffsetSettingField& p);
void from_json(const json& j, CThostFtdcInputOffsetSettingField& p);

void to_json(json& j, const CThostFtdcOffsetSettingField& p);
void from_json(const json& j, CThostFtdcOffsetSettingField& p);

void to_json(json& j, const CThostFtdcCancelOffsetSettingField& p);
void from_json(const json& j, CThostFtdcCancelOffsetSettingField& p);

void to_json(json& j, const CThostFtdcQryOffsetSettingField& p);
void from_json(const json& j, CThostFtdcQryOffsetSettingField& p);

void to_json(json& j, const CThostFtdcAddrAppIDRelationField& p);
void from_json(const json& j, CThostFtdcAddrAppIDRelationField& p);

void to_json(json& j, const CThostFtdcQryAddrAppIDRelationField& p);
void from_json(const json& j, CThostFtdcQryAddrAppIDRelationField& p);

void to_json(json& j, const CThostFtdcFrontInfoField& p);
void from_json(const json& j, CThostFtdcFrontInfoField& p);

NLOHMANN_DEFINE_TYPE_NON_INTRUSIVE(Message, event, error_code, error_message, is_last);