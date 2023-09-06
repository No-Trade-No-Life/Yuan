// THIS FILE IS AUTO GENERATED
// DO NOT MODIFY MANUALLY

// TFtdcExchangePropertyType是一个交易所属性类型
export enum TThostFtdcExchangePropertyType {
  // 正常
  THOST_FTDC_EXP_Normal = '0',
  // 根据成交生成报单
  THOST_FTDC_EXP_GenOrderByTrade = '1',
}

// TFtdcIdCardTypeType是一个证件类型类型
export enum TThostFtdcIdCardTypeType {
  // 组织机构代码
  THOST_FTDC_ICT_EID = '0',
  // 中国公民身份证
  THOST_FTDC_ICT_IDCard = '1',
  // 军官证
  THOST_FTDC_ICT_OfficerIDCard = '2',
  // 警官证
  THOST_FTDC_ICT_PoliceIDCard = '3',
  // 士兵证
  THOST_FTDC_ICT_SoldierIDCard = '4',
  // 户口簿
  THOST_FTDC_ICT_HouseholdRegister = '5',
  // 护照
  THOST_FTDC_ICT_Passport = '6',
  // 台胞证
  THOST_FTDC_ICT_TaiwanCompatriotIDCard = '7',
  // 回乡证
  THOST_FTDC_ICT_HomeComingCard = '8',
  // 营业执照号
  THOST_FTDC_ICT_LicenseNo = '9',
  // 税务登记号
  THOST_FTDC_ICT_TaxNo = 'A',
  // 港澳居民来往内地通行证
  THOST_FTDC_ICT_HMMainlandTravelPermit = 'B',
  // 台湾居民来往大陆通行证
  THOST_FTDC_ICT_TwMainlandTravelPermit = 'C',
  // 驾照
  THOST_FTDC_ICT_DrivingLicense = 'D',
  // 当地社保ID
  THOST_FTDC_ICT_SocialID = 'F',
  // 当地身份证
  THOST_FTDC_ICT_LocalID = 'G',
  // 商业登记证
  THOST_FTDC_ICT_BusinessRegistration = 'H',
  // 港澳永久性居民身份证
  THOST_FTDC_ICT_HKMCIDCard = 'I',
  // 人行开户许可证
  THOST_FTDC_ICT_AccountsPermits = 'J',
  // 外国人永久居留证
  THOST_FTDC_ICT_FrgPrmtRdCard = 'K',
  // 资管产品备案函
  THOST_FTDC_ICT_CptMngPrdLetter = 'L',
  // 统一社会信用代码
  THOST_FTDC_ICT_UniformSocialCreditCode = 'N',
  // 机构成立证明文件
  THOST_FTDC_ICT_CorporationCertNo = 'O',
  // 其他证件
  THOST_FTDC_ICT_OtherCard = 'x',
}

// TFtdcInvestorRangeType是一个投资者范围类型
export enum TThostFtdcInvestorRangeType {
  // 所有
  THOST_FTDC_IR_All = '1',
  // 投资者组
  THOST_FTDC_IR_Group = '2',
  // 单一投资者
  THOST_FTDC_IR_Single = '3',
}

// TFtdcDepartmentRangeType是一个投资者范围类型
export enum TThostFtdcDepartmentRangeType {
  // 所有
  THOST_FTDC_DR_All = '1',
  // 组织架构
  THOST_FTDC_DR_Group = '2',
  // 单一投资者
  THOST_FTDC_DR_Single = '3',
}

// TFtdcDataSyncStatusType是一个数据同步状态类型
export enum TThostFtdcDataSyncStatusType {
  // 未同步
  THOST_FTDC_DS_Asynchronous = '1',
  // 同步中
  THOST_FTDC_DS_Synchronizing = '2',
  // 已同步
  THOST_FTDC_DS_Synchronized = '3',
}

// TFtdcBrokerDataSyncStatusType是一个经纪公司数据同步状态类型
export enum TThostFtdcBrokerDataSyncStatusType {
  // 已同步
  THOST_FTDC_BDS_Synchronized = '1',
  // 同步中
  THOST_FTDC_BDS_Synchronizing = '2',
}

// TFtdcExchangeConnectStatusType是一个交易所连接状态类型
export enum TThostFtdcExchangeConnectStatusType {
  // 没有任何连接
  THOST_FTDC_ECS_NoConnection = '1',
  // 已经发出合约查询请求
  THOST_FTDC_ECS_QryInstrumentSent = '2',
  // 已经获取信息
  THOST_FTDC_ECS_GotInformation = '9',
}

// TFtdcTraderConnectStatusType是一个交易所交易员连接状态类型
export enum TThostFtdcTraderConnectStatusType {
  // 没有任何连接
  THOST_FTDC_TCS_NotConnected = '1',
  // 已经连接
  THOST_FTDC_TCS_Connected = '2',
  // 已经发出合约查询请求
  THOST_FTDC_TCS_QryInstrumentSent = '3',
  // 订阅私有流
  THOST_FTDC_TCS_SubPrivateFlow = '4',
}

// TFtdcFunctionCodeType是一个功能代码类型
export enum TThostFtdcFunctionCodeType {
  // 数据异步化
  THOST_FTDC_FC_DataAsync = '1',
  // 强制用户登出
  THOST_FTDC_FC_ForceUserLogout = '2',
  // 变更管理用户口令
  THOST_FTDC_FC_UserPasswordUpdate = '3',
  // 变更经纪公司口令
  THOST_FTDC_FC_BrokerPasswordUpdate = '4',
  // 变更投资者口令
  THOST_FTDC_FC_InvestorPasswordUpdate = '5',
  // 报单插入
  THOST_FTDC_FC_OrderInsert = '6',
  // 报单操作
  THOST_FTDC_FC_OrderAction = '7',
  // 同步系统数据
  THOST_FTDC_FC_SyncSystemData = '8',
  // 同步经纪公司数据
  THOST_FTDC_FC_SyncBrokerData = '9',
  // 批量同步经纪公司数据
  THOST_FTDC_FC_BachSyncBrokerData = 'A',
  // 超级查询
  THOST_FTDC_FC_SuperQuery = 'B',
  // 预埋报单插入
  THOST_FTDC_FC_ParkedOrderInsert = 'C',
  // 预埋报单操作
  THOST_FTDC_FC_ParkedOrderAction = 'D',
  // 同步动态令牌
  THOST_FTDC_FC_SyncOTP = 'E',
  // 删除未知单
  THOST_FTDC_FC_DeleteOrder = 'F',
}

// TFtdcBrokerFunctionCodeType是一个经纪公司功能代码类型
export enum TThostFtdcBrokerFunctionCodeType {
  // 强制用户登出
  THOST_FTDC_BFC_ForceUserLogout = '1',
  // 变更用户口令
  THOST_FTDC_BFC_UserPasswordUpdate = '2',
  // 同步经纪公司数据
  THOST_FTDC_BFC_SyncBrokerData = '3',
  // 批量同步经纪公司数据
  THOST_FTDC_BFC_BachSyncBrokerData = '4',
  // 报单插入
  THOST_FTDC_BFC_OrderInsert = '5',
  // 报单操作
  THOST_FTDC_BFC_OrderAction = '6',
  // 全部查询
  THOST_FTDC_BFC_AllQuery = '7',
  // 系统功能：登入
  THOST_FTDC_BFC_log = 'a',
  // 基本查询：查询基础数据，如合约，交易所等常量
  THOST_FTDC_BFC_BaseQry = 'b',
  // 交易查询：如查成交，委托
  THOST_FTDC_BFC_TradeQry = 'c',
  // 交易功能：报单，撤单
  THOST_FTDC_BFC_Trade = 'd',
  // 银期转账
  THOST_FTDC_BFC_Virement = 'e',
  // 风险监控
  THOST_FTDC_BFC_Risk = 'f',
  // 查询
  THOST_FTDC_BFC_Session = 'g',
  // 风控通知控制
  THOST_FTDC_BFC_RiskNoticeCtl = 'h',
  // 风控通知发送
  THOST_FTDC_BFC_RiskNotice = 'i',
  // 察看经纪公司资金权限
  THOST_FTDC_BFC_BrokerDeposit = 'j',
  // 资金查询
  THOST_FTDC_BFC_QueryFund = 'k',
  // 报单查询
  THOST_FTDC_BFC_QueryOrder = 'l',
  // 成交查询
  THOST_FTDC_BFC_QueryTrade = 'm',
  // 持仓查询
  THOST_FTDC_BFC_QueryPosition = 'n',
  // 行情查询
  THOST_FTDC_BFC_QueryMarketData = 'o',
  // 用户事件查询
  THOST_FTDC_BFC_QueryUserEvent = 'p',
  // 风险通知查询
  THOST_FTDC_BFC_QueryRiskNotify = 'q',
  // 出入金查询
  THOST_FTDC_BFC_QueryFundChange = 'r',
  // 投资者信息查询
  THOST_FTDC_BFC_QueryInvestor = 's',
  // 交易编码查询
  THOST_FTDC_BFC_QueryTradingCode = 't',
  // 强平
  THOST_FTDC_BFC_ForceClose = 'u',
  // 压力测试
  THOST_FTDC_BFC_PressTest = 'v',
  // 权益反算
  THOST_FTDC_BFC_RemainCalc = 'w',
  // 净持仓保证金指标
  THOST_FTDC_BFC_NetPositionInd = 'x',
  // 风险预算
  THOST_FTDC_BFC_RiskPredict = 'y',
  // 数据导出
  THOST_FTDC_BFC_DataExport = 'z',
  // 风控指标设置
  THOST_FTDC_BFC_RiskTargetSetup = 'A',
  // 行情预警
  THOST_FTDC_BFC_MarketDataWarn = 'B',
  // 业务通知查询
  THOST_FTDC_BFC_QryBizNotice = 'C',
  // 业务通知模板设置
  THOST_FTDC_BFC_CfgBizNotice = 'D',
  // 同步动态令牌
  THOST_FTDC_BFC_SyncOTP = 'E',
  // 发送业务通知
  THOST_FTDC_BFC_SendBizNotice = 'F',
  // 风险级别标准设置
  THOST_FTDC_BFC_CfgRiskLevelStd = 'G',
  // 交易终端应急功能
  THOST_FTDC_BFC_TbCommand = 'H',
  // 删除未知单
  THOST_FTDC_BFC_DeleteOrder = 'J',
  // 预埋报单插入
  THOST_FTDC_BFC_ParkedOrderInsert = 'K',
  // 预埋报单操作
  THOST_FTDC_BFC_ParkedOrderAction = 'L',
  // 资金不够仍允许行权
  THOST_FTDC_BFC_ExecOrderNoCheck = 'M',
  // 指定
  THOST_FTDC_BFC_Designate = 'N',
  // 证券处置
  THOST_FTDC_BFC_StockDisposal = 'O',
  // 席位资金预警
  THOST_FTDC_BFC_BrokerDepositWarn = 'Q',
  // 备兑不足预警
  THOST_FTDC_BFC_CoverWarn = 'S',
  // 行权试算
  THOST_FTDC_BFC_PreExecOrder = 'T',
  // 行权交收风险
  THOST_FTDC_BFC_ExecOrderRisk = 'P',
  // 持仓限额预警
  THOST_FTDC_BFC_PosiLimitWarn = 'U',
  // 持仓限额查询
  THOST_FTDC_BFC_QryPosiLimit = 'V',
  // 银期签到签退
  THOST_FTDC_BFC_FBSign = 'W',
  // 银期签约解约
  THOST_FTDC_BFC_FBAccount = 'X',
}

// TFtdcOrderActionStatusType是一个报单操作状态类型
export enum TThostFtdcOrderActionStatusType {
  // 已经提交
  THOST_FTDC_OAS_Submitted = 'a',
  // 已经接受
  THOST_FTDC_OAS_Accepted = 'b',
  // 已经被拒绝
  THOST_FTDC_OAS_Rejected = 'c',
}

// TFtdcOrderStatusType是一个报单状态类型
export enum TThostFtdcOrderStatusType {
  // 全部成交
  THOST_FTDC_OST_AllTraded = '0',
  // 部分成交还在队列中
  THOST_FTDC_OST_PartTradedQueueing = '1',
  // 部分成交不在队列中
  THOST_FTDC_OST_PartTradedNotQueueing = '2',
  // 未成交还在队列中
  THOST_FTDC_OST_NoTradeQueueing = '3',
  // 未成交不在队列中
  THOST_FTDC_OST_NoTradeNotQueueing = '4',
  // 撤单
  THOST_FTDC_OST_Canceled = '5',
  // 未知
  THOST_FTDC_OST_Unknown = 'a',
  // 尚未触发
  THOST_FTDC_OST_NotTouched = 'b',
  // 已触发
  THOST_FTDC_OST_Touched = 'c',
}

// TFtdcOrderSubmitStatusType是一个报单提交状态类型
export enum TThostFtdcOrderSubmitStatusType {
  // 已经提交
  THOST_FTDC_OSS_InsertSubmitted = '0',
  // 撤单已经提交
  THOST_FTDC_OSS_CancelSubmitted = '1',
  // 修改已经提交
  THOST_FTDC_OSS_ModifySubmitted = '2',
  // 已经接受
  THOST_FTDC_OSS_Accepted = '3',
  // 报单已经被拒绝
  THOST_FTDC_OSS_InsertRejected = '4',
  // 撤单已经被拒绝
  THOST_FTDC_OSS_CancelRejected = '5',
  // 改单已经被拒绝
  THOST_FTDC_OSS_ModifyRejected = '6',
}

// TFtdcPositionDateType是一个持仓日期类型
export enum TThostFtdcPositionDateType {
  // 今日持仓
  THOST_FTDC_PSD_Today = '1',
  // 历史持仓
  THOST_FTDC_PSD_History = '2',
}

// TFtdcPositionDateTypeType是一个持仓日期类型类型
export enum TThostFtdcPositionDateTypeType {
  // 使用历史持仓
  THOST_FTDC_PDT_UseHistory = '1',
  // 不使用历史持仓
  THOST_FTDC_PDT_NoUseHistory = '2',
}

// TFtdcTradingRoleType是一个交易角色类型
export enum TThostFtdcTradingRoleType {
  // 代理
  THOST_FTDC_ER_Broker = '1',
  // 自营
  THOST_FTDC_ER_Host = '2',
  // 做市商
  THOST_FTDC_ER_Maker = '3',
}

// TFtdcProductClassType是一个产品类型类型
export enum TThostFtdcProductClassType {
  // 期货
  THOST_FTDC_PC_Futures = '1',
  // 期货期权
  THOST_FTDC_PC_Options = '2',
  // 组合
  THOST_FTDC_PC_Combination = '3',
  // 即期
  THOST_FTDC_PC_Spot = '4',
  // 期转现
  THOST_FTDC_PC_EFP = '5',
  // 现货期权
  THOST_FTDC_PC_SpotOption = '6',
  // TAS合约
  THOST_FTDC_PC_TAS = '7',
  // 金属指数
  THOST_FTDC_PC_MI = 'I',
}

// TFtdcAPIProductClassType是一个产品类型类型
export enum TThostFtdcAPIProductClassType {
  // 期货单一合约
  THOST_FTDC_APC_FutureSingle = '1',
  // 期权单一合约
  THOST_FTDC_APC_OptionSingle = '2',
  // 可交易期货(含期货组合和期货单一合约)
  THOST_FTDC_APC_Futures = '3',
  // 可交易期权(含期权组合和期权单一合约)
  THOST_FTDC_APC_Options = '4',
  // 可下单组合（目前包含DCE和ZCE的期货组合）
  THOST_FTDC_APC_TradingComb = '5',
  // 可申请的组合（dce可以申请的组合合约 包含dce可以交易的合约）
  THOST_FTDC_APC_UnTradingComb = '6',
  // 所有可以交易合约
  THOST_FTDC_APC_AllTrading = '7',
  // 所有合约（包含不能交易合约 慎用）
  THOST_FTDC_APC_All = '8',
}

// TFtdcInstLifePhaseType是一个合约生命周期状态类型
export enum TThostFtdcInstLifePhaseType {
  // 未上市
  THOST_FTDC_IP_NotStart = '0',
  // 上市
  THOST_FTDC_IP_Started = '1',
  // 停牌
  THOST_FTDC_IP_Pause = '2',
  // 到期
  THOST_FTDC_IP_Expired = '3',
}

// TFtdcDirectionType是一个买卖方向类型
export enum TThostFtdcDirectionType {
  // 买
  THOST_FTDC_D_Buy = '0',
  // 卖
  THOST_FTDC_D_Sell = '1',
}

// TFtdcPositionTypeType是一个持仓类型类型
export enum TThostFtdcPositionTypeType {
  // 净持仓
  THOST_FTDC_PT_Net = '1',
  // 综合持仓
  THOST_FTDC_PT_Gross = '2',
}

// TFtdcPosiDirectionType是一个持仓多空方向类型
export enum TThostFtdcPosiDirectionType {
  // 净
  THOST_FTDC_PD_Net = '1',
  // 多头
  THOST_FTDC_PD_Long = '2',
  // 空头
  THOST_FTDC_PD_Short = '3',
}

// TFtdcSysSettlementStatusType是一个系统结算状态类型
export enum TThostFtdcSysSettlementStatusType {
  // 不活跃
  THOST_FTDC_SS_NonActive = '1',
  // 启动
  THOST_FTDC_SS_Startup = '2',
  // 操作
  THOST_FTDC_SS_Operating = '3',
  // 结算
  THOST_FTDC_SS_Settlement = '4',
  // 结算完成
  THOST_FTDC_SS_SettlementFinished = '5',
}

// TFtdcRatioAttrType是一个费率属性类型
export enum TThostFtdcRatioAttrType {
  // 交易费率
  THOST_FTDC_RA_Trade = '0',
  // 结算费率
  THOST_FTDC_RA_Settlement = '1',
}

// TFtdcHedgeFlagType是一个投机套保标志类型
export enum TThostFtdcHedgeFlagType {
  // 投机
  THOST_FTDC_HF_Speculation = '1',
  // 套利
  THOST_FTDC_HF_Arbitrage = '2',
  // 套保
  THOST_FTDC_HF_Hedge = '3',
  // 做市商
  THOST_FTDC_HF_MarketMaker = '5',
  // 第一腿投机第二腿套保 大商所专用
  THOST_FTDC_HF_SpecHedge = '6',
  // 第一腿套保第二腿投机  大商所专用
  THOST_FTDC_HF_HedgeSpec = '7',
}

// TFtdcBillHedgeFlagType是一个投机套保标志类型
export enum TThostFtdcBillHedgeFlagType {
  // 投机
  THOST_FTDC_BHF_Speculation = '1',
  // 套利
  THOST_FTDC_BHF_Arbitrage = '2',
  // 套保
  THOST_FTDC_BHF_Hedge = '3',
}

// TFtdcClientIDTypeType是一个交易编码类型类型
export enum TThostFtdcClientIDTypeType {
  // 投机
  THOST_FTDC_CIDT_Speculation = '1',
  // 套利
  THOST_FTDC_CIDT_Arbitrage = '2',
  // 套保
  THOST_FTDC_CIDT_Hedge = '3',
  // 做市商
  THOST_FTDC_CIDT_MarketMaker = '5',
}

// TFtdcOrderPriceTypeType是一个报单价格条件类型
export enum TThostFtdcOrderPriceTypeType {
  // 任意价
  THOST_FTDC_OPT_AnyPrice = '1',
  // 限价
  THOST_FTDC_OPT_LimitPrice = '2',
  // 最优价
  THOST_FTDC_OPT_BestPrice = '3',
  // 最新价
  THOST_FTDC_OPT_LastPrice = '4',
  // 最新价浮动上浮1个ticks
  THOST_FTDC_OPT_LastPricePlusOneTicks = '5',
  // 最新价浮动上浮2个ticks
  THOST_FTDC_OPT_LastPricePlusTwoTicks = '6',
  // 最新价浮动上浮3个ticks
  THOST_FTDC_OPT_LastPricePlusThreeTicks = '7',
  // 卖一价
  THOST_FTDC_OPT_AskPrice1 = '8',
  // 卖一价浮动上浮1个ticks
  THOST_FTDC_OPT_AskPrice1PlusOneTicks = '9',
  // 卖一价浮动上浮2个ticks
  THOST_FTDC_OPT_AskPrice1PlusTwoTicks = 'A',
  // 卖一价浮动上浮3个ticks
  THOST_FTDC_OPT_AskPrice1PlusThreeTicks = 'B',
  // 买一价
  THOST_FTDC_OPT_BidPrice1 = 'C',
  // 买一价浮动上浮1个ticks
  THOST_FTDC_OPT_BidPrice1PlusOneTicks = 'D',
  // 买一价浮动上浮2个ticks
  THOST_FTDC_OPT_BidPrice1PlusTwoTicks = 'E',
  // 买一价浮动上浮3个ticks
  THOST_FTDC_OPT_BidPrice1PlusThreeTicks = 'F',
  // 五档价
  THOST_FTDC_OPT_FiveLevelPrice = 'G',
}

// TFtdcOffsetFlagType是一个开平标志类型
export enum TThostFtdcOffsetFlagType {
  // 开仓
  THOST_FTDC_OF_Open = '0',
  // 平仓
  THOST_FTDC_OF_Close = '1',
  // 强平
  THOST_FTDC_OF_ForceClose = '2',
  // 平今
  THOST_FTDC_OF_CloseToday = '3',
  // 平昨
  THOST_FTDC_OF_CloseYesterday = '4',
  // 强减
  THOST_FTDC_OF_ForceOff = '5',
  // 本地强平
  THOST_FTDC_OF_LocalForceClose = '6',
}

// TFtdcForceCloseReasonType是一个强平原因类型
export enum TThostFtdcForceCloseReasonType {
  // 非强平
  THOST_FTDC_FCC_NotForceClose = '0',
  // 资金不足
  THOST_FTDC_FCC_LackDeposit = '1',
  // 客户超仓
  THOST_FTDC_FCC_ClientOverPositionLimit = '2',
  // 会员超仓
  THOST_FTDC_FCC_MemberOverPositionLimit = '3',
  // 持仓非整数倍
  THOST_FTDC_FCC_NotMultiple = '4',
  // 违规
  THOST_FTDC_FCC_Violation = '5',
  // 其它
  THOST_FTDC_FCC_Other = '6',
  // 自然人临近交割
  THOST_FTDC_FCC_PersonDeliv = '7',
}

// TFtdcOrderTypeType是一个报单类型类型
export enum TThostFtdcOrderTypeType {
  // 正常
  THOST_FTDC_ORDT_Normal = '0',
  // 报价衍生
  THOST_FTDC_ORDT_DeriveFromQuote = '1',
  // 组合衍生
  THOST_FTDC_ORDT_DeriveFromCombination = '2',
  // 组合报单
  THOST_FTDC_ORDT_Combination = '3',
  // 条件单
  THOST_FTDC_ORDT_ConditionalOrder = '4',
  // 互换单
  THOST_FTDC_ORDT_Swap = '5',
  // 大宗交易成交衍生
  THOST_FTDC_ORDT_DeriveFromBlockTrade = '6',
  // 期转现成交衍生
  THOST_FTDC_ORDT_DeriveFromEFPTrade = '7',
}

// TFtdcTimeConditionType是一个有效期类型类型
export enum TThostFtdcTimeConditionType {
  // 立即完成，否则撤销
  THOST_FTDC_TC_IOC = '1',
  // 本节有效
  THOST_FTDC_TC_GFS = '2',
  // 当日有效
  THOST_FTDC_TC_GFD = '3',
  // 指定日期前有效
  THOST_FTDC_TC_GTD = '4',
  // 撤销前有效
  THOST_FTDC_TC_GTC = '5',
  // 集合竞价有效
  THOST_FTDC_TC_GFA = '6',
}

// TFtdcVolumeConditionType是一个成交量类型类型
export enum TThostFtdcVolumeConditionType {
  // 任何数量
  THOST_FTDC_VC_AV = '1',
  // 最小数量
  THOST_FTDC_VC_MV = '2',
  // 全部数量
  THOST_FTDC_VC_CV = '3',
}

// TFtdcContingentConditionType是一个触发条件类型
export enum TThostFtdcContingentConditionType {
  // 立即
  THOST_FTDC_CC_Immediately = '1',
  // 止损
  THOST_FTDC_CC_Touch = '2',
  // 止赢
  THOST_FTDC_CC_TouchProfit = '3',
  // 预埋单
  THOST_FTDC_CC_ParkedOrder = '4',
  // 最新价大于条件价
  THOST_FTDC_CC_LastPriceGreaterThanStopPrice = '5',
  // 最新价大于等于条件价
  THOST_FTDC_CC_LastPriceGreaterEqualStopPrice = '6',
  // 最新价小于条件价
  THOST_FTDC_CC_LastPriceLesserThanStopPrice = '7',
  // 最新价小于等于条件价
  THOST_FTDC_CC_LastPriceLesserEqualStopPrice = '8',
  // 卖一价大于条件价
  THOST_FTDC_CC_AskPriceGreaterThanStopPrice = '9',
  // 卖一价大于等于条件价
  THOST_FTDC_CC_AskPriceGreaterEqualStopPrice = 'A',
  // 卖一价小于条件价
  THOST_FTDC_CC_AskPriceLesserThanStopPrice = 'B',
  // 卖一价小于等于条件价
  THOST_FTDC_CC_AskPriceLesserEqualStopPrice = 'C',
  // 买一价大于条件价
  THOST_FTDC_CC_BidPriceGreaterThanStopPrice = 'D',
  // 买一价大于等于条件价
  THOST_FTDC_CC_BidPriceGreaterEqualStopPrice = 'E',
  // 买一价小于条件价
  THOST_FTDC_CC_BidPriceLesserThanStopPrice = 'F',
  // 买一价小于等于条件价
  THOST_FTDC_CC_BidPriceLesserEqualStopPrice = 'H',
}

// TFtdcActionFlagType是一个操作标志类型
export enum TThostFtdcActionFlagType {
  // 删除
  THOST_FTDC_AF_Delete = '0',
  // 修改
  THOST_FTDC_AF_Modify = '3',
}

// TFtdcTradingRightType是一个交易权限类型
export enum TThostFtdcTradingRightType {
  // 可以交易
  THOST_FTDC_TR_Allow = '0',
  // 只能平仓
  THOST_FTDC_TR_CloseOnly = '1',
  // 不能交易
  THOST_FTDC_TR_Forbidden = '2',
}

// TFtdcOrderSourceType是一个报单来源类型
export enum TThostFtdcOrderSourceType {
  // 来自参与者
  THOST_FTDC_OSRC_Participant = '0',
  // 来自管理员
  THOST_FTDC_OSRC_Administrator = '1',
}

// TFtdcTradeTypeType是一个成交类型类型
export enum TThostFtdcTradeTypeType {
  // 组合持仓拆分为单一持仓,初始化不应包含该类型的持仓
  THOST_FTDC_TRDT_SplitCombination = '#',
  // 普通成交
  THOST_FTDC_TRDT_Common = '0',
  // 期权执行
  THOST_FTDC_TRDT_OptionsExecution = '1',
  // OTC成交
  THOST_FTDC_TRDT_OTC = '2',
  // 期转现衍生成交
  THOST_FTDC_TRDT_EFPDerived = '3',
  // 组合衍生成交
  THOST_FTDC_TRDT_CombinationDerived = '4',
  // 大宗交易成交
  THOST_FTDC_TRDT_BlockTrade = '5',
}

// TFtdcSpecPosiTypeType是一个特殊持仓明细标识类型
export enum TThostFtdcSpecPosiTypeType {
  // 普通持仓明细
  THOST_FTDC_SPOST_Common = '#',
  // TAS合约成交产生的标的合约持仓明细
  THOST_FTDC_SPOST_Tas = '0',
}

// TFtdcPriceSourceType是一个成交价来源类型
export enum TThostFtdcPriceSourceType {
  // 前成交价
  THOST_FTDC_PSRC_LastPrice = '0',
  // 买委托价
  THOST_FTDC_PSRC_Buy = '1',
  // 卖委托价
  THOST_FTDC_PSRC_Sell = '2',
  // 场外成交价
  THOST_FTDC_PSRC_OTC = '3',
}

// TFtdcInstrumentStatusType是一个合约交易状态类型
export enum TThostFtdcInstrumentStatusType {
  // 开盘前
  THOST_FTDC_IS_BeforeTrading = '0',
  // 非交易
  THOST_FTDC_IS_NoTrading = '1',
  // 连续交易
  THOST_FTDC_IS_Continous = '2',
  // 集合竞价报单
  THOST_FTDC_IS_AuctionOrdering = '3',
  // 集合竞价价格平衡
  THOST_FTDC_IS_AuctionBalance = '4',
  // 集合竞价撮合
  THOST_FTDC_IS_AuctionMatch = '5',
  // 收盘
  THOST_FTDC_IS_Closed = '6',
}

// TFtdcInstStatusEnterReasonType是一个品种进入交易状态原因类型
export enum TThostFtdcInstStatusEnterReasonType {
  // 自动切换
  THOST_FTDC_IER_Automatic = '1',
  // 手动切换
  THOST_FTDC_IER_Manual = '2',
  // 熔断
  THOST_FTDC_IER_Fuse = '3',
}

// TFtdcBatchStatusType是一个处理状态类型
export enum TThostFtdcBatchStatusType {
  // 未上传
  THOST_FTDC_BS_NoUpload = '1',
  // 已上传
  THOST_FTDC_BS_Uploaded = '2',
  // 审核失败
  THOST_FTDC_BS_Failed = '3',
}

// TFtdcReturnStyleType是一个按品种返还方式类型
export enum TThostFtdcReturnStyleType {
  // 按所有品种
  THOST_FTDC_RS_All = '1',
  // 按品种
  THOST_FTDC_RS_ByProduct = '2',
}

// TFtdcReturnPatternType是一个返还模式类型
export enum TThostFtdcReturnPatternType {
  // 按成交手数
  THOST_FTDC_RP_ByVolume = '1',
  // 按留存手续费
  THOST_FTDC_RP_ByFeeOnHand = '2',
}

// TFtdcReturnLevelType是一个返还级别类型
export enum TThostFtdcReturnLevelType {
  // 级别1
  THOST_FTDC_RL_Level1 = '1',
  // 级别2
  THOST_FTDC_RL_Level2 = '2',
  // 级别3
  THOST_FTDC_RL_Level3 = '3',
  // 级别4
  THOST_FTDC_RL_Level4 = '4',
  // 级别5
  THOST_FTDC_RL_Level5 = '5',
  // 级别6
  THOST_FTDC_RL_Level6 = '6',
  // 级别7
  THOST_FTDC_RL_Level7 = '7',
  // 级别8
  THOST_FTDC_RL_Level8 = '8',
  // 级别9
  THOST_FTDC_RL_Level9 = '9',
}

// TFtdcReturnStandardType是一个返还标准类型
export enum TThostFtdcReturnStandardType {
  // 分阶段返还
  THOST_FTDC_RSD_ByPeriod = '1',
  // 按某一标准
  THOST_FTDC_RSD_ByStandard = '2',
}

// TFtdcMortgageTypeType是一个质押类型类型
export enum TThostFtdcMortgageTypeType {
  // 质出
  THOST_FTDC_MT_Out = '0',
  // 质入
  THOST_FTDC_MT_In = '1',
}

// TFtdcInvestorSettlementParamIDType是一个投资者结算参数代码类型
export enum TThostFtdcInvestorSettlementParamIDType {
  // 质押比例
  THOST_FTDC_ISPI_MortgageRatio = '4',
  // 保证金算法
  THOST_FTDC_ISPI_MarginWay = '5',
  // 结算单结存是否包含质押
  THOST_FTDC_ISPI_BillDeposit = '9',
}

// TFtdcExchangeSettlementParamIDType是一个交易所结算参数代码类型
export enum TThostFtdcExchangeSettlementParamIDType {
  // 质押比例
  THOST_FTDC_ESPI_MortgageRatio = '1',
  // 分项资金导入项
  THOST_FTDC_ESPI_OtherFundItem = '2',
  // 分项资金入交易所出入金
  THOST_FTDC_ESPI_OtherFundImport = '3',
  // 中金所开户最低可用金额
  THOST_FTDC_ESPI_CFFEXMinPrepa = '6',
  // 郑商所结算方式
  THOST_FTDC_ESPI_CZCESettlementType = '7',
  // 交易所交割手续费收取方式
  THOST_FTDC_ESPI_ExchDelivFeeMode = '9',
  // 投资者交割手续费收取方式
  THOST_FTDC_ESPI_DelivFeeMode = '0',
  // 郑商所组合持仓保证金收取方式
  THOST_FTDC_ESPI_CZCEComMarginType = 'A',
  // 大商所套利保证金是否优惠
  THOST_FTDC_ESPI_DceComMarginType = 'B',
  // 虚值期权保证金优惠比率
  THOST_FTDC_ESPI_OptOutDisCountRate = 'a',
  // 最低保障系数
  THOST_FTDC_ESPI_OptMiniGuarantee = 'b',
}

// TFtdcSystemParamIDType是一个系统参数代码类型
export enum TThostFtdcSystemParamIDType {
  // 投资者代码最小长度
  THOST_FTDC_SPI_InvestorIDMinLength = '1',
  // 投资者帐号代码最小长度
  THOST_FTDC_SPI_AccountIDMinLength = '2',
  // 投资者开户默认登录权限
  THOST_FTDC_SPI_UserRightLogon = '3',
  // 投资者交易结算单成交汇总方式
  THOST_FTDC_SPI_SettlementBillTrade = '4',
  // 统一开户更新交易编码方式
  THOST_FTDC_SPI_TradingCode = '5',
  // 结算是否判断存在未复核的出入金和分项资金
  THOST_FTDC_SPI_CheckFund = '6',
  // 是否启用手续费模板数据权限
  THOST_FTDC_SPI_CommModelRight = '7',
  // 是否启用保证金率模板数据权限
  THOST_FTDC_SPI_MarginModelRight = '9',
  // 是否规范用户才能激活
  THOST_FTDC_SPI_IsStandardActive = '8',
  // 上传的交易所结算文件路径
  THOST_FTDC_SPI_UploadSettlementFile = 'U',
  // 上报保证金监控中心文件路径
  THOST_FTDC_SPI_DownloadCSRCFile = 'D',
  // 生成的结算单文件路径
  THOST_FTDC_SPI_SettlementBillFile = 'S',
  // 证监会文件标识
  THOST_FTDC_SPI_CSRCOthersFile = 'C',
  // 投资者照片路径
  THOST_FTDC_SPI_InvestorPhoto = 'P',
  // 全结经纪公司上传文件路径
  THOST_FTDC_SPI_CSRCData = 'R',
  // 开户密码录入方式
  THOST_FTDC_SPI_InvestorPwdModel = 'I',
  // 投资者中金所结算文件下载路径
  THOST_FTDC_SPI_CFFEXInvestorSettleFile = 'F',
  // 投资者代码编码方式
  THOST_FTDC_SPI_InvestorIDType = 'a',
  // 休眠户最高权益
  THOST_FTDC_SPI_FreezeMaxReMain = 'r',
  // 手续费相关操作实时上场开关
  THOST_FTDC_SPI_IsSync = 'A',
  // 解除开仓权限限制
  THOST_FTDC_SPI_RelieveOpenLimit = 'O',
  // 是否规范用户才能休眠
  THOST_FTDC_SPI_IsStandardFreeze = 'X',
  // 郑商所是否开放所有品种套保交易
  THOST_FTDC_SPI_CZCENormalProductHedge = 'B',
}

// TFtdcTradeParamIDType是一个交易系统参数代码类型
export enum TThostFtdcTradeParamIDType {
  // 系统加密算法
  THOST_FTDC_TPID_EncryptionStandard = 'E',
  // 系统风险算法
  THOST_FTDC_TPID_RiskMode = 'R',
  // 系统风险算法是否全局 0-否 1-是
  THOST_FTDC_TPID_RiskModeGlobal = 'G',
  // 密码加密算法
  THOST_FTDC_TPID_modeEncode = 'P',
  // 价格小数位数参数
  THOST_FTDC_TPID_tickMode = 'T',
  // 用户最大会话数
  THOST_FTDC_TPID_SingleUserSessionMaxNum = 'S',
  // 最大连续登录失败数
  THOST_FTDC_TPID_LoginFailMaxNum = 'L',
  // 是否强制认证
  THOST_FTDC_TPID_IsAuthForce = 'A',
  // 是否冻结证券持仓
  THOST_FTDC_TPID_IsPosiFreeze = 'F',
  // 是否限仓
  THOST_FTDC_TPID_IsPosiLimit = 'M',
  // 郑商所询价时间间隔
  THOST_FTDC_TPID_ForQuoteTimeInterval = 'Q',
  // 是否期货限仓
  THOST_FTDC_TPID_IsFuturePosiLimit = 'B',
  // 是否期货下单频率限制
  THOST_FTDC_TPID_IsFutureOrderFreq = 'C',
  // 行权冻结是否计算盈利
  THOST_FTDC_TPID_IsExecOrderProfit = 'H',
  // 银期开户是否验证开户银行卡号是否是预留银行账户
  THOST_FTDC_TPID_IsCheckBankAcc = 'I',
  // 弱密码最后修改日期
  THOST_FTDC_TPID_PasswordDeadLine = 'J',
  // 强密码校验
  THOST_FTDC_TPID_IsStrongPassword = 'K',
  // 自有资金质押比
  THOST_FTDC_TPID_BalanceMorgage = 'a',
  // 最小密码长度
  THOST_FTDC_TPID_MinPwdLen = 'O',
  // IP当日最大登陆失败次数
  THOST_FTDC_TPID_LoginFailMaxNumForIP = 'U',
  // 密码有效期
  THOST_FTDC_TPID_PasswordPeriod = 'V',
}

// TFtdcFileIDType是一个文件标识类型
export enum TThostFtdcFileIDType {
  // 资金数据
  THOST_FTDC_FI_SettlementFund = 'F',
  // 成交数据
  THOST_FTDC_FI_Trade = 'T',
  // 投资者持仓数据
  THOST_FTDC_FI_InvestorPosition = 'P',
  // 投资者分项资金数据
  THOST_FTDC_FI_SubEntryFund = 'O',
  // 组合持仓数据
  THOST_FTDC_FI_CZCECombinationPos = 'C',
  // 上报保证金监控中心数据
  THOST_FTDC_FI_CSRCData = 'R',
  // 郑商所平仓了结数据
  THOST_FTDC_FI_CZCEClose = 'L',
  // 郑商所非平仓了结数据
  THOST_FTDC_FI_CZCENoClose = 'N',
  // 持仓明细数据
  THOST_FTDC_FI_PositionDtl = 'D',
  // 期权执行文件
  THOST_FTDC_FI_OptionStrike = 'S',
  // 结算价比对文件
  THOST_FTDC_FI_SettlementPriceComparison = 'M',
  // 上期所非持仓变动明细
  THOST_FTDC_FI_NonTradePosChange = 'B',
}

// TFtdcFileTypeType是一个文件上传类型类型
export enum TThostFtdcFileTypeType {
  // 结算
  THOST_FTDC_FUT_Settlement = '0',
  // 核对
  THOST_FTDC_FUT_Check = '1',
}

// TFtdcFileFormatType是一个文件格式类型
export enum TThostFtdcFileFormatType {
  // 文本文件(.txt)
  THOST_FTDC_FFT_Txt = '0',
  // 压缩文件(.zip)
  THOST_FTDC_FFT_Zip = '1',
  // DBF文件(.dbf)
  THOST_FTDC_FFT_DBF = '2',
}

// TFtdcFileUploadStatusType是一个文件状态类型
export enum TThostFtdcFileUploadStatusType {
  // 上传成功
  THOST_FTDC_FUS_SucceedUpload = '1',
  // 上传失败
  THOST_FTDC_FUS_FailedUpload = '2',
  // 导入成功
  THOST_FTDC_FUS_SucceedLoad = '3',
  // 导入部分成功
  THOST_FTDC_FUS_PartSucceedLoad = '4',
  // 导入失败
  THOST_FTDC_FUS_FailedLoad = '5',
}

// TFtdcTransferDirectionType是一个移仓方向类型
export enum TThostFtdcTransferDirectionType {
  // 移出
  THOST_FTDC_TD_Out = '0',
  // 移入
  THOST_FTDC_TD_In = '1',
}

// TFtdcSpecialCreateRuleType是一个特殊的创建规则类型
export enum TThostFtdcSpecialCreateRuleType {
  // 没有特殊创建规则
  THOST_FTDC_SC_NoSpecialRule = '0',
  // 不包含春节
  THOST_FTDC_SC_NoSpringFestival = '1',
}

// TFtdcBasisPriceTypeType是一个挂牌基准价类型类型
export enum TThostFtdcBasisPriceTypeType {
  // 上一合约结算价
  THOST_FTDC_IPT_LastSettlement = '1',
  // 上一合约收盘价
  THOST_FTDC_IPT_LaseClose = '2',
}

// TFtdcProductLifePhaseType是一个产品生命周期状态类型
export enum TThostFtdcProductLifePhaseType {
  // 活跃
  THOST_FTDC_PLP_Active = '1',
  // 不活跃
  THOST_FTDC_PLP_NonActive = '2',
  // 注销
  THOST_FTDC_PLP_Canceled = '3',
}

// TFtdcDeliveryModeType是一个交割方式类型
export enum TThostFtdcDeliveryModeType {
  // 现金交割
  THOST_FTDC_DM_CashDeliv = '1',
  // 实物交割
  THOST_FTDC_DM_CommodityDeliv = '2',
}

// TFtdcFundIOTypeType是一个出入金类型类型
export enum TThostFtdcFundIOTypeType {
  // 出入金
  THOST_FTDC_FIOT_FundIO = '1',
  // 银期转帐
  THOST_FTDC_FIOT_Transfer = '2',
  // 银期换汇
  THOST_FTDC_FIOT_SwapCurrency = '3',
}

// TFtdcFundTypeType是一个资金类型类型
export enum TThostFtdcFundTypeType {
  // 银行存款
  THOST_FTDC_FT_Deposite = '1',
  // 分项资金
  THOST_FTDC_FT_ItemFund = '2',
  // 公司调整
  THOST_FTDC_FT_Company = '3',
  // 资金内转
  THOST_FTDC_FT_InnerTransfer = '4',
}

// TFtdcFundDirectionType是一个出入金方向类型
export enum TThostFtdcFundDirectionType {
  // 入金
  THOST_FTDC_FD_In = '1',
  // 出金
  THOST_FTDC_FD_Out = '2',
}

// TFtdcFundStatusType是一个资金状态类型
export enum TThostFtdcFundStatusType {
  // 已录入
  THOST_FTDC_FS_Record = '1',
  // 已复核
  THOST_FTDC_FS_Check = '2',
  // 已冲销
  THOST_FTDC_FS_Charge = '3',
}

// TFtdcPublishStatusType是一个发布状态类型
export enum TThostFtdcPublishStatusType {
  // 未发布
  THOST_FTDC_PS_None = '1',
  // 正在发布
  THOST_FTDC_PS_Publishing = '2',
  // 已发布
  THOST_FTDC_PS_Published = '3',
}

// TFtdcSystemStatusType是一个系统状态类型
export enum TThostFtdcSystemStatusType {
  // 不活跃
  THOST_FTDC_ES_NonActive = '1',
  // 启动
  THOST_FTDC_ES_Startup = '2',
  // 交易开始初始化
  THOST_FTDC_ES_Initialize = '3',
  // 交易完成初始化
  THOST_FTDC_ES_Initialized = '4',
  // 收市开始
  THOST_FTDC_ES_Close = '5',
  // 收市完成
  THOST_FTDC_ES_Closed = '6',
  // 结算
  THOST_FTDC_ES_Settlement = '7',
}

// TFtdcSettlementStatusType是一个结算状态类型
export enum TThostFtdcSettlementStatusType {
  // 初始
  THOST_FTDC_STS_Initialize = '0',
  // 结算中
  THOST_FTDC_STS_Settlementing = '1',
  // 已结算
  THOST_FTDC_STS_Settlemented = '2',
  // 结算完成
  THOST_FTDC_STS_Finished = '3',
}

// TFtdcInvestorTypeType是一个投资者类型类型
export enum TThostFtdcInvestorTypeType {
  // 自然人
  THOST_FTDC_CT_Person = '0',
  // 法人
  THOST_FTDC_CT_Company = '1',
  // 投资基金
  THOST_FTDC_CT_Fund = '2',
  // 特殊法人
  THOST_FTDC_CT_SpecialOrgan = '3',
  // 资管户
  THOST_FTDC_CT_Asset = '4',
}

// TFtdcBrokerTypeType是一个经纪公司类型类型
export enum TThostFtdcBrokerTypeType {
  // 交易会员
  THOST_FTDC_BT_Trade = '0',
  // 交易结算会员
  THOST_FTDC_BT_TradeSettle = '1',
}

// TFtdcRiskLevelType是一个风险等级类型
export enum TThostFtdcRiskLevelType {
  // 低风险客户
  THOST_FTDC_FAS_Low = '1',
  // 普通客户
  THOST_FTDC_FAS_Normal = '2',
  // 关注客户
  THOST_FTDC_FAS_Focus = '3',
  // 风险客户
  THOST_FTDC_FAS_Risk = '4',
}

// TFtdcFeeAcceptStyleType是一个手续费收取方式类型
export enum TThostFtdcFeeAcceptStyleType {
  // 按交易收取
  THOST_FTDC_FAS_ByTrade = '1',
  // 按交割收取
  THOST_FTDC_FAS_ByDeliv = '2',
  // 不收
  THOST_FTDC_FAS_None = '3',
  // 按指定手续费收取
  THOST_FTDC_FAS_FixFee = '4',
}

// TFtdcPasswordTypeType是一个密码类型类型
export enum TThostFtdcPasswordTypeType {
  // 交易密码
  THOST_FTDC_PWDT_Trade = '1',
  // 资金密码
  THOST_FTDC_PWDT_Account = '2',
}

// TFtdcAlgorithmType是一个盈亏算法类型
export enum TThostFtdcAlgorithmType {
  // 浮盈浮亏都计算
  THOST_FTDC_AG_All = '1',
  // 浮盈不计，浮亏计
  THOST_FTDC_AG_OnlyLost = '2',
  // 浮盈计，浮亏不计
  THOST_FTDC_AG_OnlyGain = '3',
  // 浮盈浮亏都不计算
  THOST_FTDC_AG_None = '4',
}

// TFtdcIncludeCloseProfitType是一个是否包含平仓盈利类型
export enum TThostFtdcIncludeCloseProfitType {
  // 包含平仓盈利
  THOST_FTDC_ICP_Include = '0',
  // 不包含平仓盈利
  THOST_FTDC_ICP_NotInclude = '2',
}

// TFtdcAllWithoutTradeType是一个是否受可提比例限制类型
export enum TThostFtdcAllWithoutTradeType {
  // 无仓无成交不受可提比例限制
  THOST_FTDC_AWT_Enable = '0',
  // 受可提比例限制
  THOST_FTDC_AWT_Disable = '2',
  // 无仓不受可提比例限制
  THOST_FTDC_AWT_NoHoldEnable = '3',
}

// TFtdcFuturePwdFlagType是一个资金密码核对标志类型
export enum TThostFtdcFuturePwdFlagType {
  // 不核对
  THOST_FTDC_FPWD_UnCheck = '0',
  // 核对
  THOST_FTDC_FPWD_Check = '1',
}

// TFtdcTransferTypeType是一个银期转账类型类型
export enum TThostFtdcTransferTypeType {
  // 银行转期货
  THOST_FTDC_TT_BankToFuture = '0',
  // 期货转银行
  THOST_FTDC_TT_FutureToBank = '1',
}

// TFtdcTransferValidFlagType是一个转账有效标志类型
export enum TThostFtdcTransferValidFlagType {
  // 无效或失败
  THOST_FTDC_TVF_Invalid = '0',
  // 有效
  THOST_FTDC_TVF_Valid = '1',
  // 冲正
  THOST_FTDC_TVF_Reverse = '2',
}

// TFtdcReasonType是一个事由类型
export enum TThostFtdcReasonType {
  // 错单
  THOST_FTDC_RN_CD = '0',
  // 资金在途
  THOST_FTDC_RN_ZT = '1',
  // 其它
  THOST_FTDC_RN_QT = '2',
}

// TFtdcSexType是一个性别类型
export enum TThostFtdcSexType {
  // 未知
  THOST_FTDC_SEX_None = '0',
  // 男
  THOST_FTDC_SEX_Man = '1',
  // 女
  THOST_FTDC_SEX_Woman = '2',
}

// TFtdcUserTypeType是一个用户类型类型
export enum TThostFtdcUserTypeType {
  // 投资者
  THOST_FTDC_UT_Investor = '0',
  // 操作员
  THOST_FTDC_UT_Operator = '1',
  // 管理员
  THOST_FTDC_UT_SuperUser = '2',
}

// TFtdcRateTypeType是一个费率类型类型
export enum TThostFtdcRateTypeType {
  // 保证金率
  THOST_FTDC_RATETYPE_MarginRate = '2',
}

// TFtdcNoteTypeType是一个通知类型类型
export enum TThostFtdcNoteTypeType {
  // 交易结算单
  THOST_FTDC_NOTETYPE_TradeSettleBill = '1',
  // 交易结算月报
  THOST_FTDC_NOTETYPE_TradeSettleMonth = '2',
  // 追加保证金通知书
  THOST_FTDC_NOTETYPE_CallMarginNotes = '3',
  // 强行平仓通知书
  THOST_FTDC_NOTETYPE_ForceCloseNotes = '4',
  // 成交通知书
  THOST_FTDC_NOTETYPE_TradeNotes = '5',
  // 交割通知书
  THOST_FTDC_NOTETYPE_DelivNotes = '6',
}

// TFtdcSettlementStyleType是一个结算单方式类型
export enum TThostFtdcSettlementStyleType {
  // 逐日盯市
  THOST_FTDC_SBS_Day = '1',
  // 逐笔对冲
  THOST_FTDC_SBS_Volume = '2',
}

// TFtdcSettlementBillTypeType是一个结算单类型类型
export enum TThostFtdcSettlementBillTypeType {
  // 日报
  THOST_FTDC_ST_Day = '0',
  // 月报
  THOST_FTDC_ST_Month = '1',
}

// TFtdcUserRightTypeType是一个客户权限类型类型
export enum TThostFtdcUserRightTypeType {
  // 登录
  THOST_FTDC_URT_Logon = '1',
  // 银期转帐
  THOST_FTDC_URT_Transfer = '2',
  // 邮寄结算单
  THOST_FTDC_URT_EMail = '3',
  // 传真结算单
  THOST_FTDC_URT_Fax = '4',
  // 条件单
  THOST_FTDC_URT_ConditionOrder = '5',
}

// TFtdcMarginPriceTypeType是一个保证金价格类型类型
export enum TThostFtdcMarginPriceTypeType {
  // 昨结算价
  THOST_FTDC_MPT_PreSettlementPrice = '1',
  // 最新价
  THOST_FTDC_MPT_SettlementPrice = '2',
  // 成交均价
  THOST_FTDC_MPT_AveragePrice = '3',
  // 开仓价
  THOST_FTDC_MPT_OpenPrice = '4',
}

// TFtdcBillGenStatusType是一个结算单生成状态类型
export enum TThostFtdcBillGenStatusType {
  // 未生成
  THOST_FTDC_BGS_None = '0',
  // 生成中
  THOST_FTDC_BGS_NoGenerated = '1',
  // 已生成
  THOST_FTDC_BGS_Generated = '2',
}

// TFtdcAlgoTypeType是一个算法类型类型
export enum TThostFtdcAlgoTypeType {
  // 持仓处理算法
  THOST_FTDC_AT_HandlePositionAlgo = '1',
  // 寻找保证金率算法
  THOST_FTDC_AT_FindMarginRateAlgo = '2',
}

// TFtdcHandlePositionAlgoIDType是一个持仓处理算法编号类型
export enum TThostFtdcHandlePositionAlgoIDType {
  // 基本
  THOST_FTDC_HPA_Base = '1',
  // 大连商品交易所
  THOST_FTDC_HPA_DCE = '2',
  // 郑州商品交易所
  THOST_FTDC_HPA_CZCE = '3',
}

// TFtdcFindMarginRateAlgoIDType是一个寻找保证金率算法编号类型
export enum TThostFtdcFindMarginRateAlgoIDType {
  // 基本
  THOST_FTDC_FMRA_Base = '1',
  // 大连商品交易所
  THOST_FTDC_FMRA_DCE = '2',
  // 郑州商品交易所
  THOST_FTDC_FMRA_CZCE = '3',
}

// TFtdcHandleTradingAccountAlgoIDType是一个资金处理算法编号类型
export enum TThostFtdcHandleTradingAccountAlgoIDType {
  // 基本
  THOST_FTDC_HTAA_Base = '1',
  // 大连商品交易所
  THOST_FTDC_HTAA_DCE = '2',
  // 郑州商品交易所
  THOST_FTDC_HTAA_CZCE = '3',
}

// TFtdcPersonTypeType是一个联系人类型类型
export enum TThostFtdcPersonTypeType {
  // 指定下单人
  THOST_FTDC_PST_Order = '1',
  // 开户授权人
  THOST_FTDC_PST_Open = '2',
  // 资金调拨人
  THOST_FTDC_PST_Fund = '3',
  // 结算单确认人
  THOST_FTDC_PST_Settlement = '4',
  // 法人
  THOST_FTDC_PST_Company = '5',
  // 法人代表
  THOST_FTDC_PST_Corporation = '6',
  // 投资者联系人
  THOST_FTDC_PST_LinkMan = '7',
  // 分户管理资产负责人
  THOST_FTDC_PST_Ledger = '8',
  // 托（保）管人
  THOST_FTDC_PST_Trustee = '9',
  // 托（保）管机构法人代表
  THOST_FTDC_PST_TrusteeCorporation = 'A',
  // 托（保）管机构开户授权人
  THOST_FTDC_PST_TrusteeOpen = 'B',
  // 托（保）管机构联系人
  THOST_FTDC_PST_TrusteeContact = 'C',
  // 境外自然人参考证件
  THOST_FTDC_PST_ForeignerRefer = 'D',
  // 法人代表参考证件
  THOST_FTDC_PST_CorporationRefer = 'E',
}

// TFtdcQueryInvestorRangeType是一个查询范围类型
export enum TThostFtdcQueryInvestorRangeType {
  // 所有
  THOST_FTDC_QIR_All = '1',
  // 查询分类
  THOST_FTDC_QIR_Group = '2',
  // 单一投资者
  THOST_FTDC_QIR_Single = '3',
}

// TFtdcInvestorRiskStatusType是一个投资者风险状态类型
export enum TThostFtdcInvestorRiskStatusType {
  // 正常
  THOST_FTDC_IRS_Normal = '1',
  // 警告
  THOST_FTDC_IRS_Warn = '2',
  // 追保
  THOST_FTDC_IRS_Call = '3',
  // 强平
  THOST_FTDC_IRS_Force = '4',
  // 异常
  THOST_FTDC_IRS_Exception = '5',
}

// TFtdcUserEventTypeType是一个用户事件类型类型
export enum TThostFtdcUserEventTypeType {
  // 登录
  THOST_FTDC_UET_Login = '1',
  // 登出
  THOST_FTDC_UET_Logout = '2',
  // 交易成功
  THOST_FTDC_UET_Trading = '3',
  // 交易失败
  THOST_FTDC_UET_TradingError = '4',
  // 修改密码
  THOST_FTDC_UET_UpdatePassword = '5',
  // 客户端认证
  THOST_FTDC_UET_Authenticate = '6',
  // 终端信息上报
  THOST_FTDC_UET_SubmitSysInfo = '7',
  // 转账
  THOST_FTDC_UET_Transfer = '8',
  // 其他
  THOST_FTDC_UET_Other = '9',
}

// TFtdcCloseStyleType是一个平仓方式类型
export enum TThostFtdcCloseStyleType {
  // 先开先平
  THOST_FTDC_ICS_Close = '0',
  // 先平今再平昨
  THOST_FTDC_ICS_CloseToday = '1',
}

// TFtdcStatModeType是一个统计方式类型
export enum TThostFtdcStatModeType {
  // ----
  THOST_FTDC_SM_Non = '0',
  // 按合约统计
  THOST_FTDC_SM_Instrument = '1',
  // 按产品统计
  THOST_FTDC_SM_Product = '2',
  // 按投资者统计
  THOST_FTDC_SM_Investor = '3',
}

// TFtdcParkedOrderStatusType是一个预埋单状态类型
export enum TThostFtdcParkedOrderStatusType {
  // 未发送
  THOST_FTDC_PAOS_NotSend = '1',
  // 已发送
  THOST_FTDC_PAOS_Send = '2',
  // 已删除
  THOST_FTDC_PAOS_Deleted = '3',
}

// TFtdcVirDealStatusType是一个处理状态类型
export enum TThostFtdcVirDealStatusType {
  // 正在处理
  THOST_FTDC_VDS_Dealing = '1',
  // 处理成功
  THOST_FTDC_VDS_DeaclSucceed = '2',
}

// TFtdcOrgSystemIDType是一个原有系统代码类型
export enum TThostFtdcOrgSystemIDType {
  // 综合交易平台
  THOST_FTDC_ORGS_Standard = '0',
  // 易盛系统
  THOST_FTDC_ORGS_ESunny = '1',
  // 金仕达V6系统
  THOST_FTDC_ORGS_KingStarV6 = '2',
}

// TFtdcVirTradeStatusType是一个交易状态类型
export enum TThostFtdcVirTradeStatusType {
  // 正常处理中
  THOST_FTDC_VTS_NaturalDeal = '0',
  // 成功结束
  THOST_FTDC_VTS_SucceedEnd = '1',
  // 失败结束
  THOST_FTDC_VTS_FailedEND = '2',
  // 异常中
  THOST_FTDC_VTS_Exception = '3',
  // 已人工异常处理
  THOST_FTDC_VTS_ManualDeal = '4',
  // 通讯异常 ，请人工处理
  THOST_FTDC_VTS_MesException = '5',
  // 系统出错，请人工处理
  THOST_FTDC_VTS_SysException = '6',
}

// TFtdcVirBankAccTypeType是一个银行帐户类型类型
export enum TThostFtdcVirBankAccTypeType {
  // 存折
  THOST_FTDC_VBAT_BankBook = '1',
  // 储蓄卡
  THOST_FTDC_VBAT_BankCard = '2',
  // 信用卡
  THOST_FTDC_VBAT_CreditCard = '3',
}

// TFtdcVirementStatusType是一个银行帐户类型类型
export enum TThostFtdcVirementStatusType {
  // 正常
  THOST_FTDC_VMS_Natural = '0',
  // 销户
  THOST_FTDC_VMS_Canceled = '9',
}

// TFtdcVirementAvailAbilityType是一个有效标志类型
export enum TThostFtdcVirementAvailAbilityType {
  // 未确认
  THOST_FTDC_VAA_NoAvailAbility = '0',
  // 有效
  THOST_FTDC_VAA_AvailAbility = '1',
  // 冲正
  THOST_FTDC_VAA_Repeal = '2',
}

// TFtdcVirementTradeCodeType是一个交易代码类型
export enum TThostFtdcVirementTradeCodeType {
  // 银行发起银行资金转期货
  THOST_FTDC_VTC_BankBankToFuture = '102001',
  // 银行发起期货资金转银行
  THOST_FTDC_VTC_BankFutureToBank = '102002',
  // 期货发起银行资金转期货
  THOST_FTDC_VTC_FutureBankToFuture = '202001',
  // 期货发起期货资金转银行
  THOST_FTDC_VTC_FutureFutureToBank = '202002',
}

// TFtdcAMLGenStatusType是一个Aml生成方式类型
export enum TThostFtdcAMLGenStatusType {
  // 程序生成
  THOST_FTDC_GEN_Program = '0',
  // 人工生成
  THOST_FTDC_GEN_HandWork = '1',
}

// TFtdcCFMMCKeyKindType是一个动态密钥类别(保证金监管)类型
export enum TThostFtdcCFMMCKeyKindType {
  // 主动请求更新
  THOST_FTDC_CFMMCKK_REQUEST = 'R',
  // CFMMC自动更新
  THOST_FTDC_CFMMCKK_AUTO = 'A',
  // CFMMC手动更新
  THOST_FTDC_CFMMCKK_MANUAL = 'M',
}

// TFtdcCertificationTypeType是一个证件类型类型
export enum TThostFtdcCertificationTypeType {
  // 身份证
  THOST_FTDC_CFT_IDCard = '0',
  // 护照
  THOST_FTDC_CFT_Passport = '1',
  // 军官证
  THOST_FTDC_CFT_OfficerIDCard = '2',
  // 士兵证
  THOST_FTDC_CFT_SoldierIDCard = '3',
  // 回乡证
  THOST_FTDC_CFT_HomeComingCard = '4',
  // 户口簿
  THOST_FTDC_CFT_HouseholdRegister = '5',
  // 营业执照号
  THOST_FTDC_CFT_LicenseNo = '6',
  // 组织机构代码证
  THOST_FTDC_CFT_InstitutionCodeCard = '7',
  // 临时营业执照号
  THOST_FTDC_CFT_TempLicenseNo = '8',
  // 民办非企业登记证书
  THOST_FTDC_CFT_NoEnterpriseLicenseNo = '9',
  // 其他证件
  THOST_FTDC_CFT_OtherCard = 'x',
  // 主管部门批文
  THOST_FTDC_CFT_SuperDepAgree = 'a',
}

// TFtdcFileBusinessCodeType是一个文件业务功能类型
export enum TThostFtdcFileBusinessCodeType {
  // 其他
  THOST_FTDC_FBC_Others = '0',
  // 转账交易明细对账
  THOST_FTDC_FBC_TransferDetails = '1',
  // 客户账户状态对账
  THOST_FTDC_FBC_CustAccStatus = '2',
  // 账户类交易明细对账
  THOST_FTDC_FBC_AccountTradeDetails = '3',
  // 期货账户信息变更明细对账
  THOST_FTDC_FBC_FutureAccountChangeInfoDetails = '4',
  // 客户资金台账余额明细对账
  THOST_FTDC_FBC_CustMoneyDetail = '5',
  // 客户销户结息明细对账
  THOST_FTDC_FBC_CustCancelAccountInfo = '6',
  // 客户资金余额对账结果
  THOST_FTDC_FBC_CustMoneyResult = '7',
  // 其它对账异常结果文件
  THOST_FTDC_FBC_OthersExceptionResult = '8',
  // 客户结息净额明细
  THOST_FTDC_FBC_CustInterestNetMoneyDetails = '9',
  // 客户资金交收明细
  THOST_FTDC_FBC_CustMoneySendAndReceiveDetails = 'a',
  // 法人存管银行资金交收汇总
  THOST_FTDC_FBC_CorporationMoneyTotal = 'b',
  // 主体间资金交收汇总
  THOST_FTDC_FBC_MainbodyMoneyTotal = 'c',
  // 总分平衡监管数据
  THOST_FTDC_FBC_MainPartMonitorData = 'd',
  // 存管银行备付金余额
  THOST_FTDC_FBC_PreparationMoney = 'e',
  // 协办存管银行资金监管数据
  THOST_FTDC_FBC_BankMoneyMonitorData = 'f',
}

// TFtdcCashExchangeCodeType是一个汇钞标志类型
export enum TThostFtdcCashExchangeCodeType {
  // 汇
  THOST_FTDC_CEC_Exchange = '1',
  // 钞
  THOST_FTDC_CEC_Cash = '2',
}

// TFtdcYesNoIndicatorType是一个是或否标识类型
export enum TThostFtdcYesNoIndicatorType {
  // 是
  THOST_FTDC_YNI_Yes = '0',
  // 否
  THOST_FTDC_YNI_No = '1',
}

// TFtdcBanlanceTypeType是一个余额类型类型
export enum TThostFtdcBanlanceTypeType {
  // 当前余额
  THOST_FTDC_BLT_CurrentMoney = '0',
  // 可用余额
  THOST_FTDC_BLT_UsableMoney = '1',
  // 可取余额
  THOST_FTDC_BLT_FetchableMoney = '2',
  // 冻结余额
  THOST_FTDC_BLT_FreezeMoney = '3',
}

// TFtdcGenderType是一个性别类型
export enum TThostFtdcGenderType {
  // 未知状态
  THOST_FTDC_GD_Unknown = '0',
  // 男
  THOST_FTDC_GD_Male = '1',
  // 女
  THOST_FTDC_GD_Female = '2',
}

// TFtdcFeePayFlagType是一个费用支付标志类型
export enum TThostFtdcFeePayFlagType {
  // 由受益方支付费用
  THOST_FTDC_FPF_BEN = '0',
  // 由发送方支付费用
  THOST_FTDC_FPF_OUR = '1',
  // 由发送方支付发起的费用，受益方支付接受的费用
  THOST_FTDC_FPF_SHA = '2',
}

// TFtdcPassWordKeyTypeType是一个密钥类型类型
export enum TThostFtdcPassWordKeyTypeType {
  // 交换密钥
  THOST_FTDC_PWKT_ExchangeKey = '0',
  // 密码密钥
  THOST_FTDC_PWKT_PassWordKey = '1',
  // MAC密钥
  THOST_FTDC_PWKT_MACKey = '2',
  // 报文密钥
  THOST_FTDC_PWKT_MessageKey = '3',
}

// TFtdcFBTPassWordTypeType是一个密码类型类型
export enum TThostFtdcFBTPassWordTypeType {
  // 查询
  THOST_FTDC_PWT_Query = '0',
  // 取款
  THOST_FTDC_PWT_Fetch = '1',
  // 转帐
  THOST_FTDC_PWT_Transfer = '2',
  // 交易
  THOST_FTDC_PWT_Trade = '3',
}

// TFtdcFBTEncryModeType是一个加密方式类型
export enum TThostFtdcFBTEncryModeType {
  // 不加密
  THOST_FTDC_EM_NoEncry = '0',
  // DES
  THOST_FTDC_EM_DES = '1',
  // 3DES
  THOST_FTDC_EM_3DES = '2',
}

// TFtdcBankRepealFlagType是一个银行冲正标志类型
export enum TThostFtdcBankRepealFlagType {
  // 银行无需自动冲正
  THOST_FTDC_BRF_BankNotNeedRepeal = '0',
  // 银行待自动冲正
  THOST_FTDC_BRF_BankWaitingRepeal = '1',
  // 银行已自动冲正
  THOST_FTDC_BRF_BankBeenRepealed = '2',
}

// TFtdcBrokerRepealFlagType是一个期商冲正标志类型
export enum TThostFtdcBrokerRepealFlagType {
  // 期商无需自动冲正
  THOST_FTDC_BRORF_BrokerNotNeedRepeal = '0',
  // 期商待自动冲正
  THOST_FTDC_BRORF_BrokerWaitingRepeal = '1',
  // 期商已自动冲正
  THOST_FTDC_BRORF_BrokerBeenRepealed = '2',
}

// TFtdcInstitutionTypeType是一个机构类别类型
export enum TThostFtdcInstitutionTypeType {
  // 银行
  THOST_FTDC_TS_Bank = '0',
  // 期商
  THOST_FTDC_TS_Future = '1',
  // 券商
  THOST_FTDC_TS_Store = '2',
}

// TFtdcLastFragmentType是一个最后分片标志类型
export enum TThostFtdcLastFragmentType {
  // 是最后分片
  THOST_FTDC_LF_Yes = '0',
  // 不是最后分片
  THOST_FTDC_LF_No = '1',
}

// TFtdcBankAccStatusType是一个银行账户状态类型
export enum TThostFtdcBankAccStatusType {
  // 正常
  THOST_FTDC_BAS_Normal = '0',
  // 冻结
  THOST_FTDC_BAS_Freeze = '1',
  // 挂失
  THOST_FTDC_BAS_ReportLoss = '2',
}

// TFtdcMoneyAccountStatusType是一个资金账户状态类型
export enum TThostFtdcMoneyAccountStatusType {
  // 正常
  THOST_FTDC_MAS_Normal = '0',
  // 销户
  THOST_FTDC_MAS_Cancel = '1',
}

// TFtdcManageStatusType是一个存管状态类型
export enum TThostFtdcManageStatusType {
  // 指定存管
  THOST_FTDC_MSS_Point = '0',
  // 预指定
  THOST_FTDC_MSS_PrePoint = '1',
  // 撤销指定
  THOST_FTDC_MSS_CancelPoint = '2',
}

// TFtdcSystemTypeType是一个应用系统类型类型
export enum TThostFtdcSystemTypeType {
  // 银期转帐
  THOST_FTDC_SYT_FutureBankTransfer = '0',
  // 银证转帐
  THOST_FTDC_SYT_StockBankTransfer = '1',
  // 第三方存管
  THOST_FTDC_SYT_TheThirdPartStore = '2',
}

// TFtdcTxnEndFlagType是一个银期转帐划转结果标志类型
export enum TThostFtdcTxnEndFlagType {
  // 正常处理中
  THOST_FTDC_TEF_NormalProcessing = '0',
  // 成功结束
  THOST_FTDC_TEF_Success = '1',
  // 失败结束
  THOST_FTDC_TEF_Failed = '2',
  // 异常中
  THOST_FTDC_TEF_Abnormal = '3',
  // 已人工异常处理
  THOST_FTDC_TEF_ManualProcessedForException = '4',
  // 通讯异常 ，请人工处理
  THOST_FTDC_TEF_CommuFailedNeedManualProcess = '5',
  // 系统出错，请人工处理
  THOST_FTDC_TEF_SysErrorNeedManualProcess = '6',
}

// TFtdcProcessStatusType是一个银期转帐服务处理状态类型
export enum TThostFtdcProcessStatusType {
  // 未处理
  THOST_FTDC_PSS_NotProcess = '0',
  // 开始处理
  THOST_FTDC_PSS_StartProcess = '1',
  // 处理完成
  THOST_FTDC_PSS_Finished = '2',
}

// TFtdcCustTypeType是一个客户类型类型
export enum TThostFtdcCustTypeType {
  // 自然人
  THOST_FTDC_CUSTT_Person = '0',
  // 机构户
  THOST_FTDC_CUSTT_Institution = '1',
}

// TFtdcFBTTransferDirectionType是一个银期转帐方向类型
export enum TThostFtdcFBTTransferDirectionType {
  // 入金，银行转期货
  THOST_FTDC_FBTTD_FromBankToFuture = '1',
  // 出金，期货转银行
  THOST_FTDC_FBTTD_FromFutureToBank = '2',
}

// TFtdcOpenOrDestroyType是一个开销户类别类型
export enum TThostFtdcOpenOrDestroyType {
  // 开户
  THOST_FTDC_OOD_Open = '1',
  // 销户
  THOST_FTDC_OOD_Destroy = '0',
}

// TFtdcAvailabilityFlagType是一个有效标志类型
export enum TThostFtdcAvailabilityFlagType {
  // 未确认
  THOST_FTDC_AVAF_Invalid = '0',
  // 有效
  THOST_FTDC_AVAF_Valid = '1',
  // 冲正
  THOST_FTDC_AVAF_Repeal = '2',
}

// TFtdcOrganTypeType是一个机构类型类型
export enum TThostFtdcOrganTypeType {
  // 银行代理
  THOST_FTDC_OT_Bank = '1',
  // 交易前置
  THOST_FTDC_OT_Future = '2',
  // 银期转帐平台管理
  THOST_FTDC_OT_PlateForm = '9',
}

// TFtdcOrganLevelType是一个机构级别类型
export enum TThostFtdcOrganLevelType {
  // 银行总行或期商总部
  THOST_FTDC_OL_HeadQuarters = '1',
  // 银行分中心或期货公司营业部
  THOST_FTDC_OL_Branch = '2',
}

// TFtdcProtocalIDType是一个协议类型类型
export enum TThostFtdcProtocalIDType {
  // 期商协议
  THOST_FTDC_PID_FutureProtocal = '0',
  // 工行协议
  THOST_FTDC_PID_ICBCProtocal = '1',
  // 农行协议
  THOST_FTDC_PID_ABCProtocal = '2',
  // 中国银行协议
  THOST_FTDC_PID_CBCProtocal = '3',
  // 建行协议
  THOST_FTDC_PID_CCBProtocal = '4',
  // 交行协议
  THOST_FTDC_PID_BOCOMProtocal = '5',
  // 银期转帐平台协议
  THOST_FTDC_PID_FBTPlateFormProtocal = 'X',
}

// TFtdcConnectModeType是一个套接字连接方式类型
export enum TThostFtdcConnectModeType {
  // 短连接
  THOST_FTDC_CM_ShortConnect = '0',
  // 长连接
  THOST_FTDC_CM_LongConnect = '1',
}

// TFtdcSyncModeType是一个套接字通信方式类型
export enum TThostFtdcSyncModeType {
  // 异步
  THOST_FTDC_SRM_ASync = '0',
  // 同步
  THOST_FTDC_SRM_Sync = '1',
}

// TFtdcBankAccTypeType是一个银行帐号类型类型
export enum TThostFtdcBankAccTypeType {
  // 银行存折
  THOST_FTDC_BAT_BankBook = '1',
  // 储蓄卡
  THOST_FTDC_BAT_SavingCard = '2',
  // 信用卡
  THOST_FTDC_BAT_CreditCard = '3',
}

// TFtdcFutureAccTypeType是一个期货公司帐号类型类型
export enum TThostFtdcFutureAccTypeType {
  // 银行存折
  THOST_FTDC_FAT_BankBook = '1',
  // 储蓄卡
  THOST_FTDC_FAT_SavingCard = '2',
  // 信用卡
  THOST_FTDC_FAT_CreditCard = '3',
}

// TFtdcOrganStatusType是一个接入机构状态类型
export enum TThostFtdcOrganStatusType {
  // 启用
  THOST_FTDC_OS_Ready = '0',
  // 签到
  THOST_FTDC_OS_CheckIn = '1',
  // 签退
  THOST_FTDC_OS_CheckOut = '2',
  // 对帐文件到达
  THOST_FTDC_OS_CheckFileArrived = '3',
  // 对帐
  THOST_FTDC_OS_CheckDetail = '4',
  // 日终清理
  THOST_FTDC_OS_DayEndClean = '5',
  // 注销
  THOST_FTDC_OS_Invalid = '9',
}

// TFtdcCCBFeeModeType是一个建行收费模式类型
export enum TThostFtdcCCBFeeModeType {
  // 按金额扣收
  THOST_FTDC_CCBFM_ByAmount = '1',
  // 按月扣收
  THOST_FTDC_CCBFM_ByMonth = '2',
}

// TFtdcCommApiTypeType是一个通讯API类型类型
export enum TThostFtdcCommApiTypeType {
  // 客户端
  THOST_FTDC_CAPIT_Client = '1',
  // 服务端
  THOST_FTDC_CAPIT_Server = '2',
  // 交易系统的UserApi
  THOST_FTDC_CAPIT_UserApi = '3',
}

// TFtdcLinkStatusType是一个连接状态类型
export enum TThostFtdcLinkStatusType {
  // 已经连接
  THOST_FTDC_LS_Connected = '1',
  // 没有连接
  THOST_FTDC_LS_Disconnected = '2',
}

// TFtdcPwdFlagType是一个密码核对标志类型
export enum TThostFtdcPwdFlagType {
  // 不核对
  THOST_FTDC_BPWDF_NoCheck = '0',
  // 明文核对
  THOST_FTDC_BPWDF_BlankCheck = '1',
  // 密文核对
  THOST_FTDC_BPWDF_EncryptCheck = '2',
}

// TFtdcSecuAccTypeType是一个期货帐号类型类型
export enum TThostFtdcSecuAccTypeType {
  // 资金帐号
  THOST_FTDC_SAT_AccountID = '1',
  // 资金卡号
  THOST_FTDC_SAT_CardID = '2',
  // 上海股东帐号
  THOST_FTDC_SAT_SHStockholderID = '3',
  // 深圳股东帐号
  THOST_FTDC_SAT_SZStockholderID = '4',
}

// TFtdcTransferStatusType是一个转账交易状态类型
export enum TThostFtdcTransferStatusType {
  // 正常
  THOST_FTDC_TRFS_Normal = '0',
  // 被冲正
  THOST_FTDC_TRFS_Repealed = '1',
}

// TFtdcSponsorTypeType是一个发起方类型
export enum TThostFtdcSponsorTypeType {
  // 期商
  THOST_FTDC_SPTYPE_Broker = '0',
  // 银行
  THOST_FTDC_SPTYPE_Bank = '1',
}

// TFtdcReqRspTypeType是一个请求响应类别类型
export enum TThostFtdcReqRspTypeType {
  // 请求
  THOST_FTDC_REQRSP_Request = '0',
  // 响应
  THOST_FTDC_REQRSP_Response = '1',
}

// TFtdcFBTUserEventTypeType是一个银期转帐用户事件类型类型
export enum TThostFtdcFBTUserEventTypeType {
  // 签到
  THOST_FTDC_FBTUET_SignIn = '0',
  // 银行转期货
  THOST_FTDC_FBTUET_FromBankToFuture = '1',
  // 期货转银行
  THOST_FTDC_FBTUET_FromFutureToBank = '2',
  // 开户
  THOST_FTDC_FBTUET_OpenAccount = '3',
  // 销户
  THOST_FTDC_FBTUET_CancelAccount = '4',
  // 变更银行账户
  THOST_FTDC_FBTUET_ChangeAccount = '5',
  // 冲正银行转期货
  THOST_FTDC_FBTUET_RepealFromBankToFuture = '6',
  // 冲正期货转银行
  THOST_FTDC_FBTUET_RepealFromFutureToBank = '7',
  // 查询银行账户
  THOST_FTDC_FBTUET_QueryBankAccount = '8',
  // 查询期货账户
  THOST_FTDC_FBTUET_QueryFutureAccount = '9',
  // 签退
  THOST_FTDC_FBTUET_SignOut = 'A',
  // 密钥同步
  THOST_FTDC_FBTUET_SyncKey = 'B',
  // 预约开户
  THOST_FTDC_FBTUET_ReserveOpenAccount = 'C',
  // 撤销预约开户
  THOST_FTDC_FBTUET_CancelReserveOpenAccount = 'D',
  // 预约开户确认
  THOST_FTDC_FBTUET_ReserveOpenAccountConfirm = 'E',
  // 其他
  THOST_FTDC_FBTUET_Other = 'Z',
}

// TFtdcDBOperationType是一个记录操作类型类型
export enum TThostFtdcDBOperationType {
  // 插入
  THOST_FTDC_DBOP_Insert = '0',
  // 更新
  THOST_FTDC_DBOP_Update = '1',
  // 删除
  THOST_FTDC_DBOP_Delete = '2',
}

// TFtdcSyncFlagType是一个同步标记类型
export enum TThostFtdcSyncFlagType {
  // 已同步
  THOST_FTDC_SYNF_Yes = '0',
  // 未同步
  THOST_FTDC_SYNF_No = '1',
}

// TFtdcSyncTypeType是一个同步类型类型
export enum TThostFtdcSyncTypeType {
  // 一次同步
  THOST_FTDC_SYNT_OneOffSync = '0',
  // 定时同步
  THOST_FTDC_SYNT_TimerSync = '1',
  // 定时完全同步
  THOST_FTDC_SYNT_TimerFullSync = '2',
}

// TFtdcExDirectionType是一个换汇方向类型
export enum TThostFtdcExDirectionType {
  // 结汇
  THOST_FTDC_FBEDIR_Settlement = '0',
  // 售汇
  THOST_FTDC_FBEDIR_Sale = '1',
}

// TFtdcFBEResultFlagType是一个换汇成功标志类型
export enum TThostFtdcFBEResultFlagType {
  // 成功
  THOST_FTDC_FBERES_Success = '0',
  // 账户余额不足
  THOST_FTDC_FBERES_InsufficientBalance = '1',
  // 交易结果未知
  THOST_FTDC_FBERES_UnknownTrading = '8',
  // 失败
  THOST_FTDC_FBERES_Fail = 'x',
}

// TFtdcFBEExchStatusType是一个换汇交易状态类型
export enum TThostFtdcFBEExchStatusType {
  // 正常
  THOST_FTDC_FBEES_Normal = '0',
  // 交易重发
  THOST_FTDC_FBEES_ReExchange = '1',
}

// TFtdcFBEFileFlagType是一个换汇文件标志类型
export enum TThostFtdcFBEFileFlagType {
  // 数据包
  THOST_FTDC_FBEFG_DataPackage = '0',
  // 文件
  THOST_FTDC_FBEFG_File = '1',
}

// TFtdcFBEAlreadyTradeType是一个换汇已交易标志类型
export enum TThostFtdcFBEAlreadyTradeType {
  // 未交易
  THOST_FTDC_FBEAT_NotTrade = '0',
  // 已交易
  THOST_FTDC_FBEAT_Trade = '1',
}

// TFtdcFBEUserEventTypeType是一个银期换汇用户事件类型类型
export enum TThostFtdcFBEUserEventTypeType {
  // 签到
  THOST_FTDC_FBEUET_SignIn = '0',
  // 换汇
  THOST_FTDC_FBEUET_Exchange = '1',
  // 换汇重发
  THOST_FTDC_FBEUET_ReExchange = '2',
  // 银行账户查询
  THOST_FTDC_FBEUET_QueryBankAccount = '3',
  // 换汇明细查询
  THOST_FTDC_FBEUET_QueryExchDetial = '4',
  // 换汇汇总查询
  THOST_FTDC_FBEUET_QueryExchSummary = '5',
  // 换汇汇率查询
  THOST_FTDC_FBEUET_QueryExchRate = '6',
  // 对账文件通知
  THOST_FTDC_FBEUET_CheckBankAccount = '7',
  // 签退
  THOST_FTDC_FBEUET_SignOut = '8',
  // 其他
  THOST_FTDC_FBEUET_Other = 'Z',
}

// TFtdcFBEReqFlagType是一个换汇发送标志类型
export enum TThostFtdcFBEReqFlagType {
  // 未处理
  THOST_FTDC_FBERF_UnProcessed = '0',
  // 等待发送
  THOST_FTDC_FBERF_WaitSend = '1',
  // 发送成功
  THOST_FTDC_FBERF_SendSuccess = '2',
  // 发送失败
  THOST_FTDC_FBERF_SendFailed = '3',
  // 等待重发
  THOST_FTDC_FBERF_WaitReSend = '4',
}

// TFtdcNotifyClassType是一个风险通知类型类型
export enum TThostFtdcNotifyClassType {
  // 正常
  THOST_FTDC_NC_NOERROR = '0',
  // 警示
  THOST_FTDC_NC_Warn = '1',
  // 追保
  THOST_FTDC_NC_Call = '2',
  // 强平
  THOST_FTDC_NC_Force = '3',
  // 穿仓
  THOST_FTDC_NC_CHUANCANG = '4',
  // 异常
  THOST_FTDC_NC_Exception = '5',
}

// TFtdcForceCloseTypeType是一个强平单类型类型
export enum TThostFtdcForceCloseTypeType {
  // 手工强平
  THOST_FTDC_FCT_Manual = '0',
  // 单一投资者辅助强平
  THOST_FTDC_FCT_Single = '1',
  // 批量投资者辅助强平
  THOST_FTDC_FCT_Group = '2',
}

// TFtdcRiskNotifyMethodType是一个风险通知途径类型
export enum TThostFtdcRiskNotifyMethodType {
  // 系统通知
  THOST_FTDC_RNM_System = '0',
  // 短信通知
  THOST_FTDC_RNM_SMS = '1',
  // 邮件通知
  THOST_FTDC_RNM_EMail = '2',
  // 人工通知
  THOST_FTDC_RNM_Manual = '3',
}

// TFtdcRiskNotifyStatusType是一个风险通知状态类型
export enum TThostFtdcRiskNotifyStatusType {
  // 未生成
  THOST_FTDC_RNS_NotGen = '0',
  // 已生成未发送
  THOST_FTDC_RNS_Generated = '1',
  // 发送失败
  THOST_FTDC_RNS_SendError = '2',
  // 已发送未接收
  THOST_FTDC_RNS_SendOk = '3',
  // 已接收未确认
  THOST_FTDC_RNS_Received = '4',
  // 已确认
  THOST_FTDC_RNS_Confirmed = '5',
}

// TFtdcRiskUserEventType是一个风控用户操作事件类型
export enum TThostFtdcRiskUserEventType {
  // 导出数据
  THOST_FTDC_RUE_ExportData = '0',
}

// TFtdcConditionalOrderSortTypeType是一个条件单索引条件类型
export enum TThostFtdcConditionalOrderSortTypeType {
  // 使用最新价升序
  THOST_FTDC_COST_LastPriceAsc = '0',
  // 使用最新价降序
  THOST_FTDC_COST_LastPriceDesc = '1',
  // 使用卖价升序
  THOST_FTDC_COST_AskPriceAsc = '2',
  // 使用卖价降序
  THOST_FTDC_COST_AskPriceDesc = '3',
  // 使用买价升序
  THOST_FTDC_COST_BidPriceAsc = '4',
  // 使用买价降序
  THOST_FTDC_COST_BidPriceDesc = '5',
}

// TFtdcSendTypeType是一个报送状态类型
export enum TThostFtdcSendTypeType {
  // 未发送
  THOST_FTDC_UOAST_NoSend = '0',
  // 已发送
  THOST_FTDC_UOAST_Sended = '1',
  // 已生成
  THOST_FTDC_UOAST_Generated = '2',
  // 报送失败
  THOST_FTDC_UOAST_SendFail = '3',
  // 接收成功
  THOST_FTDC_UOAST_Success = '4',
  // 接收失败
  THOST_FTDC_UOAST_Fail = '5',
  // 取消报送
  THOST_FTDC_UOAST_Cancel = '6',
}

// TFtdcClientIDStatusType是一个交易编码状态类型
export enum TThostFtdcClientIDStatusType {
  // 未申请
  THOST_FTDC_UOACS_NoApply = '1',
  // 已提交申请
  THOST_FTDC_UOACS_Submited = '2',
  // 已发送申请
  THOST_FTDC_UOACS_Sended = '3',
  // 完成
  THOST_FTDC_UOACS_Success = '4',
  // 拒绝
  THOST_FTDC_UOACS_Refuse = '5',
  // 已撤销编码
  THOST_FTDC_UOACS_Cancel = '6',
}

// TFtdcQuestionTypeType是一个特有信息类型类型
export enum TThostFtdcQuestionTypeType {
  // 单选
  THOST_FTDC_QT_Radio = '1',
  // 多选
  THOST_FTDC_QT_Option = '2',
  // 填空
  THOST_FTDC_QT_Blank = '3',
}

// TFtdcBusinessTypeType是一个业务类型类型
export enum TThostFtdcBusinessTypeType {
  // 请求
  THOST_FTDC_BT_Request = '1',
  // 应答
  THOST_FTDC_BT_Response = '2',
  // 通知
  THOST_FTDC_BT_Notice = '3',
}

// TFtdcCfmmcReturnCodeType是一个监控中心返回码类型
export enum TThostFtdcCfmmcReturnCodeType {
  // 成功
  THOST_FTDC_CRC_Success = '0',
  // 该客户已经有流程在处理中
  THOST_FTDC_CRC_Working = '1',
  // 监控中客户资料检查失败
  THOST_FTDC_CRC_InfoFail = '2',
  // 监控中实名制检查失败
  THOST_FTDC_CRC_IDCardFail = '3',
  // 其他错误
  THOST_FTDC_CRC_OtherFail = '4',
}

// TFtdcClientTypeType是一个客户类型类型
export enum TThostFtdcClientTypeType {
  // 所有
  THOST_FTDC_CfMMCCT_All = '0',
  // 个人
  THOST_FTDC_CfMMCCT_Person = '1',
  // 单位
  THOST_FTDC_CfMMCCT_Company = '2',
  // 其他
  THOST_FTDC_CfMMCCT_Other = '3',
  // 特殊法人
  THOST_FTDC_CfMMCCT_SpecialOrgan = '4',
  // 资管户
  THOST_FTDC_CfMMCCT_Asset = '5',
}

// TFtdcExchangeIDTypeType是一个交易所编号类型
export enum TThostFtdcExchangeIDTypeType {
  // 上海期货交易所
  THOST_FTDC_EIDT_SHFE = 'S',
  // 郑州商品交易所
  THOST_FTDC_EIDT_CZCE = 'Z',
  // 大连商品交易所
  THOST_FTDC_EIDT_DCE = 'D',
  // 中国金融期货交易所
  THOST_FTDC_EIDT_CFFEX = 'J',
  // 上海国际能源交易中心股份有限公司
  THOST_FTDC_EIDT_INE = 'N',
}

// TFtdcExClientIDTypeType是一个交易编码类型类型
export enum TThostFtdcExClientIDTypeType {
  // 套保
  THOST_FTDC_ECIDT_Hedge = '1',
  // 套利
  THOST_FTDC_ECIDT_Arbitrage = '2',
  // 投机
  THOST_FTDC_ECIDT_Speculation = '3',
}

// TFtdcUpdateFlagType是一个更新状态类型
export enum TThostFtdcUpdateFlagType {
  // 未更新
  THOST_FTDC_UF_NoUpdate = '0',
  // 更新全部信息成功
  THOST_FTDC_UF_Success = '1',
  // 更新全部信息失败
  THOST_FTDC_UF_Fail = '2',
  // 更新交易编码成功
  THOST_FTDC_UF_TCSuccess = '3',
  // 更新交易编码失败
  THOST_FTDC_UF_TCFail = '4',
  // 已丢弃
  THOST_FTDC_UF_Cancel = '5',
}

// TFtdcApplyOperateIDType是一个申请动作类型
export enum TThostFtdcApplyOperateIDType {
  // 开户
  THOST_FTDC_AOID_OpenInvestor = '1',
  // 修改身份信息
  THOST_FTDC_AOID_ModifyIDCard = '2',
  // 修改一般信息
  THOST_FTDC_AOID_ModifyNoIDCard = '3',
  // 申请交易编码
  THOST_FTDC_AOID_ApplyTradingCode = '4',
  // 撤销交易编码
  THOST_FTDC_AOID_CancelTradingCode = '5',
  // 销户
  THOST_FTDC_AOID_CancelInvestor = '6',
  // 账户休眠
  THOST_FTDC_AOID_FreezeAccount = '8',
  // 激活休眠账户
  THOST_FTDC_AOID_ActiveFreezeAccount = '9',
}

// TFtdcApplyStatusIDType是一个申请状态类型
export enum TThostFtdcApplyStatusIDType {
  // 未补全
  THOST_FTDC_ASID_NoComplete = '1',
  // 已提交
  THOST_FTDC_ASID_Submited = '2',
  // 已审核
  THOST_FTDC_ASID_Checked = '3',
  // 已拒绝
  THOST_FTDC_ASID_Refused = '4',
  // 已删除
  THOST_FTDC_ASID_Deleted = '5',
}

// TFtdcSendMethodType是一个发送方式类型
export enum TThostFtdcSendMethodType {
  // 文件发送
  THOST_FTDC_UOASM_ByAPI = '1',
  // 电子发送
  THOST_FTDC_UOASM_ByFile = '2',
}

// TFtdcEventModeType是一个操作方法类型
export enum TThostFtdcEventModeType {
  // 增加
  THOST_FTDC_EvM_ADD = '1',
  // 修改
  THOST_FTDC_EvM_UPDATE = '2',
  // 删除
  THOST_FTDC_EvM_DELETE = '3',
  // 复核
  THOST_FTDC_EvM_CHECK = '4',
  // 复制
  THOST_FTDC_EvM_COPY = '5',
  // 注销
  THOST_FTDC_EvM_CANCEL = '6',
  // 冲销
  THOST_FTDC_EvM_Reverse = '7',
}

// TFtdcUOAAutoSendType是一个统一开户申请自动发送类型
export enum TThostFtdcUOAAutoSendType {
  // 自动发送并接收
  THOST_FTDC_UOAA_ASR = '1',
  // 自动发送，不自动接收
  THOST_FTDC_UOAA_ASNR = '2',
  // 不自动发送，自动接收
  THOST_FTDC_UOAA_NSAR = '3',
  // 不自动发送，也不自动接收
  THOST_FTDC_UOAA_NSR = '4',
}

// TFtdcFlowIDType是一个流程ID类型
export enum TThostFtdcFlowIDType {
  // 投资者对应投资者组设置
  THOST_FTDC_EvM_InvestorGroupFlow = '1',
  // 投资者手续费率设置
  THOST_FTDC_EvM_InvestorRate = '2',
  // 投资者手续费率模板关系设置
  THOST_FTDC_EvM_InvestorCommRateModel = '3',
}

// TFtdcCheckLevelType是一个复核级别类型
export enum TThostFtdcCheckLevelType {
  // 零级复核
  THOST_FTDC_CL_Zero = '0',
  // 一级复核
  THOST_FTDC_CL_One = '1',
  // 二级复核
  THOST_FTDC_CL_Two = '2',
}

// TFtdcCheckStatusType是一个复核级别类型
export enum TThostFtdcCheckStatusType {
  // 未复核
  THOST_FTDC_CHS_Init = '0',
  // 复核中
  THOST_FTDC_CHS_Checking = '1',
  // 已复核
  THOST_FTDC_CHS_Checked = '2',
  // 拒绝
  THOST_FTDC_CHS_Refuse = '3',
  // 作废
  THOST_FTDC_CHS_Cancel = '4',
}

// TFtdcUsedStatusType是一个生效状态类型
export enum TThostFtdcUsedStatusType {
  // 未生效
  THOST_FTDC_CHU_Unused = '0',
  // 已生效
  THOST_FTDC_CHU_Used = '1',
  // 生效失败
  THOST_FTDC_CHU_Fail = '2',
}

// TFtdcBankAcountOriginType是一个账户来源类型
export enum TThostFtdcBankAcountOriginType {
  // 手工录入
  THOST_FTDC_BAO_ByAccProperty = '0',
  // 银期转账
  THOST_FTDC_BAO_ByFBTransfer = '1',
}

// TFtdcMonthBillTradeSumType是一个结算单月报成交汇总方式类型
export enum TThostFtdcMonthBillTradeSumType {
  // 同日同合约
  THOST_FTDC_MBTS_ByInstrument = '0',
  // 同日同合约同价格
  THOST_FTDC_MBTS_ByDayInsPrc = '1',
  // 同合约
  THOST_FTDC_MBTS_ByDayIns = '2',
}

// TFtdcFBTTradeCodeEnumType是一个银期交易代码枚举类型
export enum TThostFtdcFBTTradeCodeEnumType {
  // 银行发起银行转期货
  THOST_FTDC_FTC_BankLaunchBankToBroker = '102001',
  // 期货发起银行转期货
  THOST_FTDC_FTC_BrokerLaunchBankToBroker = '202001',
  // 银行发起期货转银行
  THOST_FTDC_FTC_BankLaunchBrokerToBank = '102002',
  // 期货发起期货转银行
  THOST_FTDC_FTC_BrokerLaunchBrokerToBank = '202002',
}

// TFtdcOTPTypeType是一个动态令牌类型类型
export enum TThostFtdcOTPTypeType {
  // 无动态令牌
  THOST_FTDC_OTP_NONE = '0',
  // 时间令牌
  THOST_FTDC_OTP_TOTP = '1',
}

// TFtdcOTPStatusType是一个动态令牌状态类型
export enum TThostFtdcOTPStatusType {
  // 未使用
  THOST_FTDC_OTPS_Unused = '0',
  // 已使用
  THOST_FTDC_OTPS_Used = '1',
  // 注销
  THOST_FTDC_OTPS_Disuse = '2',
}

// TFtdcBrokerUserTypeType是一个经济公司用户类型类型
export enum TThostFtdcBrokerUserTypeType {
  // 投资者
  THOST_FTDC_BUT_Investor = '1',
  // 操作员
  THOST_FTDC_BUT_BrokerUser = '2',
}

// TFtdcFutureTypeType是一个期货类型类型
export enum TThostFtdcFutureTypeType {
  // 商品期货
  THOST_FTDC_FUTT_Commodity = '1',
  // 金融期货
  THOST_FTDC_FUTT_Financial = '2',
}

// TFtdcFundEventTypeType是一个资金管理操作类型类型
export enum TThostFtdcFundEventTypeType {
  // 转账限额
  THOST_FTDC_FET_Restriction = '0',
  // 当日转账限额
  THOST_FTDC_FET_TodayRestriction = '1',
  // 期商流水
  THOST_FTDC_FET_Transfer = '2',
  // 资金冻结
  THOST_FTDC_FET_Credit = '3',
  // 投资者可提资金比例
  THOST_FTDC_FET_InvestorWithdrawAlm = '4',
  // 单个银行帐户转账限额
  THOST_FTDC_FET_BankRestriction = '5',
  // 银期签约账户
  THOST_FTDC_FET_Accountregister = '6',
  // 交易所出入金
  THOST_FTDC_FET_ExchangeFundIO = '7',
  // 投资者出入金
  THOST_FTDC_FET_InvestorFundIO = '8',
}

// TFtdcAccountSourceTypeType是一个资金账户来源类型
export enum TThostFtdcAccountSourceTypeType {
  // 银期同步
  THOST_FTDC_AST_FBTransfer = '0',
  // 手工录入
  THOST_FTDC_AST_ManualEntry = '1',
}

// TFtdcCodeSourceTypeType是一个交易编码来源类型
export enum TThostFtdcCodeSourceTypeType {
  // 统一开户(已规范)
  THOST_FTDC_CST_UnifyAccount = '0',
  // 手工录入(未规范)
  THOST_FTDC_CST_ManualEntry = '1',
}

// TFtdcUserRangeType是一个操作员范围类型
export enum TThostFtdcUserRangeType {
  // 所有
  THOST_FTDC_UR_All = '0',
  // 单一操作员
  THOST_FTDC_UR_Single = '1',
}

// TFtdcByGroupType是一个交易统计表按客户统计方式类型
export enum TThostFtdcByGroupType {
  // 按投资者统计
  THOST_FTDC_BG_Investor = '2',
  // 按类统计
  THOST_FTDC_BG_Group = '1',
}

// TFtdcTradeSumStatModeType是一个交易统计表按范围统计方式类型
export enum TThostFtdcTradeSumStatModeType {
  // 按合约统计
  THOST_FTDC_TSSM_Instrument = '1',
  // 按产品统计
  THOST_FTDC_TSSM_Product = '2',
  // 按交易所统计
  THOST_FTDC_TSSM_Exchange = '3',
}

// TFtdcExprSetModeType是一个日期表达式设置类型类型
export enum TThostFtdcExprSetModeType {
  // 相对已有规则设置
  THOST_FTDC_ESM_Relative = '1',
  // 典型设置
  THOST_FTDC_ESM_Typical = '2',
}

// TFtdcRateInvestorRangeType是一个投资者范围类型
export enum TThostFtdcRateInvestorRangeType {
  // 公司标准
  THOST_FTDC_RIR_All = '1',
  // 模板
  THOST_FTDC_RIR_Model = '2',
  // 单一投资者
  THOST_FTDC_RIR_Single = '3',
}

// TFtdcSyncDataStatusType是一个主次用系统数据同步状态类型
export enum TThostFtdcSyncDataStatusType {
  // 未同步
  THOST_FTDC_SDS_Initialize = '0',
  // 同步中
  THOST_FTDC_SDS_Settlementing = '1',
  // 已同步
  THOST_FTDC_SDS_Settlemented = '2',
}

// TFtdcTradeSourceType是一个成交来源类型
export enum TThostFtdcTradeSourceType {
  // 来自交易所普通回报
  THOST_FTDC_TSRC_NORMAL = '0',
  // 来自查询
  THOST_FTDC_TSRC_QUERY = '1',
}

// TFtdcFlexStatModeType是一个产品合约统计方式类型
export enum TThostFtdcFlexStatModeType {
  // 产品统计
  THOST_FTDC_FSM_Product = '1',
  // 交易所统计
  THOST_FTDC_FSM_Exchange = '2',
  // 统计所有
  THOST_FTDC_FSM_All = '3',
}

// TFtdcByInvestorRangeType是一个投资者范围统计方式类型
export enum TThostFtdcByInvestorRangeType {
  // 属性统计
  THOST_FTDC_BIR_Property = '1',
  // 统计所有
  THOST_FTDC_BIR_All = '2',
}

// TFtdcPropertyInvestorRangeType是一个投资者范围类型
export enum TThostFtdcPropertyInvestorRangeType {
  // 所有
  THOST_FTDC_PIR_All = '1',
  // 投资者属性
  THOST_FTDC_PIR_Property = '2',
  // 单一投资者
  THOST_FTDC_PIR_Single = '3',
}

// TFtdcFileStatusType是一个文件状态类型
export enum TThostFtdcFileStatusType {
  // 未生成
  THOST_FTDC_FIS_NoCreate = '0',
  // 已生成
  THOST_FTDC_FIS_Created = '1',
  // 生成失败
  THOST_FTDC_FIS_Failed = '2',
}

// TFtdcFileGenStyleType是一个文件生成方式类型
export enum TThostFtdcFileGenStyleType {
  // 下发
  THOST_FTDC_FGS_FileTransmit = '0',
  // 生成
  THOST_FTDC_FGS_FileGen = '1',
}

// TFtdcSysOperModeType是一个系统日志操作方法类型
export enum TThostFtdcSysOperModeType {
  // 增加
  THOST_FTDC_SoM_Add = '1',
  // 修改
  THOST_FTDC_SoM_Update = '2',
  // 删除
  THOST_FTDC_SoM_Delete = '3',
  // 复制
  THOST_FTDC_SoM_Copy = '4',
  // 激活
  THOST_FTDC_SoM_AcTive = '5',
  // 注销
  THOST_FTDC_SoM_CanCel = '6',
  // 重置
  THOST_FTDC_SoM_ReSet = '7',
}

// TFtdcSysOperTypeType是一个系统日志操作类型类型
export enum TThostFtdcSysOperTypeType {
  // 修改操作员密码
  THOST_FTDC_SoT_UpdatePassword = '0',
  // 操作员组织架构关系
  THOST_FTDC_SoT_UserDepartment = '1',
  // 角色管理
  THOST_FTDC_SoT_RoleManager = '2',
  // 角色功能设置
  THOST_FTDC_SoT_RoleFunction = '3',
  // 基础参数设置
  THOST_FTDC_SoT_BaseParam = '4',
  // 设置操作员
  THOST_FTDC_SoT_SetUserID = '5',
  // 用户角色设置
  THOST_FTDC_SoT_SetUserRole = '6',
  // 用户IP限制
  THOST_FTDC_SoT_UserIpRestriction = '7',
  // 组织架构管理
  THOST_FTDC_SoT_DepartmentManager = '8',
  // 组织架构向查询分类复制
  THOST_FTDC_SoT_DepartmentCopy = '9',
  // 交易编码管理
  THOST_FTDC_SoT_Tradingcode = 'A',
  // 投资者状态维护
  THOST_FTDC_SoT_InvestorStatus = 'B',
  // 投资者权限管理
  THOST_FTDC_SoT_InvestorAuthority = 'C',
  // 属性设置
  THOST_FTDC_SoT_PropertySet = 'D',
  // 重置投资者密码
  THOST_FTDC_SoT_ReSetInvestorPasswd = 'E',
  // 投资者个性信息维护
  THOST_FTDC_SoT_InvestorPersonalityInfo = 'F',
}

// TFtdcCSRCDataQueyTypeType是一个上报数据查询类型类型
export enum TThostFtdcCSRCDataQueyTypeType {
  // 查询当前交易日报送的数据
  THOST_FTDC_CSRCQ_Current = '0',
  // 查询历史报送的代理经纪公司的数据
  THOST_FTDC_CSRCQ_History = '1',
}

// TFtdcFreezeStatusType是一个休眠状态类型
export enum TThostFtdcFreezeStatusType {
  // 活跃
  THOST_FTDC_FRS_Normal = '1',
  // 休眠
  THOST_FTDC_FRS_Freeze = '0',
}

// TFtdcStandardStatusType是一个规范状态类型
export enum TThostFtdcStandardStatusType {
  // 已规范
  THOST_FTDC_STST_Standard = '0',
  // 未规范
  THOST_FTDC_STST_NonStandard = '1',
}

// TFtdcRightParamTypeType是一个配置类型类型
export enum TThostFtdcRightParamTypeType {
  // 休眠户
  THOST_FTDC_RPT_Freeze = '1',
  // 激活休眠户
  THOST_FTDC_RPT_FreezeActive = '2',
  // 开仓权限限制
  THOST_FTDC_RPT_OpenLimit = '3',
  // 解除开仓权限限制
  THOST_FTDC_RPT_RelieveOpenLimit = '4',
}

// TFtdcDataStatusType是一个反洗钱审核表数据状态类型
export enum TThostFtdcDataStatusType {
  // 正常
  THOST_FTDC_AMLDS_Normal = '0',
  // 已删除
  THOST_FTDC_AMLDS_Deleted = '1',
}

// TFtdcAMLCheckStatusType是一个审核状态类型
export enum TThostFtdcAMLCheckStatusType {
  // 未复核
  THOST_FTDC_AMLCHS_Init = '0',
  // 复核中
  THOST_FTDC_AMLCHS_Checking = '1',
  // 已复核
  THOST_FTDC_AMLCHS_Checked = '2',
  // 拒绝上报
  THOST_FTDC_AMLCHS_RefuseReport = '3',
}

// TFtdcAmlDateTypeType是一个日期类型类型
export enum TThostFtdcAmlDateTypeType {
  // 检查日期
  THOST_FTDC_AMLDT_DrawDay = '0',
  // 发生日期
  THOST_FTDC_AMLDT_TouchDay = '1',
}

// TFtdcAmlCheckLevelType是一个审核级别类型
export enum TThostFtdcAmlCheckLevelType {
  // 零级审核
  THOST_FTDC_AMLCL_CheckLevel0 = '0',
  // 一级审核
  THOST_FTDC_AMLCL_CheckLevel1 = '1',
  // 二级审核
  THOST_FTDC_AMLCL_CheckLevel2 = '2',
  // 三级审核
  THOST_FTDC_AMLCL_CheckLevel3 = '3',
}

// TFtdcExportFileTypeType是一个导出文件类型类型
export enum TThostFtdcExportFileTypeType {
  // CSV
  THOST_FTDC_EFT_CSV = '0',
  // Excel
  THOST_FTDC_EFT_EXCEL = '1',
  // DBF
  THOST_FTDC_EFT_DBF = '2',
}

// TFtdcSettleManagerTypeType是一个结算配置类型类型
export enum TThostFtdcSettleManagerTypeType {
  // 结算前准备
  THOST_FTDC_SMT_Before = '1',
  // 结算
  THOST_FTDC_SMT_Settlement = '2',
  // 结算后核对
  THOST_FTDC_SMT_After = '3',
  // 结算后处理
  THOST_FTDC_SMT_Settlemented = '4',
}

// TFtdcSettleManagerLevelType是一个结算配置等级类型
export enum TThostFtdcSettleManagerLevelType {
  // 必要
  THOST_FTDC_SML_Must = '1',
  // 警告
  THOST_FTDC_SML_Alarm = '2',
  // 提示
  THOST_FTDC_SML_Prompt = '3',
  // 不检查
  THOST_FTDC_SML_Ignore = '4',
}

// TFtdcSettleManagerGroupType是一个模块分组类型
export enum TThostFtdcSettleManagerGroupType {
  // 交易所核对
  THOST_FTDC_SMG_Exhcange = '1',
  // 内部核对
  THOST_FTDC_SMG_ASP = '2',
  // 上报数据核对
  THOST_FTDC_SMG_CSRC = '3',
}

// TFtdcLimitUseTypeType是一个保值额度使用类型类型
export enum TThostFtdcLimitUseTypeType {
  // 可重复使用
  THOST_FTDC_LUT_Repeatable = '1',
  // 不可重复使用
  THOST_FTDC_LUT_Unrepeatable = '2',
}

// TFtdcDataResourceType是一个数据来源类型
export enum TThostFtdcDataResourceType {
  // 本系统
  THOST_FTDC_DAR_Settle = '1',
  // 交易所
  THOST_FTDC_DAR_Exchange = '2',
  // 报送数据
  THOST_FTDC_DAR_CSRC = '3',
}

// TFtdcMarginTypeType是一个保证金类型类型
export enum TThostFtdcMarginTypeType {
  // 交易所保证金率
  THOST_FTDC_MGT_ExchMarginRate = '0',
  // 投资者保证金率
  THOST_FTDC_MGT_InstrMarginRate = '1',
  // 投资者交易保证金率
  THOST_FTDC_MGT_InstrMarginRateTrade = '2',
}

// TFtdcActiveTypeType是一个生效类型类型
export enum TThostFtdcActiveTypeType {
  // 仅当日生效
  THOST_FTDC_ACT_Intraday = '1',
  // 长期生效
  THOST_FTDC_ACT_Long = '2',
}

// TFtdcMarginRateTypeType是一个冲突保证金率类型类型
export enum TThostFtdcMarginRateTypeType {
  // 交易所保证金率
  THOST_FTDC_MRT_Exchange = '1',
  // 投资者保证金率
  THOST_FTDC_MRT_Investor = '2',
  // 投资者交易保证金率
  THOST_FTDC_MRT_InvestorTrade = '3',
}

// TFtdcBackUpStatusType是一个备份数据状态类型
export enum TThostFtdcBackUpStatusType {
  // 未生成备份数据
  THOST_FTDC_BUS_UnBak = '0',
  // 备份数据生成中
  THOST_FTDC_BUS_BakUp = '1',
  // 已生成备份数据
  THOST_FTDC_BUS_BakUped = '2',
  // 备份数据失败
  THOST_FTDC_BUS_BakFail = '3',
}

// TFtdcInitSettlementType是一个结算初始化状态类型
export enum TThostFtdcInitSettlementType {
  // 结算初始化未开始
  THOST_FTDC_SIS_UnInitialize = '0',
  // 结算初始化中
  THOST_FTDC_SIS_Initialize = '1',
  // 结算初始化完成
  THOST_FTDC_SIS_Initialized = '2',
}

// TFtdcReportStatusType是一个报表数据生成状态类型
export enum TThostFtdcReportStatusType {
  // 未生成报表数据
  THOST_FTDC_SRS_NoCreate = '0',
  // 报表数据生成中
  THOST_FTDC_SRS_Create = '1',
  // 已生成报表数据
  THOST_FTDC_SRS_Created = '2',
  // 生成报表数据失败
  THOST_FTDC_SRS_CreateFail = '3',
}

// TFtdcSaveStatusType是一个数据归档状态类型
export enum TThostFtdcSaveStatusType {
  // 归档未完成
  THOST_FTDC_SSS_UnSaveData = '0',
  // 归档完成
  THOST_FTDC_SSS_SaveDatad = '1',
}

// TFtdcSettArchiveStatusType是一个结算确认数据归档状态类型
export enum TThostFtdcSettArchiveStatusType {
  // 未归档数据
  THOST_FTDC_SAS_UnArchived = '0',
  // 数据归档中
  THOST_FTDC_SAS_Archiving = '1',
  // 已归档数据
  THOST_FTDC_SAS_Archived = '2',
  // 归档数据失败
  THOST_FTDC_SAS_ArchiveFail = '3',
}

// TFtdcCTPTypeType是一个CTP交易系统类型类型
export enum TThostFtdcCTPTypeType {
  // 未知类型
  THOST_FTDC_CTPT_Unkown = '0',
  // 主中心
  THOST_FTDC_CTPT_MainCenter = '1',
  // 备中心
  THOST_FTDC_CTPT_BackUp = '2',
}

// TFtdcCloseDealTypeType是一个平仓处理类型类型
export enum TThostFtdcCloseDealTypeType {
  // 正常
  THOST_FTDC_CDT_Normal = '0',
  // 投机平仓优先
  THOST_FTDC_CDT_SpecFirst = '1',
}

// TFtdcMortgageFundUseRangeType是一个货币质押资金可用范围类型
export enum TThostFtdcMortgageFundUseRangeType {
  // 不能使用
  THOST_FTDC_MFUR_None = '0',
  // 用于保证金
  THOST_FTDC_MFUR_Margin = '1',
  // 用于手续费、盈亏、保证金
  THOST_FTDC_MFUR_All = '2',
  // 人民币方案3
  THOST_FTDC_MFUR_CNY3 = '3',
}

// TFtdcSpecProductTypeType是一个特殊产品类型类型
export enum TThostFtdcSpecProductTypeType {
  // 郑商所套保产品
  THOST_FTDC_SPT_CzceHedge = '1',
  // 货币质押产品
  THOST_FTDC_SPT_IneForeignCurrency = '2',
  // 大连短线开平仓产品
  THOST_FTDC_SPT_DceOpenClose = '3',
}

// TFtdcFundMortgageTypeType是一个货币质押类型类型
export enum TThostFtdcFundMortgageTypeType {
  // 质押
  THOST_FTDC_FMT_Mortgage = '1',
  // 解质
  THOST_FTDC_FMT_Redemption = '2',
}

// TFtdcAccountSettlementParamIDType是一个投资者账户结算参数代码类型
export enum TThostFtdcAccountSettlementParamIDType {
  // 基础保证金
  THOST_FTDC_ASPI_BaseMargin = '1',
  // 最低权益标准
  THOST_FTDC_ASPI_LowestInterest = '2',
}

// TFtdcFundMortDirectionType是一个货币质押方向类型
export enum TThostFtdcFundMortDirectionType {
  // 货币质入
  THOST_FTDC_FMD_In = '1',
  // 货币质出
  THOST_FTDC_FMD_Out = '2',
}

// TFtdcBusinessClassType是一个换汇类别类型
export enum TThostFtdcBusinessClassType {
  // 盈利
  THOST_FTDC_BT_Profit = '0',
  // 亏损
  THOST_FTDC_BT_Loss = '1',
  // 其他
  THOST_FTDC_BT_Other = 'Z',
}

// TFtdcSwapSourceTypeType是一个换汇数据来源类型
export enum TThostFtdcSwapSourceTypeType {
  // 手工
  THOST_FTDC_SST_Manual = '0',
  // 自动生成
  THOST_FTDC_SST_Automatic = '1',
}

// TFtdcCurrExDirectionType是一个换汇类型类型
export enum TThostFtdcCurrExDirectionType {
  // 结汇
  THOST_FTDC_CED_Settlement = '0',
  // 售汇
  THOST_FTDC_CED_Sale = '1',
}

// TFtdcCurrencySwapStatusType是一个申请状态类型
export enum TThostFtdcCurrencySwapStatusType {
  // 已录入
  THOST_FTDC_CSS_Entry = '1',
  // 已审核
  THOST_FTDC_CSS_Approve = '2',
  // 已拒绝
  THOST_FTDC_CSS_Refuse = '3',
  // 已撤销
  THOST_FTDC_CSS_Revoke = '4',
  // 已发送
  THOST_FTDC_CSS_Send = '5',
  // 换汇成功
  THOST_FTDC_CSS_Success = '6',
  // 换汇失败
  THOST_FTDC_CSS_Failure = '7',
}

// TFtdcReqFlagType是一个换汇发送标志类型
export enum TThostFtdcReqFlagType {
  // 未发送
  THOST_FTDC_REQF_NoSend = '0',
  // 发送成功
  THOST_FTDC_REQF_SendSuccess = '1',
  // 发送失败
  THOST_FTDC_REQF_SendFailed = '2',
  // 等待重发
  THOST_FTDC_REQF_WaitReSend = '3',
}

// TFtdcResFlagType是一个换汇返回成功标志类型
export enum TThostFtdcResFlagType {
  // 成功
  THOST_FTDC_RESF_Success = '0',
  // 账户余额不足
  THOST_FTDC_RESF_InsuffiCient = '1',
  // 交易结果未知
  THOST_FTDC_RESF_UnKnown = '8',
}

// TFtdcExStatusType是一个修改状态类型
export enum TThostFtdcExStatusType {
  // 修改前
  THOST_FTDC_EXS_Before = '0',
  // 修改后
  THOST_FTDC_EXS_After = '1',
}

// TFtdcClientRegionType是一个开户客户地域类型
export enum TThostFtdcClientRegionType {
  // 国内客户
  THOST_FTDC_CR_Domestic = '1',
  // 港澳台客户
  THOST_FTDC_CR_GMT = '2',
  // 国外客户
  THOST_FTDC_CR_Foreign = '3',
}

// TFtdcHasBoardType是一个是否有董事会类型
export enum TThostFtdcHasBoardType {
  // 没有
  THOST_FTDC_HB_No = '0',
  // 有
  THOST_FTDC_HB_Yes = '1',
}

// TFtdcStartModeType是一个启动模式类型
export enum TThostFtdcStartModeType {
  // 正常
  THOST_FTDC_SM_Normal = '1',
  // 应急
  THOST_FTDC_SM_Emerge = '2',
  // 恢复
  THOST_FTDC_SM_Restore = '3',
}

// TFtdcTemplateTypeType是一个模型类型类型
export enum TThostFtdcTemplateTypeType {
  // 全量
  THOST_FTDC_TPT_Full = '1',
  // 增量
  THOST_FTDC_TPT_Increment = '2',
  // 备份
  THOST_FTDC_TPT_BackUp = '3',
}

// TFtdcLoginModeType是一个登录模式类型
export enum TThostFtdcLoginModeType {
  // 交易
  THOST_FTDC_LM_Trade = '0',
  // 转账
  THOST_FTDC_LM_Transfer = '1',
}

// TFtdcPromptTypeType是一个日历提示类型类型
export enum TThostFtdcPromptTypeType {
  // 合约上下市
  THOST_FTDC_CPT_Instrument = '1',
  // 保证金分段生效
  THOST_FTDC_CPT_Margin = '2',
}

// TFtdcHasTrusteeType是一个是否有托管人类型
export enum TThostFtdcHasTrusteeType {
  // 有
  THOST_FTDC_HT_Yes = '1',
  // 没有
  THOST_FTDC_HT_No = '0',
}

// TFtdcAmTypeType是一个机构类型类型
export enum TThostFtdcAmTypeType {
  // 银行
  THOST_FTDC_AMT_Bank = '1',
  // 证券公司
  THOST_FTDC_AMT_Securities = '2',
  // 基金公司
  THOST_FTDC_AMT_Fund = '3',
  // 保险公司
  THOST_FTDC_AMT_Insurance = '4',
  // 信托公司
  THOST_FTDC_AMT_Trust = '5',
  // 其他
  THOST_FTDC_AMT_Other = '9',
}

// TFtdcCSRCFundIOTypeType是一个出入金类型类型
export enum TThostFtdcCSRCFundIOTypeType {
  // 出入金
  THOST_FTDC_CFIOT_FundIO = '0',
  // 银期换汇
  THOST_FTDC_CFIOT_SwapCurrency = '1',
}

// TFtdcCusAccountTypeType是一个结算账户类型类型
export enum TThostFtdcCusAccountTypeType {
  // 期货结算账户
  THOST_FTDC_CAT_Futures = '1',
  // 纯期货资管业务下的资管结算账户
  THOST_FTDC_CAT_AssetmgrFuture = '2',
  // 综合类资管业务下的期货资管托管账户
  THOST_FTDC_CAT_AssetmgrTrustee = '3',
  // 综合类资管业务下的资金中转账户
  THOST_FTDC_CAT_AssetmgrTransfer = '4',
}

// TFtdcLanguageTypeType是一个通知语言类型类型
export enum TThostFtdcLanguageTypeType {
  // 中文
  THOST_FTDC_LT_Chinese = '1',
  // 英文
  THOST_FTDC_LT_English = '2',
}

// TFtdcAssetmgrClientTypeType是一个资产管理客户类型类型
export enum TThostFtdcAssetmgrClientTypeType {
  // 个人资管客户
  THOST_FTDC_AMCT_Person = '1',
  // 单位资管客户
  THOST_FTDC_AMCT_Organ = '2',
  // 特殊单位资管客户
  THOST_FTDC_AMCT_SpecialOrgan = '4',
}

// TFtdcAssetmgrTypeType是一个投资类型类型
export enum TThostFtdcAssetmgrTypeType {
  // 期货类
  THOST_FTDC_ASST_Futures = '3',
  // 综合类
  THOST_FTDC_ASST_SpecialOrgan = '4',
}

// TFtdcCheckInstrTypeType是一个合约比较类型类型
export enum TThostFtdcCheckInstrTypeType {
  // 合约交易所不存在
  THOST_FTDC_CIT_HasExch = '0',
  // 合约本系统不存在
  THOST_FTDC_CIT_HasATP = '1',
  // 合约比较不一致
  THOST_FTDC_CIT_HasDiff = '2',
}

// TFtdcDeliveryTypeType是一个交割类型类型
export enum TThostFtdcDeliveryTypeType {
  // 手工交割
  THOST_FTDC_DT_HandDeliv = '1',
  // 到期交割
  THOST_FTDC_DT_PersonDeliv = '2',
}

// TFtdcMaxMarginSideAlgorithmType是一个大额单边保证金算法类型
export enum TThostFtdcMaxMarginSideAlgorithmType {
  // 不使用大额单边保证金算法
  THOST_FTDC_MMSA_NO = '0',
  // 使用大额单边保证金算法
  THOST_FTDC_MMSA_YES = '1',
}

// TFtdcDAClientTypeType是一个资产管理客户类型类型
export enum TThostFtdcDAClientTypeType {
  // 自然人
  THOST_FTDC_CACT_Person = '0',
  // 法人
  THOST_FTDC_CACT_Company = '1',
  // 其他
  THOST_FTDC_CACT_Other = '2',
}

// TFtdcUOAAssetmgrTypeType是一个投资类型类型
export enum TThostFtdcUOAAssetmgrTypeType {
  // 期货类
  THOST_FTDC_UOAAT_Futures = '1',
  // 综合类
  THOST_FTDC_UOAAT_SpecialOrgan = '2',
}

// TFtdcDirectionEnType是一个买卖方向类型
export enum TThostFtdcDirectionEnType {
  // Buy
  THOST_FTDC_DEN_Buy = '0',
  // Sell
  THOST_FTDC_DEN_Sell = '1',
}

// TFtdcOffsetFlagEnType是一个开平标志类型
export enum TThostFtdcOffsetFlagEnType {
  // Position Opening
  THOST_FTDC_OFEN_Open = '0',
  // Position Close
  THOST_FTDC_OFEN_Close = '1',
  // Forced Liquidation
  THOST_FTDC_OFEN_ForceClose = '2',
  // Close Today
  THOST_FTDC_OFEN_CloseToday = '3',
  // Close Prev.
  THOST_FTDC_OFEN_CloseYesterday = '4',
  // Forced Reduction
  THOST_FTDC_OFEN_ForceOff = '5',
  // Local Forced Liquidation
  THOST_FTDC_OFEN_LocalForceClose = '6',
}

// TFtdcHedgeFlagEnType是一个投机套保标志类型
export enum TThostFtdcHedgeFlagEnType {
  // Speculation
  THOST_FTDC_HFEN_Speculation = '1',
  // Arbitrage
  THOST_FTDC_HFEN_Arbitrage = '2',
  // Hedge
  THOST_FTDC_HFEN_Hedge = '3',
}

// TFtdcFundIOTypeEnType是一个出入金类型类型
export enum TThostFtdcFundIOTypeEnType {
  // Deposit
  THOST_FTDC_FIOTEN_FundIO = '1',
  // Bank-Futures Transfer
  THOST_FTDC_FIOTEN_Transfer = '2',
  // Bank-Futures FX Exchange
  THOST_FTDC_FIOTEN_SwapCurrency = '3',
}

// TFtdcFundTypeEnType是一个资金类型类型
export enum TThostFtdcFundTypeEnType {
  // Bank Deposit
  THOST_FTDC_FTEN_Deposite = '1',
  // Payment
  THOST_FTDC_FTEN_ItemFund = '2',
  // Brokerage Adj
  THOST_FTDC_FTEN_Company = '3',
  // Internal Transfer
  THOST_FTDC_FTEN_InnerTransfer = '4',
}

// TFtdcFundDirectionEnType是一个出入金方向类型
export enum TThostFtdcFundDirectionEnType {
  // Deposit
  THOST_FTDC_FDEN_In = '1',
  // Withdrawal
  THOST_FTDC_FDEN_Out = '2',
}

// TFtdcFundMortDirectionEnType是一个货币质押方向类型
export enum TThostFtdcFundMortDirectionEnType {
  // Pledge
  THOST_FTDC_FMDEN_In = '1',
  // Redemption
  THOST_FTDC_FMDEN_Out = '2',
}

// TFtdcOptionsTypeType是一个期权类型类型
export enum TThostFtdcOptionsTypeType {
  // 看涨
  THOST_FTDC_CP_CallOptions = '1',
  // 看跌
  THOST_FTDC_CP_PutOptions = '2',
}

// TFtdcStrikeModeType是一个执行方式类型
export enum TThostFtdcStrikeModeType {
  // 欧式
  THOST_FTDC_STM_Continental = '0',
  // 美式
  THOST_FTDC_STM_American = '1',
  // 百慕大
  THOST_FTDC_STM_Bermuda = '2',
}

// TFtdcStrikeTypeType是一个执行类型类型
export enum TThostFtdcStrikeTypeType {
  // 自身对冲
  THOST_FTDC_STT_Hedge = '0',
  // 匹配执行
  THOST_FTDC_STT_Match = '1',
}

// TFtdcApplyTypeType是一个中金所期权放弃执行申请类型类型
export enum TThostFtdcApplyTypeType {
  // 不执行数量
  THOST_FTDC_APPT_NotStrikeNum = '4',
}

// TFtdcGiveUpDataSourceType是一个放弃执行申请数据来源类型
export enum TThostFtdcGiveUpDataSourceType {
  // 系统生成
  THOST_FTDC_GUDS_Gen = '0',
  // 手工添加
  THOST_FTDC_GUDS_Hand = '1',
}

// TFtdcExecResultType是一个执行结果类型
export enum TThostFtdcExecResultType {
  // 没有执行
  THOST_FTDC_OER_NoExec = 'n',
  // 已经取消
  THOST_FTDC_OER_Canceled = 'c',
  // 执行成功
  THOST_FTDC_OER_OK = '0',
  // 期权持仓不够
  THOST_FTDC_OER_NoPosition = '1',
  // 资金不够
  THOST_FTDC_OER_NoDeposit = '2',
  // 会员不存在
  THOST_FTDC_OER_NoParticipant = '3',
  // 客户不存在
  THOST_FTDC_OER_NoClient = '4',
  // 合约不存在
  THOST_FTDC_OER_NoInstrument = '6',
  // 没有执行权限
  THOST_FTDC_OER_NoRight = '7',
  // 不合理的数量
  THOST_FTDC_OER_InvalidVolume = '8',
  // 没有足够的历史成交
  THOST_FTDC_OER_NoEnoughHistoryTrade = '9',
  // 未知
  THOST_FTDC_OER_Unknown = 'a',
}

// TFtdcCombinationTypeType是一个组合类型类型
export enum TThostFtdcCombinationTypeType {
  // 期货组合
  THOST_FTDC_COMBT_Future = '0',
  // 垂直价差BUL
  THOST_FTDC_COMBT_BUL = '1',
  // 垂直价差BER
  THOST_FTDC_COMBT_BER = '2',
  // 跨式组合
  THOST_FTDC_COMBT_STD = '3',
  // 宽跨式组合
  THOST_FTDC_COMBT_STG = '4',
  // 备兑组合
  THOST_FTDC_COMBT_PRT = '5',
  // 时间价差组合
  THOST_FTDC_COMBT_CAS = '6',
  // 期权对锁组合
  THOST_FTDC_COMBT_OPL = '7',
  // 买备兑组合
  THOST_FTDC_COMBT_BFO = '8',
  // 买入期权垂直价差组合
  THOST_FTDC_COMBT_BLS = '9',
  // 卖出期权垂直价差组合
  THOST_FTDC_COMBT_BES = 'a',
}

// TFtdcDceCombinationTypeType是一个组合类型类型
export enum TThostFtdcDceCombinationTypeType {
  // 期货对锁组合
  THOST_FTDC_DCECOMBT_SPL = '0',
  // 期权对锁组合
  THOST_FTDC_DCECOMBT_OPL = '1',
  // 期货跨期组合
  THOST_FTDC_DCECOMBT_SP = '2',
  // 期货跨品种组合
  THOST_FTDC_DCECOMBT_SPC = '3',
  // 买入期权垂直价差组合
  THOST_FTDC_DCECOMBT_BLS = '4',
  // 卖出期权垂直价差组合
  THOST_FTDC_DCECOMBT_BES = '5',
  // 期权日历价差组合
  THOST_FTDC_DCECOMBT_CAS = '6',
  // 期权跨式组合
  THOST_FTDC_DCECOMBT_STD = '7',
  // 期权宽跨式组合
  THOST_FTDC_DCECOMBT_STG = '8',
  // 买入期货期权组合
  THOST_FTDC_DCECOMBT_BFO = '9',
  // 卖出期货期权组合
  THOST_FTDC_DCECOMBT_SFO = 'a',
}

// TFtdcOptionRoyaltyPriceTypeType是一个期权权利金价格类型类型
export enum TThostFtdcOptionRoyaltyPriceTypeType {
  // 昨结算价
  THOST_FTDC_ORPT_PreSettlementPrice = '1',
  // 开仓价
  THOST_FTDC_ORPT_OpenPrice = '4',
  // 最新价与昨结算价较大值
  THOST_FTDC_ORPT_MaxPreSettlementPrice = '5',
}

// TFtdcBalanceAlgorithmType是一个权益算法类型
export enum TThostFtdcBalanceAlgorithmType {
  // 不计算期权市值盈亏
  THOST_FTDC_BLAG_Default = '1',
  // 计算期权市值亏损
  THOST_FTDC_BLAG_IncludeOptValLost = '2',
}

// TFtdcActionTypeType是一个执行类型类型
export enum TThostFtdcActionTypeType {
  // 执行
  THOST_FTDC_ACTP_Exec = '1',
  // 放弃
  THOST_FTDC_ACTP_Abandon = '2',
}

// TFtdcForQuoteStatusType是一个询价状态类型
export enum TThostFtdcForQuoteStatusType {
  // 已经提交
  THOST_FTDC_FQST_Submitted = 'a',
  // 已经接受
  THOST_FTDC_FQST_Accepted = 'b',
  // 已经被拒绝
  THOST_FTDC_FQST_Rejected = 'c',
}

// TFtdcValueMethodType是一个取值方式类型
export enum TThostFtdcValueMethodType {
  // 按绝对值
  THOST_FTDC_VM_Absolute = '0',
  // 按比率
  THOST_FTDC_VM_Ratio = '1',
}

// TFtdcExecOrderPositionFlagType是一个期权行权后是否保留期货头寸的标记类型
export enum TThostFtdcExecOrderPositionFlagType {
  // 保留
  THOST_FTDC_EOPF_Reserve = '0',
  // 不保留
  THOST_FTDC_EOPF_UnReserve = '1',
}

// TFtdcExecOrderCloseFlagType是一个期权行权后生成的头寸是否自动平仓类型
export enum TThostFtdcExecOrderCloseFlagType {
  // 自动平仓
  THOST_FTDC_EOCF_AutoClose = '0',
  // 免于自动平仓
  THOST_FTDC_EOCF_NotToClose = '1',
}

// TFtdcProductTypeType是一个产品类型类型
export enum TThostFtdcProductTypeType {
  // 期货
  THOST_FTDC_PTE_Futures = '1',
  // 期权
  THOST_FTDC_PTE_Options = '2',
}

// TFtdcCZCEUploadFileNameType是一个郑商所结算文件名类型
export enum TThostFtdcCZCEUploadFileNameType {
  // ^\d{8}_zz_\d{4}
  THOST_FTDC_CUFN_CUFN_O = 'O',
  // ^\d{8}成交表
  THOST_FTDC_CUFN_CUFN_T = 'T',
  // ^\d{8}单腿持仓表new
  THOST_FTDC_CUFN_CUFN_P = 'P',
  // ^\d{8}非平仓了结表
  THOST_FTDC_CUFN_CUFN_N = 'N',
  // ^\d{8}平仓表
  THOST_FTDC_CUFN_CUFN_L = 'L',
  // ^\d{8}资金表
  THOST_FTDC_CUFN_CUFN_F = 'F',
  // ^\d{8}组合持仓表
  THOST_FTDC_CUFN_CUFN_C = 'C',
  // ^\d{8}保证金参数表
  THOST_FTDC_CUFN_CUFN_M = 'M',
}

// TFtdcDCEUploadFileNameType是一个大商所结算文件名类型
export enum TThostFtdcDCEUploadFileNameType {
  // ^\d{8}_dl_\d{3}
  THOST_FTDC_DUFN_DUFN_O = 'O',
  // ^\d{8}_成交表
  THOST_FTDC_DUFN_DUFN_T = 'T',
  // ^\d{8}_持仓表
  THOST_FTDC_DUFN_DUFN_P = 'P',
  // ^\d{8}_资金结算表
  THOST_FTDC_DUFN_DUFN_F = 'F',
  // ^\d{8}_优惠组合持仓明细表
  THOST_FTDC_DUFN_DUFN_C = 'C',
  // ^\d{8}_持仓明细表
  THOST_FTDC_DUFN_DUFN_D = 'D',
  // ^\d{8}_保证金参数表
  THOST_FTDC_DUFN_DUFN_M = 'M',
  // ^\d{8}_期权执行表
  THOST_FTDC_DUFN_DUFN_S = 'S',
}

// TFtdcSHFEUploadFileNameType是一个上期所结算文件名类型
export enum TThostFtdcSHFEUploadFileNameType {
  // ^\d{4}_\d{8}_\d{8}_DailyFundChg
  THOST_FTDC_SUFN_SUFN_O = 'O',
  // ^\d{4}_\d{8}_\d{8}_Trade
  THOST_FTDC_SUFN_SUFN_T = 'T',
  // ^\d{4}_\d{8}_\d{8}_SettlementDetail
  THOST_FTDC_SUFN_SUFN_P = 'P',
  // ^\d{4}_\d{8}_\d{8}_Capital
  THOST_FTDC_SUFN_SUFN_F = 'F',
}

// TFtdcCFFEXUploadFileNameType是一个中金所结算文件名类型
export enum TThostFtdcCFFEXUploadFileNameType {
  // ^\d{4}_SG\d{1}_\d{8}_\d{1}_Trade
  THOST_FTDC_CFUFN_SUFN_T = 'T',
  // ^\d{4}_SG\d{1}_\d{8}_\d{1}_SettlementDetail
  THOST_FTDC_CFUFN_SUFN_P = 'P',
  // ^\d{4}_SG\d{1}_\d{8}_\d{1}_Capital
  THOST_FTDC_CFUFN_SUFN_F = 'F',
  // ^\d{4}_SG\d{1}_\d{8}_\d{1}_OptionExec
  THOST_FTDC_CFUFN_SUFN_S = 'S',
}

// TFtdcCombDirectionType是一个组合指令方向类型
export enum TThostFtdcCombDirectionType {
  // 申请组合
  THOST_FTDC_CMDR_Comb = '0',
  // 申请拆分
  THOST_FTDC_CMDR_UnComb = '1',
  // 操作员删组合单
  THOST_FTDC_CMDR_DelComb = '2',
}

// TFtdcStrikeOffsetTypeType是一个行权偏移类型类型
export enum TThostFtdcStrikeOffsetTypeType {
  // 实值额
  THOST_FTDC_STOV_RealValue = '1',
  // 盈利额
  THOST_FTDC_STOV_ProfitValue = '2',
  // 实值比例
  THOST_FTDC_STOV_RealRatio = '3',
  // 盈利比例
  THOST_FTDC_STOV_ProfitRatio = '4',
}

// TFtdcReserveOpenAccStasType是一个预约开户状态类型
export enum TThostFtdcReserveOpenAccStasType {
  // 等待处理中
  THOST_FTDC_ROAST_Processing = '0',
  // 已撤销
  THOST_FTDC_ROAST_Cancelled = '1',
  // 已开户
  THOST_FTDC_ROAST_Opened = '2',
  // 无效请求
  THOST_FTDC_ROAST_Invalid = '3',
}

// TFtdcWeakPasswordSourceType是一个弱密码来源类型
export enum TThostFtdcWeakPasswordSourceType {
  // 弱密码库
  THOST_FTDC_WPSR_Lib = '1',
  // 手工录入
  THOST_FTDC_WPSR_Manual = '2',
}

// TFtdcOptSelfCloseFlagType是一个期权行权的头寸是否自对冲类型
export enum TThostFtdcOptSelfCloseFlagType {
  // 自对冲期权仓位
  THOST_FTDC_OSCF_CloseSelfOptionPosition = '1',
  // 保留期权仓位
  THOST_FTDC_OSCF_ReserveOptionPosition = '2',
  // 自对冲卖方履约后的期货仓位
  THOST_FTDC_OSCF_SellCloseSelfFuturePosition = '3',
  // 保留卖方履约后的期货仓位
  THOST_FTDC_OSCF_ReserveFuturePosition = '4',
}

// TFtdcBizTypeType是一个业务类型类型
export enum TThostFtdcBizTypeType {
  // 期货
  THOST_FTDC_BZTP_Future = '1',
  // 证券
  THOST_FTDC_BZTP_Stock = '2',
}

// TFtdcAppTypeType是一个用户App类型类型
export enum TThostFtdcAppTypeType {
  // 直连的投资者
  THOST_FTDC_APP_TYPE_Investor = '1',
  // 为每个投资者都创建连接的中继
  THOST_FTDC_APP_TYPE_InvestorRelay = '2',
  // 所有投资者共享一个操作员连接的中继
  THOST_FTDC_APP_TYPE_OperatorRelay = '3',
  // 未知
  THOST_FTDC_APP_TYPE_UnKnown = '4',
}

// TFtdcResponseValueType是一个应答类型类型
export enum TThostFtdcResponseValueType {
  // 检查成功
  THOST_FTDC_RV_Right = '0',
  // 检查失败
  THOST_FTDC_RV_Refuse = '1',
}

// TFtdcOTCTradeTypeType是一个OTC成交类型类型
export enum TThostFtdcOTCTradeTypeType {
  // 大宗交易
  THOST_FTDC_OTC_TRDT_Block = '0',
  // 期转现
  THOST_FTDC_OTC_TRDT_EFP = '1',
}

// TFtdcMatchTypeType是一个期现风险匹配方式类型
export enum TThostFtdcMatchTypeType {
  // 基点价值
  THOST_FTDC_OTC_MT_DV01 = '1',
  // 面值
  THOST_FTDC_OTC_MT_ParValue = '2',
}

// TFtdcAuthTypeType是一个用户终端认证方式类型
export enum TThostFtdcAuthTypeType {
  // 白名单校验
  THOST_FTDC_AU_WHITE = '0',
  // 黑名单校验
  THOST_FTDC_AU_BLACK = '1',
}

// TFtdcClassTypeType是一个合约分类方式类型
export enum TThostFtdcClassTypeType {
  // 所有合约
  THOST_FTDC_INS_ALL = '0',
  // 期货、即期、期转现、Tas、金属指数合约
  THOST_FTDC_INS_FUTURE = '1',
  // 期货、现货期权合约
  THOST_FTDC_INS_OPTION = '2',
  // 组合合约
  THOST_FTDC_INS_COMB = '3',
}

// TFtdcTradingTypeType是一个合约交易状态分类方式类型
export enum TThostFtdcTradingTypeType {
  // 所有状态
  THOST_FTDC_TD_ALL = '0',
  // 交易
  THOST_FTDC_TD_TRADE = '1',
  // 非交易
  THOST_FTDC_TD_UNTRADE = '2',
}

// TFtdcProductStatusType是一个产品状态类型
export enum TThostFtdcProductStatusType {
  // 可交易
  THOST_FTDC_PS_tradeable = '1',
  // 不可交易
  THOST_FTDC_PS_untradeable = '2',
}

// TFtdcSyncDeltaStatusType是一个追平状态类型
export enum TThostFtdcSyncDeltaStatusType {
  // 交易可读
  THOST_FTDC_SDS_Readable = '1',
  // 交易在读
  THOST_FTDC_SDS_Reading = '2',
  // 交易读取完成
  THOST_FTDC_SDS_Readend = '3',
  // 追平失败 交易本地状态结算不存在
  THOST_FTDC_SDS_OptErr = 'e',
}

// TFtdcActionDirectionType是一个操作标志类型
export enum TThostFtdcActionDirectionType {
  // 增加
  THOST_FTDC_ACD_Add = '1',
  // 删除
  THOST_FTDC_ACD_Del = '2',
  // 更新
  THOST_FTDC_ACD_Upd = '3',
}

// 信息分发
export interface ICThostFtdcDisseminationField {
  // 序列系列号
  SequenceSeries: number;
  // 序列号
  SequenceNo: number;
}

// 用户登录请求
export interface ICThostFtdcReqUserLoginField {
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 密码
  Password: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 接口端产品信息
  InterfaceProductInfo: string;
  // 协议信息
  ProtocolInfo: string;
  // Mac地址
  MacAddress: string;
  // 动态密码
  OneTimePassword: string;
  // 保留的无效字段
  reserve1: string;
  // 登录备注
  LoginRemark: string;
  // 终端IP端口
  ClientIPPort: number;
  // 终端IP地址
  ClientIPAddress: string;
}

// 用户登录应答
export interface ICThostFtdcRspUserLoginField {
  // 交易日
  TradingDay: string;
  // 登录成功时间
  LoginTime: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 交易系统名称
  SystemName: string;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 最大报单引用
  MaxOrderRef: string;
  // 上期所时间
  SHFETime: string;
  // 大商所时间
  DCETime: string;
  // 郑商所时间
  CZCETime: string;
  // 中金所时间
  FFEXTime: string;
  // 能源中心时间
  INETime: string;
}

// 用户登出请求
export interface ICThostFtdcUserLogoutField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 强制交易员退出
export interface ICThostFtdcForceUserLogoutField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 客户端认证请求
export interface ICThostFtdcReqAuthenticateField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 认证码
  AuthCode: string;
  // App代码
  AppID: string;
}

// 客户端认证响应
export interface ICThostFtdcRspAuthenticateField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 用户端产品信息
  UserProductInfo: string;
  // App代码
  AppID: string;
  // App类型
  AppType: TThostFtdcAppTypeType;
}

// 客户端认证信息
export interface ICThostFtdcAuthenticationInfoField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 认证信息
  AuthInfo: string;
  // 是否为认证结果
  IsResult: number;
  // App代码
  AppID: string;
  // App类型
  AppType: TThostFtdcAppTypeType;
  // 保留的无效字段
  reserve1: string;
  // 终端IP地址
  ClientIPAddress: string;
}

// 用户登录应答2
export interface ICThostFtdcRspUserLogin2Field {
  // 交易日
  TradingDay: string;
  // 登录成功时间
  LoginTime: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 交易系统名称
  SystemName: string;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 最大报单引用
  MaxOrderRef: string;
  // 上期所时间
  SHFETime: string;
  // 大商所时间
  DCETime: string;
  // 郑商所时间
  CZCETime: string;
  // 中金所时间
  FFEXTime: string;
  // 能源中心时间
  INETime: string;
  // 随机串
  RandomString: string;
}

// 银期转帐报文头
export interface ICThostFtdcTransferHeaderField {
  // 版本号，常量，1.0
  Version: string;
  // 交易代码，必填
  TradeCode: string;
  // 交易日期，必填，格式：yyyymmdd
  TradeDate: string;
  // 交易时间，必填，格式：hhmmss
  TradeTime: string;
  // 发起方流水号，N
  TradeSerial: string;
  // 期货公司代码，必填
  FutureID: string;
  // 银行代码，根据查询银行得到，必填
  BankID: string;
  // 银行分中心代码，根据查询银行得到，必填
  BankBrchID: string;
  // 操作员，N
  OperNo: string;
  // 交易设备类型，N
  DeviceID: string;
  // 记录数，N
  RecordNum: string;
  // 会话编号，N
  SessionID: number;
  // 请求编号，N
  RequestID: number;
}

// 银行资金转期货请求，TradeCode=202001
export interface ICThostFtdcTransferBankToFutureReqField {
  // 期货资金账户
  FutureAccount: string;
  // 密码标志
  FuturePwdFlag: TThostFtdcFuturePwdFlagType;
  // 密码
  FutureAccPwd: string;
  // 转账金额
  TradeAmt: number;
  // 客户手续费
  CustFee: number;
  // 币种：RMB-人民币 USD-美圆 HKD-港元
  CurrencyCode: string;
}

// 银行资金转期货请求响应
export interface ICThostFtdcTransferBankToFutureRspField {
  // 响应代码
  RetCode: string;
  // 响应信息
  RetInfo: string;
  // 资金账户
  FutureAccount: string;
  // 转帐金额
  TradeAmt: number;
  // 应收客户手续费
  CustFee: number;
  // 币种
  CurrencyCode: string;
}

// 期货资金转银行请求，TradeCode=202002
export interface ICThostFtdcTransferFutureToBankReqField {
  // 期货资金账户
  FutureAccount: string;
  // 密码标志
  FuturePwdFlag: TThostFtdcFuturePwdFlagType;
  // 密码
  FutureAccPwd: string;
  // 转账金额
  TradeAmt: number;
  // 客户手续费
  CustFee: number;
  // 币种：RMB-人民币 USD-美圆 HKD-港元
  CurrencyCode: string;
}

// 期货资金转银行请求响应
export interface ICThostFtdcTransferFutureToBankRspField {
  // 响应代码
  RetCode: string;
  // 响应信息
  RetInfo: string;
  // 资金账户
  FutureAccount: string;
  // 转帐金额
  TradeAmt: number;
  // 应收客户手续费
  CustFee: number;
  // 币种
  CurrencyCode: string;
}

// 查询银行资金请求，TradeCode=204002
export interface ICThostFtdcTransferQryBankReqField {
  // 期货资金账户
  FutureAccount: string;
  // 密码标志
  FuturePwdFlag: TThostFtdcFuturePwdFlagType;
  // 密码
  FutureAccPwd: string;
  // 币种：RMB-人民币 USD-美圆 HKD-港元
  CurrencyCode: string;
}

// 查询银行资金请求响应
export interface ICThostFtdcTransferQryBankRspField {
  // 响应代码
  RetCode: string;
  // 响应信息
  RetInfo: string;
  // 资金账户
  FutureAccount: string;
  // 银行余额
  TradeAmt: number;
  // 银行可用余额
  UseAmt: number;
  // 银行可取余额
  FetchAmt: number;
  // 币种
  CurrencyCode: string;
}

// 查询银行交易明细请求，TradeCode=204999
export interface ICThostFtdcTransferQryDetailReqField {
  // 期货资金账户
  FutureAccount: string;
}

// 查询银行交易明细请求响应
export interface ICThostFtdcTransferQryDetailRspField {
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 交易代码
  TradeCode: string;
  // 期货流水号
  FutureSerial: number;
  // 期货公司代码
  FutureID: string;
  // 资金帐号
  FutureAccount: string;
  // 银行流水号
  BankSerial: number;
  // 银行代码
  BankID: string;
  // 银行分中心代码
  BankBrchID: string;
  // 银行账号
  BankAccount: string;
  // 证件号码
  CertCode: string;
  // 货币代码
  CurrencyCode: string;
  // 发生金额
  TxAmount: number;
  // 有效标志
  Flag: TThostFtdcTransferValidFlagType;
}

// 响应信息
export interface ICThostFtdcRspInfoField {
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 交易所
export interface ICThostFtdcExchangeField {
  // 交易所代码
  ExchangeID: string;
  // 交易所名称
  ExchangeName: string;
  // 交易所属性
  ExchangeProperty: TThostFtdcExchangePropertyType;
}

// 产品
export interface ICThostFtdcProductField {
  // 保留的无效字段
  reserve1: string;
  // 产品名称
  ProductName: string;
  // 交易所代码
  ExchangeID: string;
  // 产品类型
  ProductClass: TThostFtdcProductClassType;
  // 合约数量乘数
  VolumeMultiple: number;
  // 最小变动价位
  PriceTick: number;
  // 市价单最大下单量
  MaxMarketOrderVolume: number;
  // 市价单最小下单量
  MinMarketOrderVolume: number;
  // 限价单最大下单量
  MaxLimitOrderVolume: number;
  // 限价单最小下单量
  MinLimitOrderVolume: number;
  // 持仓类型
  PositionType: TThostFtdcPositionTypeType;
  // 持仓日期类型
  PositionDateType: TThostFtdcPositionDateTypeType;
  // 平仓处理类型
  CloseDealType: TThostFtdcCloseDealTypeType;
  // 交易币种类型
  TradeCurrencyID: string;
  // 质押资金可用范围
  MortgageFundUseRange: TThostFtdcMortgageFundUseRangeType;
  // 保留的无效字段
  reserve2: string;
  // 合约基础商品乘数
  UnderlyingMultiple: number;
  // 产品代码
  ProductID: string;
  // 交易所产品代码
  ExchangeProductID: string;
}

// 合约
export interface ICThostFtdcInstrumentField {
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 合约名称
  InstrumentName: string;
  // 保留的无效字段
  reserve2: string;
  // 保留的无效字段
  reserve3: string;
  // 产品类型
  ProductClass: TThostFtdcProductClassType;
  // 交割年份
  DeliveryYear: number;
  // 交割月
  DeliveryMonth: number;
  // 市价单最大下单量
  MaxMarketOrderVolume: number;
  // 市价单最小下单量
  MinMarketOrderVolume: number;
  // 限价单最大下单量
  MaxLimitOrderVolume: number;
  // 限价单最小下单量
  MinLimitOrderVolume: number;
  // 合约数量乘数
  VolumeMultiple: number;
  // 最小变动价位
  PriceTick: number;
  // 创建日
  CreateDate: string;
  // 上市日
  OpenDate: string;
  // 到期日
  ExpireDate: string;
  // 开始交割日
  StartDelivDate: string;
  // 结束交割日
  EndDelivDate: string;
  // 合约生命周期状态
  InstLifePhase: TThostFtdcInstLifePhaseType;
  // 当前是否交易
  IsTrading: number;
  // 持仓类型
  PositionType: TThostFtdcPositionTypeType;
  // 持仓日期类型
  PositionDateType: TThostFtdcPositionDateTypeType;
  // 多头保证金率
  LongMarginRatio: number;
  // 空头保证金率
  ShortMarginRatio: number;
  // 是否使用大额单边保证金算法
  MaxMarginSideAlgorithm: TThostFtdcMaxMarginSideAlgorithmType;
  // 保留的无效字段
  reserve4: string;
  // 执行价
  StrikePrice: number;
  // 期权类型
  OptionsType: TThostFtdcOptionsTypeType;
  // 合约基础商品乘数
  UnderlyingMultiple: number;
  // 组合类型
  CombinationType: TThostFtdcCombinationTypeType;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // 产品代码
  ProductID: string;
  // 基础商品代码
  UnderlyingInstrID: string;
}

// 经纪公司
export interface ICThostFtdcBrokerField {
  // 经纪公司代码
  BrokerID: string;
  // 经纪公司简称
  BrokerAbbr: string;
  // 经纪公司名称
  BrokerName: string;
  // 是否活跃
  IsActive: number;
}

// 交易所交易员
export interface ICThostFtdcTraderField {
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 会员代码
  ParticipantID: string;
  // 密码
  Password: string;
  // 安装数量
  InstallCount: number;
  // 经纪公司代码
  BrokerID: string;
}

// 投资者
export interface ICThostFtdcInvestorField {
  // 投资者代码
  InvestorID: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者分组代码
  InvestorGroupID: string;
  // 投资者名称
  InvestorName: string;
  // 证件类型
  IdentifiedCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 是否活跃
  IsActive: number;
  // 联系电话
  Telephone: string;
  // 通讯地址
  Address: string;
  // 开户日期
  OpenDate: string;
  // 手机
  Mobile: string;
  // 手续费率模板代码
  CommModelID: string;
  // 保证金率模板代码
  MarginModelID: string;
}

// 交易编码
export interface ICThostFtdcTradingCodeField {
  // 投资者代码
  InvestorID: string;
  // 经纪公司代码
  BrokerID: string;
  // 交易所代码
  ExchangeID: string;
  // 客户代码
  ClientID: string;
  // 是否活跃
  IsActive: number;
  // 交易编码类型
  ClientIDType: TThostFtdcClientIDTypeType;
  // 营业部编号
  BranchID: string;
  // 业务类型
  BizType: TThostFtdcBizTypeType;
  // 投资单元代码
  InvestUnitID: string;
}

// 会员编码和经纪公司编码对照表
export interface ICThostFtdcPartBrokerField {
  // 经纪公司代码
  BrokerID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 是否活跃
  IsActive: number;
}

// 管理用户
export interface ICThostFtdcSuperUserField {
  // 用户代码
  UserID: string;
  // 用户名称
  UserName: string;
  // 密码
  Password: string;
  // 是否活跃
  IsActive: number;
}

// 管理用户功能权限
export interface ICThostFtdcSuperUserFunctionField {
  // 用户代码
  UserID: string;
  // 功能代码
  FunctionCode: TThostFtdcFunctionCodeType;
}

// 投资者组
export interface ICThostFtdcInvestorGroupField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者分组代码
  InvestorGroupID: string;
  // 投资者分组名称
  InvestorGroupName: string;
}

// 资金账户
export interface ICThostFtdcTradingAccountField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 上次质押金额
  PreMortgage: number;
  // 上次信用额度
  PreCredit: number;
  // 上次存款额
  PreDeposit: number;
  // 上次结算准备金
  PreBalance: number;
  // 上次占用的保证金
  PreMargin: number;
  // 利息基数
  InterestBase: number;
  // 利息收入
  Interest: number;
  // 入金金额
  Deposit: number;
  // 出金金额
  Withdraw: number;
  // 冻结的保证金
  FrozenMargin: number;
  // 冻结的资金
  FrozenCash: number;
  // 冻结的手续费
  FrozenCommission: number;
  // 当前保证金总额
  CurrMargin: number;
  // 资金差额
  CashIn: number;
  // 手续费
  Commission: number;
  // 平仓盈亏
  CloseProfit: number;
  // 持仓盈亏
  PositionProfit: number;
  // 期货结算准备金
  Balance: number;
  // 可用资金
  Available: number;
  // 可取资金
  WithdrawQuota: number;
  // 基本准备金
  Reserve: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 信用额度
  Credit: number;
  // 质押金额
  Mortgage: number;
  // 交易所保证金
  ExchangeMargin: number;
  // 投资者交割保证金
  DeliveryMargin: number;
  // 交易所交割保证金
  ExchangeDeliveryMargin: number;
  // 保底期货结算准备金
  ReserveBalance: number;
  // 币种代码
  CurrencyID: string;
  // 上次货币质入金额
  PreFundMortgageIn: number;
  // 上次货币质出金额
  PreFundMortgageOut: number;
  // 货币质入金额
  FundMortgageIn: number;
  // 货币质出金额
  FundMortgageOut: number;
  // 货币质押余额
  FundMortgageAvailable: number;
  // 可质押货币金额
  MortgageableFund: number;
  // 特殊产品占用保证金
  SpecProductMargin: number;
  // 特殊产品冻结保证金
  SpecProductFrozenMargin: number;
  // 特殊产品手续费
  SpecProductCommission: number;
  // 特殊产品冻结手续费
  SpecProductFrozenCommission: number;
  // 特殊产品持仓盈亏
  SpecProductPositionProfit: number;
  // 特殊产品平仓盈亏
  SpecProductCloseProfit: number;
  // 根据持仓盈亏算法计算的特殊产品持仓盈亏
  SpecProductPositionProfitByAlg: number;
  // 特殊产品交易所保证金
  SpecProductExchangeMargin: number;
  // 业务类型
  BizType: TThostFtdcBizTypeType;
  // 延时换汇冻结金额
  FrozenSwap: number;
  // 剩余换汇额度
  RemainSwap: number;
}

// 投资者持仓
export interface ICThostFtdcInvestorPositionField {
  // 保留的无效字段
  reserve1: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 持仓多空方向
  PosiDirection: TThostFtdcPosiDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 持仓日期
  PositionDate: TThostFtdcPositionDateType;
  // 上日持仓
  YdPosition: number;
  // 今日持仓
  Position: number;
  // 多头冻结
  LongFrozen: number;
  // 空头冻结
  ShortFrozen: number;
  // 开仓冻结金额
  LongFrozenAmount: number;
  // 开仓冻结金额
  ShortFrozenAmount: number;
  // 开仓量
  OpenVolume: number;
  // 平仓量
  CloseVolume: number;
  // 开仓金额
  OpenAmount: number;
  // 平仓金额
  CloseAmount: number;
  // 持仓成本
  PositionCost: number;
  // 上次占用的保证金
  PreMargin: number;
  // 占用的保证金
  UseMargin: number;
  // 冻结的保证金
  FrozenMargin: number;
  // 冻结的资金
  FrozenCash: number;
  // 冻结的手续费
  FrozenCommission: number;
  // 资金差额
  CashIn: number;
  // 手续费
  Commission: number;
  // 平仓盈亏
  CloseProfit: number;
  // 持仓盈亏
  PositionProfit: number;
  // 上次结算价
  PreSettlementPrice: number;
  // 本次结算价
  SettlementPrice: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 开仓成本
  OpenCost: number;
  // 交易所保证金
  ExchangeMargin: number;
  // 组合成交形成的持仓
  CombPosition: number;
  // 组合多头冻结
  CombLongFrozen: number;
  // 组合空头冻结
  CombShortFrozen: number;
  // 逐日盯市平仓盈亏
  CloseProfitByDate: number;
  // 逐笔对冲平仓盈亏
  CloseProfitByTrade: number;
  // 今日持仓
  TodayPosition: number;
  // 保证金率
  MarginRateByMoney: number;
  // 保证金率(按手数)
  MarginRateByVolume: number;
  // 执行冻结
  StrikeFrozen: number;
  // 执行冻结金额
  StrikeFrozenAmount: number;
  // 放弃执行冻结
  AbandonFrozen: number;
  // 交易所代码
  ExchangeID: string;
  // 执行冻结的昨仓
  YdStrikeFrozen: number;
  // 投资单元代码
  InvestUnitID: string;
  // 大商所持仓成本差值，只有大商所使用
  PositionCostOffset: number;
  // tas持仓手数
  TasPosition: number;
  // tas持仓成本
  TasPositionCost: number;
  // 合约代码
  InstrumentID: string;
}

// 合约保证金率
export interface ICThostFtdcInstrumentMarginRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 是否相对交易所收取
  IsRelative: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 合约手续费率
export interface ICThostFtdcInstrumentCommissionRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 开仓手续费率
  OpenRatioByMoney: number;
  // 开仓手续费
  OpenRatioByVolume: number;
  // 平仓手续费率
  CloseRatioByMoney: number;
  // 平仓手续费
  CloseRatioByVolume: number;
  // 平今手续费率
  CloseTodayRatioByMoney: number;
  // 平今手续费
  CloseTodayRatioByVolume: number;
  // 交易所代码
  ExchangeID: string;
  // 业务类型
  BizType: TThostFtdcBizTypeType;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 深度行情
export interface ICThostFtdcDepthMarketDataField {
  // 交易日
  TradingDay: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve2: string;
  // 最新价
  LastPrice: number;
  // 上次结算价
  PreSettlementPrice: number;
  // 昨收盘
  PreClosePrice: number;
  // 昨持仓量
  PreOpenInterest: number;
  // 今开盘
  OpenPrice: number;
  // 最高价
  HighestPrice: number;
  // 最低价
  LowestPrice: number;
  // 数量
  Volume: number;
  // 成交金额
  Turnover: number;
  // 持仓量
  OpenInterest: number;
  // 今收盘
  ClosePrice: number;
  // 本次结算价
  SettlementPrice: number;
  // 涨停板价
  UpperLimitPrice: number;
  // 跌停板价
  LowerLimitPrice: number;
  // 昨虚实度
  PreDelta: number;
  // 今虚实度
  CurrDelta: number;
  // 最后修改时间
  UpdateTime: string;
  // 最后修改毫秒
  UpdateMillisec: number;
  // 申买价一
  BidPrice1: number;
  // 申买量一
  BidVolume1: number;
  // 申卖价一
  AskPrice1: number;
  // 申卖量一
  AskVolume1: number;
  // 申买价二
  BidPrice2: number;
  // 申买量二
  BidVolume2: number;
  // 申卖价二
  AskPrice2: number;
  // 申卖量二
  AskVolume2: number;
  // 申买价三
  BidPrice3: number;
  // 申买量三
  BidVolume3: number;
  // 申卖价三
  AskPrice3: number;
  // 申卖量三
  AskVolume3: number;
  // 申买价四
  BidPrice4: number;
  // 申买量四
  BidVolume4: number;
  // 申卖价四
  AskPrice4: number;
  // 申卖量四
  AskVolume4: number;
  // 申买价五
  BidPrice5: number;
  // 申买量五
  BidVolume5: number;
  // 申卖价五
  AskPrice5: number;
  // 申卖量五
  AskVolume5: number;
  // 当日均价
  AveragePrice: number;
  // 业务日期
  ActionDay: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // 上带价
  BandingUpperPrice: number;
  // 下带价
  BandingLowerPrice: number;
}

// 投资者合约交易权限
export interface ICThostFtdcInstrumentTradingRightField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易权限
  TradingRight: TThostFtdcTradingRightType;
  // 合约代码
  InstrumentID: string;
}

// 经纪公司用户
export interface ICThostFtdcBrokerUserField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 用户名称
  UserName: string;
  // 用户类型
  UserType: TThostFtdcUserTypeType;
  // 是否活跃
  IsActive: number;
  // 是否使用令牌
  IsUsingOTP: number;
  // 是否强制终端认证
  IsAuthForce: number;
}

// 经纪公司用户口令
export interface ICThostFtdcBrokerUserPasswordField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 密码
  Password: string;
  // 上次修改时间
  LastUpdateTime: string;
  // 上次登陆时间
  LastLoginTime: string;
  // 密码过期时间
  ExpireDate: string;
  // 弱密码过期时间
  WeakExpireDate: string;
}

// 经纪公司用户功能权限
export interface ICThostFtdcBrokerUserFunctionField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 经纪公司功能代码
  BrokerFunctionCode: TThostFtdcBrokerFunctionCodeType;
}

// 交易所交易员报盘机
export interface ICThostFtdcTraderOfferField {
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 会员代码
  ParticipantID: string;
  // 密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 交易所交易员连接状态
  TraderConnectStatus: TThostFtdcTraderConnectStatusType;
  // 发出连接请求的日期
  ConnectRequestDate: string;
  // 发出连接请求的时间
  ConnectRequestTime: string;
  // 上次报告日期
  LastReportDate: string;
  // 上次报告时间
  LastReportTime: string;
  // 完成连接日期
  ConnectDate: string;
  // 完成连接时间
  ConnectTime: string;
  // 启动日期
  StartDate: string;
  // 启动时间
  StartTime: string;
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 本席位最大成交编号
  MaxTradeID: string;
  // 本席位最大报单备拷
  MaxOrderMessageReference: string;
}

// 投资者结算结果
export interface ICThostFtdcSettlementInfoField {
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 序号
  SequenceNo: number;
  // 消息正文
  Content: string;
  // 投资者帐号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
}

// 合约保证金率调整
export interface ICThostFtdcInstrumentMarginRateAdjustField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 是否相对交易所收取
  IsRelative: number;
  // 合约代码
  InstrumentID: string;
}

// 交易所保证金率
export interface ICThostFtdcExchangeMarginRateField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
}

// 交易所保证金率调整
export interface ICThostFtdcExchangeMarginRateAdjustField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 跟随交易所投资者多头保证金率
  LongMarginRatioByMoney: number;
  // 跟随交易所投资者多头保证金费
  LongMarginRatioByVolume: number;
  // 跟随交易所投资者空头保证金率
  ShortMarginRatioByMoney: number;
  // 跟随交易所投资者空头保证金费
  ShortMarginRatioByVolume: number;
  // 交易所多头保证金率
  ExchLongMarginRatioByMoney: number;
  // 交易所多头保证金费
  ExchLongMarginRatioByVolume: number;
  // 交易所空头保证金率
  ExchShortMarginRatioByMoney: number;
  // 交易所空头保证金费
  ExchShortMarginRatioByVolume: number;
  // 不跟随交易所投资者多头保证金率
  NoLongMarginRatioByMoney: number;
  // 不跟随交易所投资者多头保证金费
  NoLongMarginRatioByVolume: number;
  // 不跟随交易所投资者空头保证金率
  NoShortMarginRatioByMoney: number;
  // 不跟随交易所投资者空头保证金费
  NoShortMarginRatioByVolume: number;
  // 合约代码
  InstrumentID: string;
}

// 汇率
export interface ICThostFtdcExchangeRateField {
  // 经纪公司代码
  BrokerID: string;
  // 源币种
  FromCurrencyID: string;
  // 源币种单位数量
  FromCurrencyUnit: number;
  // 目标币种
  ToCurrencyID: string;
  // 汇率
  ExchangeRate: number;
}

// 结算引用
export interface ICThostFtdcSettlementRefField {
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
}

// 当前时间
export interface ICThostFtdcCurrentTimeField {
  // 当前日期
  CurrDate: string;
  // 当前时间
  CurrTime: string;
  // 当前时间（毫秒）
  CurrMillisec: number;
  // 业务日期
  ActionDay: string;
}

// 通讯阶段
export interface ICThostFtdcCommPhaseField {
  // 交易日
  TradingDay: string;
  // 通讯时段编号
  CommPhaseNo: number;
  // 系统编号
  SystemID: string;
}

// 登录信息
export interface ICThostFtdcLoginInfoField {
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 登录日期
  LoginDate: string;
  // 登录时间
  LoginTime: string;
  // 保留的无效字段
  reserve1: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 接口端产品信息
  InterfaceProductInfo: string;
  // 协议信息
  ProtocolInfo: string;
  // 系统名称
  SystemName: string;
  // 密码,已弃用
  PasswordDeprecated: string;
  // 最大报单引用
  MaxOrderRef: string;
  // 上期所时间
  SHFETime: string;
  // 大商所时间
  DCETime: string;
  // 郑商所时间
  CZCETime: string;
  // 中金所时间
  FFEXTime: string;
  // Mac地址
  MacAddress: string;
  // 动态密码
  OneTimePassword: string;
  // 能源中心时间
  INETime: string;
  // 查询时是否需要流控
  IsQryControl: number;
  // 登录备注
  LoginRemark: string;
  // 密码
  Password: string;
  // IP地址
  IPAddress: string;
}

// 登录信息
export interface ICThostFtdcLogoutAllField {
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 系统名称
  SystemName: string;
}

// 前置状态
export interface ICThostFtdcFrontStatusField {
  // 前置编号
  FrontID: number;
  // 上次报告日期
  LastReportDate: string;
  // 上次报告时间
  LastReportTime: string;
  // 是否活跃
  IsActive: number;
}

// 用户口令变更
export interface ICThostFtdcUserPasswordUpdateField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 原来的口令
  OldPassword: string;
  // 新的口令
  NewPassword: string;
}

// 输入报单
export interface ICThostFtdcInputOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报单引用
  OrderRef: string;
  // 用户代码
  UserID: string;
  // 报单价格条件
  OrderPriceType: TThostFtdcOrderPriceTypeType;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 组合开平标志
  CombOffsetFlag: string;
  // 组合投机套保标志
  CombHedgeFlag: string;
  // 价格
  LimitPrice: number;
  // 数量
  VolumeTotalOriginal: number;
  // 有效期类型
  TimeCondition: TThostFtdcTimeConditionType;
  // GTD日期
  GTDDate: string;
  // 成交量类型
  VolumeCondition: TThostFtdcVolumeConditionType;
  // 最小成交量
  MinVolume: number;
  // 触发条件
  ContingentCondition: TThostFtdcContingentConditionType;
  // 止损价
  StopPrice: number;
  // 强平原因
  ForceCloseReason: TThostFtdcForceCloseReasonType;
  // 自动挂起标志
  IsAutoSuspend: number;
  // 业务单元
  BusinessUnit: string;
  // 请求编号
  RequestID: number;
  // 用户强评标志
  UserForceClose: number;
  // 互换单标志
  IsSwapOrder: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 交易编码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 报单
export interface ICThostFtdcOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报单引用
  OrderRef: string;
  // 用户代码
  UserID: string;
  // 报单价格条件
  OrderPriceType: TThostFtdcOrderPriceTypeType;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 组合开平标志
  CombOffsetFlag: string;
  // 组合投机套保标志
  CombHedgeFlag: string;
  // 价格
  LimitPrice: number;
  // 数量
  VolumeTotalOriginal: number;
  // 有效期类型
  TimeCondition: TThostFtdcTimeConditionType;
  // GTD日期
  GTDDate: string;
  // 成交量类型
  VolumeCondition: TThostFtdcVolumeConditionType;
  // 最小成交量
  MinVolume: number;
  // 触发条件
  ContingentCondition: TThostFtdcContingentConditionType;
  // 止损价
  StopPrice: number;
  // 强平原因
  ForceCloseReason: TThostFtdcForceCloseReasonType;
  // 自动挂起标志
  IsAutoSuspend: number;
  // 业务单元
  BusinessUnit: string;
  // 请求编号
  RequestID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 报单提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 报单编号
  OrderSysID: string;
  // 报单来源
  OrderSource: TThostFtdcOrderSourceType;
  // 报单状态
  OrderStatus: TThostFtdcOrderStatusType;
  // 报单类型
  OrderType: TThostFtdcOrderTypeType;
  // 今成交数量
  VolumeTraded: number;
  // 剩余数量
  VolumeTotal: number;
  // 报单日期
  InsertDate: string;
  // 委托时间
  InsertTime: string;
  // 激活时间
  ActiveTime: string;
  // 挂起时间
  SuspendTime: string;
  // 最后修改时间
  UpdateTime: string;
  // 撤销时间
  CancelTime: string;
  // 最后修改交易所交易员代码
  ActiveTraderID: string;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 用户端产品信息
  UserProductInfo: string;
  // 状态信息
  StatusMsg: string;
  // 用户强评标志
  UserForceClose: number;
  // 操作用户代码
  ActiveUserID: string;
  // 经纪公司报单编号
  BrokerOrderSeq: number;
  // 相关报单
  RelativeOrderSysID: string;
  // 郑商所成交数量
  ZCETotalTradedVolume: number;
  // 互换单标志
  IsSwapOrder: number;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 保留的无效字段
  reserve3: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 交易所报单
export interface ICThostFtdcExchangeOrderField {
  // 报单价格条件
  OrderPriceType: TThostFtdcOrderPriceTypeType;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 组合开平标志
  CombOffsetFlag: string;
  // 组合投机套保标志
  CombHedgeFlag: string;
  // 价格
  LimitPrice: number;
  // 数量
  VolumeTotalOriginal: number;
  // 有效期类型
  TimeCondition: TThostFtdcTimeConditionType;
  // GTD日期
  GTDDate: string;
  // 成交量类型
  VolumeCondition: TThostFtdcVolumeConditionType;
  // 最小成交量
  MinVolume: number;
  // 触发条件
  ContingentCondition: TThostFtdcContingentConditionType;
  // 止损价
  StopPrice: number;
  // 强平原因
  ForceCloseReason: TThostFtdcForceCloseReasonType;
  // 自动挂起标志
  IsAutoSuspend: number;
  // 业务单元
  BusinessUnit: string;
  // 请求编号
  RequestID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 报单提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 报单编号
  OrderSysID: string;
  // 报单来源
  OrderSource: TThostFtdcOrderSourceType;
  // 报单状态
  OrderStatus: TThostFtdcOrderStatusType;
  // 报单类型
  OrderType: TThostFtdcOrderTypeType;
  // 今成交数量
  VolumeTraded: number;
  // 剩余数量
  VolumeTotal: number;
  // 报单日期
  InsertDate: string;
  // 委托时间
  InsertTime: string;
  // 激活时间
  ActiveTime: string;
  // 挂起时间
  SuspendTime: string;
  // 最后修改时间
  UpdateTime: string;
  // 撤销时间
  CancelTime: string;
  // 最后修改交易所交易员代码
  ActiveTraderID: string;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 营业部编号
  BranchID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 交易所报单插入失败
export interface ICThostFtdcExchangeOrderInsertErrorField {
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 输入报单操作
export interface ICThostFtdcInputOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报单操作引用
  OrderActionRef: number;
  // 报单引用
  OrderRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 价格
  LimitPrice: number;
  // 数量变化
  VolumeChange: number;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 报单操作
export interface ICThostFtdcOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报单操作引用
  OrderActionRef: number;
  // 报单引用
  OrderRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 价格
  LimitPrice: number;
  // 数量变化
  VolumeChange: number;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 状态信息
  StatusMsg: string;
  // 保留的无效字段
  reserve1: string;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 交易所报单操作
export interface ICThostFtdcExchangeOrderActionField {
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 价格
  LimitPrice: number;
  // 数量变化
  VolumeChange: number;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 营业部编号
  BranchID: string;
  // 保留的无效字段
  reserve1: string;
  // Mac地址
  MacAddress: string;
  // IP地址
  IPAddress: string;
}

// 交易所报单操作失败
export interface ICThostFtdcExchangeOrderActionErrorField {
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 交易所成交
export interface ICThostFtdcExchangeTradeField {
  // 交易所代码
  ExchangeID: string;
  // 成交编号
  TradeID: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 报单编号
  OrderSysID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 交易角色
  TradingRole: TThostFtdcTradingRoleType;
  // 保留的无效字段
  reserve1: string;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 价格
  Price: number;
  // 数量
  Volume: number;
  // 成交时期
  TradeDate: string;
  // 成交时间
  TradeTime: string;
  // 成交类型
  TradeType: TThostFtdcTradeTypeType;
  // 成交价来源
  PriceSource: TThostFtdcPriceSourceType;
  // 交易所交易员代码
  TraderID: string;
  // 本地报单编号
  OrderLocalID: string;
  // 结算会员编号
  ClearingPartID: string;
  // 业务单元
  BusinessUnit: string;
  // 序号
  SequenceNo: number;
  // 成交来源
  TradeSource: TThostFtdcTradeSourceType;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 成交
export interface ICThostFtdcTradeField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报单引用
  OrderRef: string;
  // 用户代码
  UserID: string;
  // 交易所代码
  ExchangeID: string;
  // 成交编号
  TradeID: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 报单编号
  OrderSysID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 交易角色
  TradingRole: TThostFtdcTradingRoleType;
  // 保留的无效字段
  reserve2: string;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 价格
  Price: number;
  // 数量
  Volume: number;
  // 成交时期
  TradeDate: string;
  // 成交时间
  TradeTime: string;
  // 成交类型
  TradeType: TThostFtdcTradeTypeType;
  // 成交价来源
  PriceSource: TThostFtdcPriceSourceType;
  // 交易所交易员代码
  TraderID: string;
  // 本地报单编号
  OrderLocalID: string;
  // 结算会员编号
  ClearingPartID: string;
  // 业务单元
  BusinessUnit: string;
  // 序号
  SequenceNo: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 经纪公司报单编号
  BrokerOrderSeq: number;
  // 成交来源
  TradeSource: TThostFtdcTradeSourceType;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 用户会话
export interface ICThostFtdcUserSessionField {
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 登录日期
  LoginDate: string;
  // 登录时间
  LoginTime: string;
  // 保留的无效字段
  reserve1: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 接口端产品信息
  InterfaceProductInfo: string;
  // 协议信息
  ProtocolInfo: string;
  // Mac地址
  MacAddress: string;
  // 登录备注
  LoginRemark: string;
  // IP地址
  IPAddress: string;
}

// 查询最大报单数量
export interface ICThostFtdcQryMaxOrderVolumeField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 最大允许报单数量
  MaxVolume: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 投资者结算结果确认信息
export interface ICThostFtdcSettlementInfoConfirmField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 确认日期
  ConfirmDate: string;
  // 确认时间
  ConfirmTime: string;
  // 结算编号
  SettlementID: number;
  // 投资者帐号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
}

// 出入金同步
export interface ICThostFtdcSyncDepositField {
  // 出入金流水号
  DepositSeqNo: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 入金金额
  Deposit: number;
  // 是否强制进行
  IsForce: number;
  // 币种代码
  CurrencyID: string;
  // 是否是个股期权内转
  IsFromSopt: number;
  // 资金密码
  TradingPassword: string;
}

// 货币质押同步
export interface ICThostFtdcSyncFundMortgageField {
  // 货币质押流水号
  MortgageSeqNo: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 源币种
  FromCurrencyID: string;
  // 质押金额
  MortgageAmount: number;
  // 目标币种
  ToCurrencyID: string;
}

// 经纪公司同步
export interface ICThostFtdcBrokerSyncField {
  // 经纪公司代码
  BrokerID: string;
}

// 正在同步中的投资者
export interface ICThostFtdcSyncingInvestorField {
  // 投资者代码
  InvestorID: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者分组代码
  InvestorGroupID: string;
  // 投资者名称
  InvestorName: string;
  // 证件类型
  IdentifiedCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 是否活跃
  IsActive: number;
  // 联系电话
  Telephone: string;
  // 通讯地址
  Address: string;
  // 开户日期
  OpenDate: string;
  // 手机
  Mobile: string;
  // 手续费率模板代码
  CommModelID: string;
  // 保证金率模板代码
  MarginModelID: string;
}

// 正在同步中的交易代码
export interface ICThostFtdcSyncingTradingCodeField {
  // 投资者代码
  InvestorID: string;
  // 经纪公司代码
  BrokerID: string;
  // 交易所代码
  ExchangeID: string;
  // 客户代码
  ClientID: string;
  // 是否活跃
  IsActive: number;
  // 交易编码类型
  ClientIDType: TThostFtdcClientIDTypeType;
}

// 正在同步中的投资者分组
export interface ICThostFtdcSyncingInvestorGroupField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者分组代码
  InvestorGroupID: string;
  // 投资者分组名称
  InvestorGroupName: string;
}

// 正在同步中的交易账号
export interface ICThostFtdcSyncingTradingAccountField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 上次质押金额
  PreMortgage: number;
  // 上次信用额度
  PreCredit: number;
  // 上次存款额
  PreDeposit: number;
  // 上次结算准备金
  PreBalance: number;
  // 上次占用的保证金
  PreMargin: number;
  // 利息基数
  InterestBase: number;
  // 利息收入
  Interest: number;
  // 入金金额
  Deposit: number;
  // 出金金额
  Withdraw: number;
  // 冻结的保证金
  FrozenMargin: number;
  // 冻结的资金
  FrozenCash: number;
  // 冻结的手续费
  FrozenCommission: number;
  // 当前保证金总额
  CurrMargin: number;
  // 资金差额
  CashIn: number;
  // 手续费
  Commission: number;
  // 平仓盈亏
  CloseProfit: number;
  // 持仓盈亏
  PositionProfit: number;
  // 期货结算准备金
  Balance: number;
  // 可用资金
  Available: number;
  // 可取资金
  WithdrawQuota: number;
  // 基本准备金
  Reserve: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 信用额度
  Credit: number;
  // 质押金额
  Mortgage: number;
  // 交易所保证金
  ExchangeMargin: number;
  // 投资者交割保证金
  DeliveryMargin: number;
  // 交易所交割保证金
  ExchangeDeliveryMargin: number;
  // 保底期货结算准备金
  ReserveBalance: number;
  // 币种代码
  CurrencyID: string;
  // 上次货币质入金额
  PreFundMortgageIn: number;
  // 上次货币质出金额
  PreFundMortgageOut: number;
  // 货币质入金额
  FundMortgageIn: number;
  // 货币质出金额
  FundMortgageOut: number;
  // 货币质押余额
  FundMortgageAvailable: number;
  // 可质押货币金额
  MortgageableFund: number;
  // 特殊产品占用保证金
  SpecProductMargin: number;
  // 特殊产品冻结保证金
  SpecProductFrozenMargin: number;
  // 特殊产品手续费
  SpecProductCommission: number;
  // 特殊产品冻结手续费
  SpecProductFrozenCommission: number;
  // 特殊产品持仓盈亏
  SpecProductPositionProfit: number;
  // 特殊产品平仓盈亏
  SpecProductCloseProfit: number;
  // 根据持仓盈亏算法计算的特殊产品持仓盈亏
  SpecProductPositionProfitByAlg: number;
  // 特殊产品交易所保证金
  SpecProductExchangeMargin: number;
  // 延时换汇冻结金额
  FrozenSwap: number;
  // 剩余换汇额度
  RemainSwap: number;
}

// 正在同步中的投资者持仓
export interface ICThostFtdcSyncingInvestorPositionField {
  // 保留的无效字段
  reserve1: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 持仓多空方向
  PosiDirection: TThostFtdcPosiDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 持仓日期
  PositionDate: TThostFtdcPositionDateType;
  // 上日持仓
  YdPosition: number;
  // 今日持仓
  Position: number;
  // 多头冻结
  LongFrozen: number;
  // 空头冻结
  ShortFrozen: number;
  // 开仓冻结金额
  LongFrozenAmount: number;
  // 开仓冻结金额
  ShortFrozenAmount: number;
  // 开仓量
  OpenVolume: number;
  // 平仓量
  CloseVolume: number;
  // 开仓金额
  OpenAmount: number;
  // 平仓金额
  CloseAmount: number;
  // 持仓成本
  PositionCost: number;
  // 上次占用的保证金
  PreMargin: number;
  // 占用的保证金
  UseMargin: number;
  // 冻结的保证金
  FrozenMargin: number;
  // 冻结的资金
  FrozenCash: number;
  // 冻结的手续费
  FrozenCommission: number;
  // 资金差额
  CashIn: number;
  // 手续费
  Commission: number;
  // 平仓盈亏
  CloseProfit: number;
  // 持仓盈亏
  PositionProfit: number;
  // 上次结算价
  PreSettlementPrice: number;
  // 本次结算价
  SettlementPrice: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 开仓成本
  OpenCost: number;
  // 交易所保证金
  ExchangeMargin: number;
  // 组合成交形成的持仓
  CombPosition: number;
  // 组合多头冻结
  CombLongFrozen: number;
  // 组合空头冻结
  CombShortFrozen: number;
  // 逐日盯市平仓盈亏
  CloseProfitByDate: number;
  // 逐笔对冲平仓盈亏
  CloseProfitByTrade: number;
  // 今日持仓
  TodayPosition: number;
  // 保证金率
  MarginRateByMoney: number;
  // 保证金率(按手数)
  MarginRateByVolume: number;
  // 执行冻结
  StrikeFrozen: number;
  // 执行冻结金额
  StrikeFrozenAmount: number;
  // 放弃执行冻结
  AbandonFrozen: number;
  // 交易所代码
  ExchangeID: string;
  // 执行冻结的昨仓
  YdStrikeFrozen: number;
  // 投资单元代码
  InvestUnitID: string;
  // 大商所持仓成本差值，只有大商所使用
  PositionCostOffset: number;
  // tas持仓手数
  TasPosition: number;
  // tas持仓成本
  TasPositionCost: number;
  // 合约代码
  InstrumentID: string;
}

// 正在同步中的合约保证金率
export interface ICThostFtdcSyncingInstrumentMarginRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 是否相对交易所收取
  IsRelative: number;
  // 合约代码
  InstrumentID: string;
}

// 正在同步中的合约手续费率
export interface ICThostFtdcSyncingInstrumentCommissionRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 开仓手续费率
  OpenRatioByMoney: number;
  // 开仓手续费
  OpenRatioByVolume: number;
  // 平仓手续费率
  CloseRatioByMoney: number;
  // 平仓手续费
  CloseRatioByVolume: number;
  // 平今手续费率
  CloseTodayRatioByMoney: number;
  // 平今手续费
  CloseTodayRatioByVolume: number;
  // 合约代码
  InstrumentID: string;
}

// 正在同步中的合约交易权限
export interface ICThostFtdcSyncingInstrumentTradingRightField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易权限
  TradingRight: TThostFtdcTradingRightType;
  // 合约代码
  InstrumentID: string;
}

// 查询报单
export interface ICThostFtdcQryOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 开始时间
  InsertTimeStart: string;
  // 结束时间
  InsertTimeEnd: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询成交
export interface ICThostFtdcQryTradeField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 成交编号
  TradeID: string;
  // 开始时间
  TradeTimeStart: string;
  // 结束时间
  TradeTimeEnd: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询投资者持仓
export interface ICThostFtdcQryInvestorPositionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询资金账户
export interface ICThostFtdcQryTradingAccountField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 币种代码
  CurrencyID: string;
  // 业务类型
  BizType: TThostFtdcBizTypeType;
  // 投资者帐号
  AccountID: string;
}

// 查询投资者
export interface ICThostFtdcQryInvestorField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 查询交易编码
export interface ICThostFtdcQryTradingCodeField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
  // 客户代码
  ClientID: string;
  // 交易编码类型
  ClientIDType: TThostFtdcClientIDTypeType;
  // 投资单元代码
  InvestUnitID: string;
}

// 查询投资者组
export interface ICThostFtdcQryInvestorGroupField {
  // 经纪公司代码
  BrokerID: string;
}

// 查询合约保证金率
export interface ICThostFtdcQryInstrumentMarginRateField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询手续费率
export interface ICThostFtdcQryInstrumentCommissionRateField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询合约交易权限
export interface ICThostFtdcQryInstrumentTradingRightField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 查询经纪公司
export interface ICThostFtdcQryBrokerField {
  // 经纪公司代码
  BrokerID: string;
}

// 查询交易员
export interface ICThostFtdcQryTraderField {
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 交易所交易员代码
  TraderID: string;
}

// 查询管理用户功能权限
export interface ICThostFtdcQrySuperUserFunctionField {
  // 用户代码
  UserID: string;
}

// 查询用户会话
export interface ICThostFtdcQryUserSessionField {
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 查询经纪公司会员代码
export interface ICThostFtdcQryPartBrokerField {
  // 交易所代码
  ExchangeID: string;
  // 经纪公司代码
  BrokerID: string;
  // 会员代码
  ParticipantID: string;
}

// 查询前置状态
export interface ICThostFtdcQryFrontStatusField {
  // 前置编号
  FrontID: number;
}

// 查询交易所报单
export interface ICThostFtdcQryExchangeOrderField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 查询报单操作
export interface ICThostFtdcQryOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
}

// 查询交易所报单操作
export interface ICThostFtdcQryExchangeOrderActionField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
}

// 查询管理用户
export interface ICThostFtdcQrySuperUserField {
  // 用户代码
  UserID: string;
}

// 查询交易所
export interface ICThostFtdcQryExchangeField {
  // 交易所代码
  ExchangeID: string;
}

// 查询产品
export interface ICThostFtdcQryProductField {
  // 保留的无效字段
  reserve1: string;
  // 产品类型
  ProductClass: TThostFtdcProductClassType;
  // 交易所代码
  ExchangeID: string;
  // 产品代码
  ProductID: string;
}

// 查询合约
export interface ICThostFtdcQryInstrumentField {
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve2: string;
  // 保留的无效字段
  reserve3: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // 产品代码
  ProductID: string;
}

// 查询行情
export interface ICThostFtdcQryDepthMarketDataField {
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询经纪公司用户
export interface ICThostFtdcQryBrokerUserField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 查询经纪公司用户权限
export interface ICThostFtdcQryBrokerUserFunctionField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 查询交易员报盘机
export interface ICThostFtdcQryTraderOfferField {
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 交易所交易员代码
  TraderID: string;
}

// 查询出入金流水
export interface ICThostFtdcQrySyncDepositField {
  // 经纪公司代码
  BrokerID: string;
  // 出入金流水号
  DepositSeqNo: string;
}

// 查询投资者结算结果
export interface ICThostFtdcQrySettlementInfoField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易日
  TradingDay: string;
  // 投资者帐号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
}

// 查询交易所保证金率
export interface ICThostFtdcQryExchangeMarginRateField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询交易所调整保证金率
export interface ICThostFtdcQryExchangeMarginRateAdjustField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 合约代码
  InstrumentID: string;
}

// 查询汇率
export interface ICThostFtdcQryExchangeRateField {
  // 经纪公司代码
  BrokerID: string;
  // 源币种
  FromCurrencyID: string;
  // 目标币种
  ToCurrencyID: string;
}

// 查询货币质押流水
export interface ICThostFtdcQrySyncFundMortgageField {
  // 经纪公司代码
  BrokerID: string;
  // 货币质押流水号
  MortgageSeqNo: string;
}

// 查询报单
export interface ICThostFtdcQryHisOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 开始时间
  InsertTimeStart: string;
  // 结束时间
  InsertTimeEnd: string;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 合约代码
  InstrumentID: string;
}

// 当前期权合约最小保证金
export interface ICThostFtdcOptionInstrMiniMarginField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 单位（手）期权合约最小保证金
  MinMargin: number;
  // 取值方式
  ValueMethod: TThostFtdcValueMethodType;
  // 是否跟随交易所收取
  IsRelative: number;
  // 合约代码
  InstrumentID: string;
}

// 当前期权合约保证金调整系数
export interface ICThostFtdcOptionInstrMarginAdjustField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机空头保证金调整系数
  SShortMarginRatioByMoney: number;
  // 投机空头保证金调整系数
  SShortMarginRatioByVolume: number;
  // 保值空头保证金调整系数
  HShortMarginRatioByMoney: number;
  // 保值空头保证金调整系数
  HShortMarginRatioByVolume: number;
  // 套利空头保证金调整系数
  AShortMarginRatioByMoney: number;
  // 套利空头保证金调整系数
  AShortMarginRatioByVolume: number;
  // 是否跟随交易所收取
  IsRelative: number;
  // 做市商空头保证金调整系数
  MShortMarginRatioByMoney: number;
  // 做市商空头保证金调整系数
  MShortMarginRatioByVolume: number;
  // 合约代码
  InstrumentID: string;
}

// 当前期权合约手续费的详细内容
export interface ICThostFtdcOptionInstrCommRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 开仓手续费率
  OpenRatioByMoney: number;
  // 开仓手续费
  OpenRatioByVolume: number;
  // 平仓手续费率
  CloseRatioByMoney: number;
  // 平仓手续费
  CloseRatioByVolume: number;
  // 平今手续费率
  CloseTodayRatioByMoney: number;
  // 平今手续费
  CloseTodayRatioByVolume: number;
  // 执行手续费率
  StrikeRatioByMoney: number;
  // 执行手续费
  StrikeRatioByVolume: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 期权交易成本
export interface ICThostFtdcOptionInstrTradeCostField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 期权合约保证金不变部分
  FixedMargin: number;
  // 期权合约最小保证金
  MiniMargin: number;
  // 期权合约权利金
  Royalty: number;
  // 交易所期权合约保证金不变部分
  ExchFixedMargin: number;
  // 交易所期权合约最小保证金
  ExchMiniMargin: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 期权交易成本查询
export interface ICThostFtdcQryOptionInstrTradeCostField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 期权合约报价
  InputPrice: number;
  // 标的价格,填0则用昨结算价
  UnderlyingPrice: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 期权手续费率查询
export interface ICThostFtdcQryOptionInstrCommRateField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 股指现货指数
export interface ICThostFtdcIndexPriceField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 指数现货收盘价
  ClosePrice: number;
  // 合约代码
  InstrumentID: string;
}

// 输入的执行宣告
export interface ICThostFtdcInputExecOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 执行宣告引用
  ExecOrderRef: string;
  // 用户代码
  UserID: string;
  // 数量
  Volume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 执行类型
  ActionType: TThostFtdcActionTypeType;
  // 保留头寸申请的持仓方向
  PosiDirection: TThostFtdcPosiDirectionType;
  // 期权行权后是否保留期货头寸的标记,该字段已废弃
  ReservePositionFlag: TThostFtdcExecOrderPositionFlagType;
  // 期权行权后生成的头寸是否自动平仓
  CloseFlag: TThostFtdcExecOrderCloseFlagType;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 交易编码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 输入执行宣告操作
export interface ICThostFtdcInputExecOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 执行宣告操作引用
  ExecOrderActionRef: number;
  // 执行宣告引用
  ExecOrderRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 执行宣告操作编号
  ExecOrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 执行宣告
export interface ICThostFtdcExecOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 执行宣告引用
  ExecOrderRef: string;
  // 用户代码
  UserID: string;
  // 数量
  Volume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 执行类型
  ActionType: TThostFtdcActionTypeType;
  // 保留头寸申请的持仓方向
  PosiDirection: TThostFtdcPosiDirectionType;
  // 期权行权后是否保留期货头寸的标记,该字段已废弃
  ReservePositionFlag: TThostFtdcExecOrderPositionFlagType;
  // 期权行权后生成的头寸是否自动平仓
  CloseFlag: TThostFtdcExecOrderCloseFlagType;
  // 本地执行宣告编号
  ExecOrderLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 执行宣告提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 执行宣告编号
  ExecOrderSysID: string;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 撤销时间
  CancelTime: string;
  // 执行结果
  ExecResult: TThostFtdcExecResultType;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 用户端产品信息
  UserProductInfo: string;
  // 状态信息
  StatusMsg: string;
  // 操作用户代码
  ActiveUserID: string;
  // 经纪公司报单编号
  BrokerExecOrderSeq: number;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 保留的无效字段
  reserve3: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 执行宣告操作
export interface ICThostFtdcExecOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 执行宣告操作引用
  ExecOrderActionRef: number;
  // 执行宣告引用
  ExecOrderRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 执行宣告操作编号
  ExecOrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地执行宣告编号
  ExecOrderLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 执行类型
  ActionType: TThostFtdcActionTypeType;
  // 状态信息
  StatusMsg: string;
  // 保留的无效字段
  reserve1: string;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 执行宣告查询
export interface ICThostFtdcQryExecOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 执行宣告编号
  ExecOrderSysID: string;
  // 开始时间
  InsertTimeStart: string;
  // 结束时间
  InsertTimeEnd: string;
  // 合约代码
  InstrumentID: string;
}

// 交易所执行宣告信息
export interface ICThostFtdcExchangeExecOrderField {
  // 数量
  Volume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 执行类型
  ActionType: TThostFtdcActionTypeType;
  // 保留头寸申请的持仓方向
  PosiDirection: TThostFtdcPosiDirectionType;
  // 期权行权后是否保留期货头寸的标记,该字段已废弃
  ReservePositionFlag: TThostFtdcExecOrderPositionFlagType;
  // 期权行权后生成的头寸是否自动平仓
  CloseFlag: TThostFtdcExecOrderCloseFlagType;
  // 本地执行宣告编号
  ExecOrderLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 执行宣告提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 执行宣告编号
  ExecOrderSysID: string;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 撤销时间
  CancelTime: string;
  // 执行结果
  ExecResult: TThostFtdcExecResultType;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 营业部编号
  BranchID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 交易所执行宣告查询
export interface ICThostFtdcQryExchangeExecOrderField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 执行宣告操作查询
export interface ICThostFtdcQryExecOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
}

// 交易所执行宣告操作
export interface ICThostFtdcExchangeExecOrderActionField {
  // 交易所代码
  ExchangeID: string;
  // 执行宣告操作编号
  ExecOrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地执行宣告编号
  ExecOrderLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 执行类型
  ActionType: TThostFtdcActionTypeType;
  // 营业部编号
  BranchID: string;
  // 保留的无效字段
  reserve1: string;
  // Mac地址
  MacAddress: string;
  // 保留的无效字段
  reserve2: string;
  // 数量
  Volume: number;
  // IP地址
  IPAddress: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 交易所执行宣告操作查询
export interface ICThostFtdcQryExchangeExecOrderActionField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
}

// 错误执行宣告
export interface ICThostFtdcErrExecOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 执行宣告引用
  ExecOrderRef: string;
  // 用户代码
  UserID: string;
  // 数量
  Volume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 执行类型
  ActionType: TThostFtdcActionTypeType;
  // 保留头寸申请的持仓方向
  PosiDirection: TThostFtdcPosiDirectionType;
  // 期权行权后是否保留期货头寸的标记,该字段已废弃
  ReservePositionFlag: TThostFtdcExecOrderPositionFlagType;
  // 期权行权后生成的头寸是否自动平仓
  CloseFlag: TThostFtdcExecOrderCloseFlagType;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 交易编码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 查询错误执行宣告
export interface ICThostFtdcQryErrExecOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 错误执行宣告操作
export interface ICThostFtdcErrExecOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 执行宣告操作引用
  ExecOrderActionRef: number;
  // 执行宣告引用
  ExecOrderRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 执行宣告操作编号
  ExecOrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 查询错误执行宣告操作
export interface ICThostFtdcQryErrExecOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 投资者期权合约交易权限
export interface ICThostFtdcOptionInstrTradingRightField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 交易权限
  TradingRight: TThostFtdcTradingRightType;
  // 合约代码
  InstrumentID: string;
}

// 查询期权合约交易权限
export interface ICThostFtdcQryOptionInstrTradingRightField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 合约代码
  InstrumentID: string;
}

// 输入的询价
export interface ICThostFtdcInputForQuoteField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 询价引用
  ForQuoteRef: string;
  // 用户代码
  UserID: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 询价
export interface ICThostFtdcForQuoteField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 询价引用
  ForQuoteRef: string;
  // 用户代码
  UserID: string;
  // 本地询价编号
  ForQuoteLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 询价状态
  ForQuoteStatus: TThostFtdcForQuoteStatusType;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 状态信息
  StatusMsg: string;
  // 操作用户代码
  ActiveUserID: string;
  // 经纪公司询价编号
  BrokerForQutoSeq: number;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve3: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 询价查询
export interface ICThostFtdcQryForQuoteField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 开始时间
  InsertTimeStart: string;
  // 结束时间
  InsertTimeEnd: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 交易所询价信息
export interface ICThostFtdcExchangeForQuoteField {
  // 本地询价编号
  ForQuoteLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 询价状态
  ForQuoteStatus: TThostFtdcForQuoteStatusType;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 交易所询价查询
export interface ICThostFtdcQryExchangeForQuoteField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 输入的报价
export interface ICThostFtdcInputQuoteField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报价引用
  QuoteRef: string;
  // 用户代码
  UserID: string;
  // 卖价格
  AskPrice: number;
  // 买价格
  BidPrice: number;
  // 卖数量
  AskVolume: number;
  // 买数量
  BidVolume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 卖开平标志
  AskOffsetFlag: TThostFtdcOffsetFlagType;
  // 买开平标志
  BidOffsetFlag: TThostFtdcOffsetFlagType;
  // 卖投机套保标志
  AskHedgeFlag: TThostFtdcHedgeFlagType;
  // 买投机套保标志
  BidHedgeFlag: TThostFtdcHedgeFlagType;
  // 衍生卖报单引用
  AskOrderRef: string;
  // 衍生买报单引用
  BidOrderRef: string;
  // 应价编号
  ForQuoteSysID: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 交易编码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
  // 被顶单编号
  ReplaceSysID: string;
}

// 输入报价操作
export interface ICThostFtdcInputQuoteActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报价操作引用
  QuoteActionRef: number;
  // 报价引用
  QuoteRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 报价操作编号
  QuoteSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // 投资单元代码
  InvestUnitID: string;
  // 交易编码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 报价
export interface ICThostFtdcQuoteField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报价引用
  QuoteRef: string;
  // 用户代码
  UserID: string;
  // 卖价格
  AskPrice: number;
  // 买价格
  BidPrice: number;
  // 卖数量
  AskVolume: number;
  // 买数量
  BidVolume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 卖开平标志
  AskOffsetFlag: TThostFtdcOffsetFlagType;
  // 买开平标志
  BidOffsetFlag: TThostFtdcOffsetFlagType;
  // 卖投机套保标志
  AskHedgeFlag: TThostFtdcHedgeFlagType;
  // 买投机套保标志
  BidHedgeFlag: TThostFtdcHedgeFlagType;
  // 本地报价编号
  QuoteLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 报价提示序号
  NotifySequence: number;
  // 报价提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 报价编号
  QuoteSysID: string;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 撤销时间
  CancelTime: string;
  // 报价状态
  QuoteStatus: TThostFtdcOrderStatusType;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 卖方报单编号
  AskOrderSysID: string;
  // 买方报单编号
  BidOrderSysID: string;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 用户端产品信息
  UserProductInfo: string;
  // 状态信息
  StatusMsg: string;
  // 操作用户代码
  ActiveUserID: string;
  // 经纪公司报价编号
  BrokerQuoteSeq: number;
  // 衍生卖报单引用
  AskOrderRef: string;
  // 衍生买报单引用
  BidOrderRef: string;
  // 应价编号
  ForQuoteSysID: string;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 保留的无效字段
  reserve3: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
  // 被顶单编号
  ReplaceSysID: string;
}

// 报价操作
export interface ICThostFtdcQuoteActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报价操作引用
  QuoteActionRef: number;
  // 报价引用
  QuoteRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 报价操作编号
  QuoteSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地报价编号
  QuoteLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 状态信息
  StatusMsg: string;
  // 保留的无效字段
  reserve1: string;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 报价查询
export interface ICThostFtdcQryQuoteField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 报价编号
  QuoteSysID: string;
  // 开始时间
  InsertTimeStart: string;
  // 结束时间
  InsertTimeEnd: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 交易所报价信息
export interface ICThostFtdcExchangeQuoteField {
  // 卖价格
  AskPrice: number;
  // 买价格
  BidPrice: number;
  // 卖数量
  AskVolume: number;
  // 买数量
  BidVolume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 卖开平标志
  AskOffsetFlag: TThostFtdcOffsetFlagType;
  // 买开平标志
  BidOffsetFlag: TThostFtdcOffsetFlagType;
  // 卖投机套保标志
  AskHedgeFlag: TThostFtdcHedgeFlagType;
  // 买投机套保标志
  BidHedgeFlag: TThostFtdcHedgeFlagType;
  // 本地报价编号
  QuoteLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 报价提示序号
  NotifySequence: number;
  // 报价提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 报价编号
  QuoteSysID: string;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 撤销时间
  CancelTime: string;
  // 报价状态
  QuoteStatus: TThostFtdcOrderStatusType;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 卖方报单编号
  AskOrderSysID: string;
  // 买方报单编号
  BidOrderSysID: string;
  // 应价编号
  ForQuoteSysID: string;
  // 营业部编号
  BranchID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 交易所报价查询
export interface ICThostFtdcQryExchangeQuoteField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 报价操作查询
export interface ICThostFtdcQryQuoteActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
}

// 交易所报价操作
export interface ICThostFtdcExchangeQuoteActionField {
  // 交易所代码
  ExchangeID: string;
  // 报价操作编号
  QuoteSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地报价编号
  QuoteLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // Mac地址
  MacAddress: string;
  // IP地址
  IPAddress: string;
}

// 交易所报价操作查询
export interface ICThostFtdcQryExchangeQuoteActionField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
}

// 期权合约delta值
export interface ICThostFtdcOptionInstrDeltaField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // Delta值
  Delta: number;
  // 合约代码
  InstrumentID: string;
}

// 发给做市商的询价请求
export interface ICThostFtdcForQuoteRspField {
  // 交易日
  TradingDay: string;
  // 保留的无效字段
  reserve1: string;
  // 询价编号
  ForQuoteSysID: string;
  // 询价时间
  ForQuoteTime: string;
  // 业务日期
  ActionDay: string;
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
}

// 当前期权合约执行偏移值的详细内容
export interface ICThostFtdcStrikeOffsetField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 执行偏移值
  Offset: number;
  // 执行偏移类型
  OffsetType: TThostFtdcStrikeOffsetTypeType;
  // 合约代码
  InstrumentID: string;
}

// 期权执行偏移值查询
export interface ICThostFtdcQryStrikeOffsetField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 输入批量报单操作
export interface ICThostFtdcInputBatchOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报单操作引用
  OrderActionRef: number;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 用户代码
  UserID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve1: string;
  // Mac地址
  MacAddress: string;
  // IP地址
  IPAddress: string;
}

// 批量报单操作
export interface ICThostFtdcBatchOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报单操作引用
  OrderActionRef: number;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 状态信息
  StatusMsg: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve1: string;
  // Mac地址
  MacAddress: string;
  // IP地址
  IPAddress: string;
}

// 交易所批量报单操作
export interface ICThostFtdcExchangeBatchOrderActionField {
  // 交易所代码
  ExchangeID: string;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // Mac地址
  MacAddress: string;
  // IP地址
  IPAddress: string;
}

// 查询批量报单操作
export interface ICThostFtdcQryBatchOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
}

// 组合合约安全系数
export interface ICThostFtdcCombInstrumentGuardField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  GuarantRatio: number;
  // 合约代码
  ExchangeID: string;
}

// 组合合约安全系数查询
export interface ICThostFtdcQryCombInstrumentGuardField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
}

// 输入的申请组合
export interface ICThostFtdcInputCombActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 组合引用
  CombActionRef: string;
  // 用户代码
  UserID: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 数量
  Volume: number;
  // 组合指令方向
  CombDirection: TThostFtdcCombDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 投资单元代码
  InvestUnitID: string;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 申请组合
export interface ICThostFtdcCombActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 组合引用
  CombActionRef: string;
  // 用户代码
  UserID: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 数量
  Volume: number;
  // 组合指令方向
  CombDirection: TThostFtdcCombDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 本地申请组合编号
  ActionLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 组合状态
  ActionStatus: TThostFtdcOrderActionStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 序号
  SequenceNo: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 用户端产品信息
  UserProductInfo: string;
  // 状态信息
  StatusMsg: string;
  // 保留的无效字段
  reserve3: string;
  // Mac地址
  MacAddress: string;
  // 组合编号
  ComTradeID: string;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 申请组合查询
export interface ICThostFtdcQryCombActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 交易所申请组合信息
export interface ICThostFtdcExchangeCombActionField {
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 数量
  Volume: number;
  // 组合指令方向
  CombDirection: TThostFtdcCombDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 本地申请组合编号
  ActionLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 组合状态
  ActionStatus: TThostFtdcOrderActionStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 序号
  SequenceNo: number;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 组合编号
  ComTradeID: string;
  // 营业部编号
  BranchID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 交易所申请组合查询
export interface ICThostFtdcQryExchangeCombActionField {
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 产品报价汇率
export interface ICThostFtdcProductExchRateField {
  // 保留的无效字段
  reserve1: string;
  // 报价币种类型
  QuoteCurrencyID: string;
  // 汇率
  ExchangeRate: number;
  // 交易所代码
  ExchangeID: string;
  // 产品代码
  ProductID: string;
}

// 产品报价汇率查询
export interface ICThostFtdcQryProductExchRateField {
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 产品代码
  ProductID: string;
}

// 查询询价价差参数
export interface ICThostFtdcQryForQuoteParamField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
}

// 询价价差参数
export interface ICThostFtdcForQuoteParamField {
  // 经纪公司代码
  BrokerID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 最新价
  LastPrice: number;
  // 价差
  PriceInterval: number;
  // 合约代码
  InstrumentID: string;
}

// 当前做市商期权合约手续费的详细内容
export interface ICThostFtdcMMOptionInstrCommRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 开仓手续费率
  OpenRatioByMoney: number;
  // 开仓手续费
  OpenRatioByVolume: number;
  // 平仓手续费率
  CloseRatioByMoney: number;
  // 平仓手续费
  CloseRatioByVolume: number;
  // 平今手续费率
  CloseTodayRatioByMoney: number;
  // 平今手续费
  CloseTodayRatioByVolume: number;
  // 执行手续费率
  StrikeRatioByMoney: number;
  // 执行手续费
  StrikeRatioByVolume: number;
  // 合约代码
  InstrumentID: string;
}

// 做市商期权手续费率查询
export interface ICThostFtdcQryMMOptionInstrCommRateField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 做市商合约手续费率
export interface ICThostFtdcMMInstrumentCommissionRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 开仓手续费率
  OpenRatioByMoney: number;
  // 开仓手续费
  OpenRatioByVolume: number;
  // 平仓手续费率
  CloseRatioByMoney: number;
  // 平仓手续费
  CloseRatioByVolume: number;
  // 平今手续费率
  CloseTodayRatioByMoney: number;
  // 平今手续费
  CloseTodayRatioByVolume: number;
  // 合约代码
  InstrumentID: string;
}

// 查询做市商合约手续费率
export interface ICThostFtdcQryMMInstrumentCommissionRateField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 当前报单手续费的详细内容
export interface ICThostFtdcInstrumentOrderCommRateField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 报单手续费
  OrderCommByVolume: number;
  // 撤单手续费
  OrderActionCommByVolume: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
  // 报单手续费
  OrderCommByTrade: number;
  // 撤单手续费
  OrderActionCommByTrade: number;
}

// 报单手续费率查询
export interface ICThostFtdcQryInstrumentOrderCommRateField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 交易参数
export interface ICThostFtdcTradeParamField {
  // 经纪公司代码
  BrokerID: string;
  // 参数代码
  TradeParamID: TThostFtdcTradeParamIDType;
  // 参数代码值
  TradeParamValue: string;
  // 备注
  Memo: string;
}

// 合约保证金率调整
export interface ICThostFtdcInstrumentMarginRateULField {
  // 保留的无效字段
  reserve1: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 合约代码
  InstrumentID: string;
}

// 期货持仓限制参数
export interface ICThostFtdcFutureLimitPosiParamField {
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 当日投机开仓数量限制
  SpecOpenVolume: number;
  // 当日套利开仓数量限制
  ArbiOpenVolume: number;
  // 当日投机+套利开仓数量限制
  OpenVolume: number;
  // 产品代码
  ProductID: string;
}

// 禁止登录IP
export interface ICThostFtdcLoginForbiddenIPField {
  // 保留的无效字段
  reserve1: string;
  // IP地址
  IPAddress: string;
}

// IP列表
export interface ICThostFtdcIPListField {
  // 保留的无效字段
  reserve1: string;
  // 是否白名单
  IsWhite: number;
  // IP地址
  IPAddress: string;
}

// 输入的期权自对冲
export interface ICThostFtdcInputOptionSelfCloseField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 期权自对冲引用
  OptionSelfCloseRef: string;
  // 用户代码
  UserID: string;
  // 数量
  Volume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 期权行权的头寸是否自对冲
  OptSelfCloseFlag: TThostFtdcOptSelfCloseFlagType;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 交易编码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 输入期权自对冲操作
export interface ICThostFtdcInputOptionSelfCloseActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 期权自对冲操作引用
  OptionSelfCloseActionRef: number;
  // 期权自对冲引用
  OptionSelfCloseRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 期权自对冲操作编号
  OptionSelfCloseSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 期权自对冲
export interface ICThostFtdcOptionSelfCloseField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 期权自对冲引用
  OptionSelfCloseRef: string;
  // 用户代码
  UserID: string;
  // 数量
  Volume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 期权行权的头寸是否自对冲
  OptSelfCloseFlag: TThostFtdcOptSelfCloseFlagType;
  // 本地期权自对冲编号
  OptionSelfCloseLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 期权自对冲提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 期权自对冲编号
  OptionSelfCloseSysID: string;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 撤销时间
  CancelTime: string;
  // 自对冲结果
  ExecResult: TThostFtdcExecResultType;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 用户端产品信息
  UserProductInfo: string;
  // 状态信息
  StatusMsg: string;
  // 操作用户代码
  ActiveUserID: string;
  // 经纪公司报单编号
  BrokerOptionSelfCloseSeq: number;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 保留的无效字段
  reserve3: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 期权自对冲操作
export interface ICThostFtdcOptionSelfCloseActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 期权自对冲操作引用
  OptionSelfCloseActionRef: number;
  // 期权自对冲引用
  OptionSelfCloseRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 期权自对冲操作编号
  OptionSelfCloseSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地期权自对冲编号
  OptionSelfCloseLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 状态信息
  StatusMsg: string;
  // 保留的无效字段
  reserve1: string;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 期权自对冲查询
export interface ICThostFtdcQryOptionSelfCloseField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 期权自对冲编号
  OptionSelfCloseSysID: string;
  // 开始时间
  InsertTimeStart: string;
  // 结束时间
  InsertTimeEnd: string;
  // 合约代码
  InstrumentID: string;
}

// 交易所期权自对冲信息
export interface ICThostFtdcExchangeOptionSelfCloseField {
  // 数量
  Volume: number;
  // 请求编号
  RequestID: number;
  // 业务单元
  BusinessUnit: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 期权行权的头寸是否自对冲
  OptSelfCloseFlag: TThostFtdcOptSelfCloseFlagType;
  // 本地期权自对冲编号
  OptionSelfCloseLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 期权自对冲提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 期权自对冲编号
  OptionSelfCloseSysID: string;
  // 报单日期
  InsertDate: string;
  // 插入时间
  InsertTime: string;
  // 撤销时间
  CancelTime: string;
  // 自对冲结果
  ExecResult: TThostFtdcExecResultType;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 营业部编号
  BranchID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 期权自对冲操作查询
export interface ICThostFtdcQryOptionSelfCloseActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
}

// 交易所期权自对冲操作
export interface ICThostFtdcExchangeOptionSelfCloseActionField {
  // 交易所代码
  ExchangeID: string;
  // 期权自对冲操作编号
  OptionSelfCloseSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地期权自对冲编号
  OptionSelfCloseLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 营业部编号
  BranchID: string;
  // 保留的无效字段
  reserve1: string;
  // Mac地址
  MacAddress: string;
  // 保留的无效字段
  reserve2: string;
  // 期权行权的头寸是否自对冲
  OptSelfCloseFlag: TThostFtdcOptSelfCloseFlagType;
  // IP地址
  IPAddress: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 延时换汇同步
export interface ICThostFtdcSyncDelaySwapField {
  // 换汇流水号
  DelaySwapSeqNo: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 源币种
  FromCurrencyID: string;
  // 源金额
  FromAmount: number;
  // 源换汇冻结金额(可用冻结)
  FromFrozenSwap: number;
  // 源剩余换汇额度(可提冻结)
  FromRemainSwap: number;
  // 目标币种
  ToCurrencyID: string;
  // 目标金额
  ToAmount: number;
  // 是否手工换汇
  IsManualSwap: number;
  // 是否将所有外币的剩余换汇额度设置为0
  IsAllRemainSetZero: number;
}

// 查询延时换汇同步
export interface ICThostFtdcQrySyncDelaySwapField {
  // 经纪公司代码
  BrokerID: string;
  // 延时换汇流水号
  DelaySwapSeqNo: string;
}

// 投资单元
export interface ICThostFtdcInvestUnitField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 投资者单元名称
  InvestorUnitName: string;
  // 投资者分组代码
  InvestorGroupID: string;
  // 手续费率模板代码
  CommModelID: string;
  // 保证金率模板代码
  MarginModelID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
}

// 查询投资单元
export interface ICThostFtdcQryInvestUnitField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投资单元代码
  InvestUnitID: string;
}

// 二级代理商资金校验模式
export interface ICThostFtdcSecAgentCheckModeField {
  // 投资者代码
  InvestorID: string;
  // 经纪公司代码
  BrokerID: string;
  // 币种
  CurrencyID: string;
  // 境外中介机构资金帐号
  BrokerSecAgentID: string;
  // 是否需要校验自己的资金账户
  CheckSelfAccount: number;
}

// 二级代理商信息
export interface ICThostFtdcSecAgentTradeInfoField {
  // 经纪公司代码
  BrokerID: string;
  // 境外中介机构资金帐号
  BrokerSecAgentID: string;
  // 投资者代码
  InvestorID: string;
  // 二级代理商姓名
  LongCustomerName: string;
}

// 市场行情
export interface ICThostFtdcMarketDataField {
  // 交易日
  TradingDay: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve2: string;
  // 最新价
  LastPrice: number;
  // 上次结算价
  PreSettlementPrice: number;
  // 昨收盘
  PreClosePrice: number;
  // 昨持仓量
  PreOpenInterest: number;
  // 今开盘
  OpenPrice: number;
  // 最高价
  HighestPrice: number;
  // 最低价
  LowestPrice: number;
  // 数量
  Volume: number;
  // 成交金额
  Turnover: number;
  // 持仓量
  OpenInterest: number;
  // 今收盘
  ClosePrice: number;
  // 本次结算价
  SettlementPrice: number;
  // 涨停板价
  UpperLimitPrice: number;
  // 跌停板价
  LowerLimitPrice: number;
  // 昨虚实度
  PreDelta: number;
  // 今虚实度
  CurrDelta: number;
  // 最后修改时间
  UpdateTime: string;
  // 最后修改毫秒
  UpdateMillisec: number;
  // 业务日期
  ActionDay: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 行情基础属性
export interface ICThostFtdcMarketDataBaseField {
  // 交易日
  TradingDay: string;
  // 上次结算价
  PreSettlementPrice: number;
  // 昨收盘
  PreClosePrice: number;
  // 昨持仓量
  PreOpenInterest: number;
  // 昨虚实度
  PreDelta: number;
}

// 行情静态属性
export interface ICThostFtdcMarketDataStaticField {
  // 今开盘
  OpenPrice: number;
  // 最高价
  HighestPrice: number;
  // 最低价
  LowestPrice: number;
  // 今收盘
  ClosePrice: number;
  // 涨停板价
  UpperLimitPrice: number;
  // 跌停板价
  LowerLimitPrice: number;
  // 本次结算价
  SettlementPrice: number;
  // 今虚实度
  CurrDelta: number;
}

// 行情最新成交属性
export interface ICThostFtdcMarketDataLastMatchField {
  // 最新价
  LastPrice: number;
  // 数量
  Volume: number;
  // 成交金额
  Turnover: number;
  // 持仓量
  OpenInterest: number;
}

// 行情最优价属性
export interface ICThostFtdcMarketDataBestPriceField {
  // 申买价一
  BidPrice1: number;
  // 申买量一
  BidVolume1: number;
  // 申卖价一
  AskPrice1: number;
  // 申卖量一
  AskVolume1: number;
}

// 行情申买二、三属性
export interface ICThostFtdcMarketDataBid23Field {
  // 申买价二
  BidPrice2: number;
  // 申买量二
  BidVolume2: number;
  // 申买价三
  BidPrice3: number;
  // 申买量三
  BidVolume3: number;
}

// 行情申卖二、三属性
export interface ICThostFtdcMarketDataAsk23Field {
  // 申卖价二
  AskPrice2: number;
  // 申卖量二
  AskVolume2: number;
  // 申卖价三
  AskPrice3: number;
  // 申卖量三
  AskVolume3: number;
}

// 行情申买四、五属性
export interface ICThostFtdcMarketDataBid45Field {
  // 申买价四
  BidPrice4: number;
  // 申买量四
  BidVolume4: number;
  // 申买价五
  BidPrice5: number;
  // 申买量五
  BidVolume5: number;
}

// 行情申卖四、五属性
export interface ICThostFtdcMarketDataAsk45Field {
  // 申卖价四
  AskPrice4: number;
  // 申卖量四
  AskVolume4: number;
  // 申卖价五
  AskPrice5: number;
  // 申卖量五
  AskVolume5: number;
}

// 行情更新时间属性
export interface ICThostFtdcMarketDataUpdateTimeField {
  // 保留的无效字段
  reserve1: string;
  // 最后修改时间
  UpdateTime: string;
  // 最后修改毫秒
  UpdateMillisec: number;
  // 业务日期
  ActionDay: string;
  // 合约代码
  InstrumentID: string;
}

// 行情上下带价
export interface ICThostFtdcMarketDataBandingPriceField {
  // 上带价
  BandingUpperPrice: number;
  // 下带价
  BandingLowerPrice: number;
}

// 行情交易所代码属性
export interface ICThostFtdcMarketDataExchangeField {
  // 交易所代码
  ExchangeID: string;
}

// 指定的合约
export interface ICThostFtdcSpecificInstrumentField {
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 合约状态
export interface ICThostFtdcInstrumentStatusField {
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve1: string;
  // 结算组代码
  SettlementGroupID: string;
  // 保留的无效字段
  reserve2: string;
  // 合约交易状态
  InstrumentStatus: TThostFtdcInstrumentStatusType;
  // 交易阶段编号
  TradingSegmentSN: number;
  // 进入本状态时间
  EnterTime: string;
  // 进入本状态原因
  EnterReason: TThostFtdcInstStatusEnterReasonType;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询合约状态
export interface ICThostFtdcQryInstrumentStatusField {
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
}

// 投资者账户
export interface ICThostFtdcInvestorAccountField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投资者帐号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
}

// 浮动盈亏算法
export interface ICThostFtdcPositionProfitAlgorithmField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 盈亏算法
  Algorithm: TThostFtdcAlgorithmType;
  // 备注
  Memo: string;
  // 币种代码
  CurrencyID: string;
}

// 会员资金折扣
export interface ICThostFtdcDiscountField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 投资者代码
  InvestorID: string;
  // 资金折扣比例
  Discount: number;
}

// 查询转帐银行
export interface ICThostFtdcQryTransferBankField {
  // 银行代码
  BankID: string;
  // 银行分中心代码
  BankBrchID: string;
}

// 转帐银行
export interface ICThostFtdcTransferBankField {
  // 银行代码
  BankID: string;
  // 银行分中心代码
  BankBrchID: string;
  // 银行名称
  BankName: string;
  // 是否活跃
  IsActive: number;
}

// 查询投资者持仓明细
export interface ICThostFtdcQryInvestorPositionDetailField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 投资者持仓明细
export interface ICThostFtdcInvestorPositionDetailField {
  // 保留的无效字段
  reserve1: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 买卖
  Direction: TThostFtdcDirectionType;
  // 开仓日期
  OpenDate: string;
  // 成交编号
  TradeID: string;
  // 数量
  Volume: number;
  // 开仓价
  OpenPrice: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 成交类型
  TradeType: TThostFtdcTradeTypeType;
  // 保留的无效字段
  reserve2: string;
  // 交易所代码
  ExchangeID: string;
  // 逐日盯市平仓盈亏
  CloseProfitByDate: number;
  // 逐笔对冲平仓盈亏
  CloseProfitByTrade: number;
  // 逐日盯市持仓盈亏
  PositionProfitByDate: number;
  // 逐笔对冲持仓盈亏
  PositionProfitByTrade: number;
  // 投资者保证金
  Margin: number;
  // 交易所保证金
  ExchMargin: number;
  // 保证金率
  MarginRateByMoney: number;
  // 保证金率(按手数)
  MarginRateByVolume: number;
  // 昨结算价
  LastSettlementPrice: number;
  // 结算价
  SettlementPrice: number;
  // 平仓量
  CloseVolume: number;
  // 平仓金额
  CloseAmount: number;
  // 先开先平剩余数量（DCE）
  TimeFirstVolume: number;
  // 投资单元代码
  InvestUnitID: string;
  // 特殊持仓标志
  SpecPosiType: TThostFtdcSpecPosiTypeType;
  // 合约代码
  InstrumentID: string;
  // 组合合约代码
  CombInstrumentID: string;
}

// 资金账户口令域
export interface ICThostFtdcTradingAccountPasswordField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 密码
  Password: string;
  // 币种代码
  CurrencyID: string;
}

// 交易所行情报盘机
export interface ICThostFtdcMDTraderOfferField {
  // 交易所代码
  ExchangeID: string;
  // 交易所交易员代码
  TraderID: string;
  // 会员代码
  ParticipantID: string;
  // 密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 交易所交易员连接状态
  TraderConnectStatus: TThostFtdcTraderConnectStatusType;
  // 发出连接请求的日期
  ConnectRequestDate: string;
  // 发出连接请求的时间
  ConnectRequestTime: string;
  // 上次报告日期
  LastReportDate: string;
  // 上次报告时间
  LastReportTime: string;
  // 完成连接日期
  ConnectDate: string;
  // 完成连接时间
  ConnectTime: string;
  // 启动日期
  StartDate: string;
  // 启动时间
  StartTime: string;
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 本席位最大成交编号
  MaxTradeID: string;
  // 本席位最大报单备拷
  MaxOrderMessageReference: string;
}

// 查询行情报盘机
export interface ICThostFtdcQryMDTraderOfferField {
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 交易所交易员代码
  TraderID: string;
}

// 查询客户通知
export interface ICThostFtdcQryNoticeField {
  // 经纪公司代码
  BrokerID: string;
}

// 客户通知
export interface ICThostFtdcNoticeField {
  // 经纪公司代码
  BrokerID: string;
  // 消息正文
  Content: string;
  // 经纪公司通知内容序列号
  SequenceLabel: string;
}

// 用户权限
export interface ICThostFtdcUserRightField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 客户权限类型
  UserRightType: TThostFtdcUserRightTypeType;
  // 是否禁止
  IsForbidden: number;
}

// 查询结算信息确认域
export interface ICThostFtdcQrySettlementInfoConfirmField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投资者帐号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
}

// 装载结算信息
export interface ICThostFtdcLoadSettlementInfoField {
  // 经纪公司代码
  BrokerID: string;
}

// 经纪公司可提资金算法表
export interface ICThostFtdcBrokerWithdrawAlgorithmField {
  // 经纪公司代码
  BrokerID: string;
  // 可提资金算法
  WithdrawAlgorithm: TThostFtdcAlgorithmType;
  // 资金使用率
  UsingRatio: number;
  // 可提是否包含平仓盈利
  IncludeCloseProfit: TThostFtdcIncludeCloseProfitType;
  // 本日无仓且无成交客户是否受可提比例限制
  AllWithoutTrade: TThostFtdcAllWithoutTradeType;
  // 可用是否包含平仓盈利
  AvailIncludeCloseProfit: TThostFtdcIncludeCloseProfitType;
  // 是否启用用户事件
  IsBrokerUserEvent: number;
  // 币种代码
  CurrencyID: string;
  // 货币质押比率
  FundMortgageRatio: number;
  // 权益算法
  BalanceAlgorithm: TThostFtdcBalanceAlgorithmType;
}

// 资金账户口令变更域
export interface ICThostFtdcTradingAccountPasswordUpdateV1Field {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 原来的口令
  OldPassword: string;
  // 新的口令
  NewPassword: string;
}

// 资金账户口令变更域
export interface ICThostFtdcTradingAccountPasswordUpdateField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 原来的口令
  OldPassword: string;
  // 新的口令
  NewPassword: string;
  // 币种代码
  CurrencyID: string;
}

// 查询组合合约分腿
export interface ICThostFtdcQryCombinationLegField {
  // 保留的无效字段
  reserve1: string;
  // 单腿编号
  LegID: number;
  // 保留的无效字段
  reserve2: string;
  // 组合合约代码
  CombInstrumentID: string;
  // 单腿合约代码
  LegInstrumentID: string;
}

// 查询组合合约分腿
export interface ICThostFtdcQrySyncStatusField {
  // 交易日
  TradingDay: string;
}

// 组合交易合约的单腿
export interface ICThostFtdcCombinationLegField {
  // 保留的无效字段
  reserve1: string;
  // 单腿编号
  LegID: number;
  // 保留的无效字段
  reserve2: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 单腿乘数
  LegMultiple: number;
  // 派生层数
  ImplyLevel: number;
  // 组合合约代码
  CombInstrumentID: string;
  // 单腿合约代码
  LegInstrumentID: string;
}

// 数据同步状态
export interface ICThostFtdcSyncStatusField {
  // 交易日
  TradingDay: string;
  // 数据同步状态
  DataSyncStatus: TThostFtdcDataSyncStatusType;
}

// 查询联系人
export interface ICThostFtdcQryLinkManField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 联系人
export interface ICThostFtdcLinkManField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 联系人类型
  PersonType: TThostFtdcPersonTypeType;
  // 证件类型
  IdentifiedCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 名称
  PersonName: string;
  // 联系电话
  Telephone: string;
  // 通讯地址
  Address: string;
  // 邮政编码
  ZipCode: string;
  // 优先级
  Priority: number;
  // 开户邮政编码
  UOAZipCode: string;
  // 全称
  PersonFullName: string;
}

// 查询经纪公司用户事件
export interface ICThostFtdcQryBrokerUserEventField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 用户事件类型
  UserEventType: TThostFtdcUserEventTypeType;
}

// 查询经纪公司用户事件
export interface ICThostFtdcBrokerUserEventField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 用户事件类型
  UserEventType: TThostFtdcUserEventTypeType;
  // 用户事件序号
  EventSequenceNo: number;
  // 事件发生日期
  EventDate: string;
  // 事件发生时间
  EventTime: string;
  // 用户事件信息
  UserEventInfo: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 查询签约银行请求
export interface ICThostFtdcQryContractBankField {
  // 经纪公司代码
  BrokerID: string;
  // 银行代码
  BankID: string;
  // 银行分中心代码
  BankBrchID: string;
}

// 查询签约银行响应
export interface ICThostFtdcContractBankField {
  // 经纪公司代码
  BrokerID: string;
  // 银行代码
  BankID: string;
  // 银行分中心代码
  BankBrchID: string;
  // 银行名称
  BankName: string;
}

// 投资者组合持仓明细
export interface ICThostFtdcInvestorPositionCombineDetailField {
  // 交易日
  TradingDay: string;
  // 开仓日期
  OpenDate: string;
  // 交易所代码
  ExchangeID: string;
  // 结算编号
  SettlementID: number;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 组合编号
  ComTradeID: string;
  // 撮合编号
  TradeID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 买卖
  Direction: TThostFtdcDirectionType;
  // 持仓量
  TotalAmt: number;
  // 投资者保证金
  Margin: number;
  // 交易所保证金
  ExchMargin: number;
  // 保证金率
  MarginRateByMoney: number;
  // 保证金率(按手数)
  MarginRateByVolume: number;
  // 单腿编号
  LegID: number;
  // 单腿乘数
  LegMultiple: number;
  // 保留的无效字段
  reserve2: string;
  // 成交组号
  TradeGroupID: number;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
  // 组合持仓合约编码
  CombInstrumentID: string;
}

// 预埋单
export interface ICThostFtdcParkedOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报单引用
  OrderRef: string;
  // 用户代码
  UserID: string;
  // 报单价格条件
  OrderPriceType: TThostFtdcOrderPriceTypeType;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 组合开平标志
  CombOffsetFlag: string;
  // 组合投机套保标志
  CombHedgeFlag: string;
  // 价格
  LimitPrice: number;
  // 数量
  VolumeTotalOriginal: number;
  // 有效期类型
  TimeCondition: TThostFtdcTimeConditionType;
  // GTD日期
  GTDDate: string;
  // 成交量类型
  VolumeCondition: TThostFtdcVolumeConditionType;
  // 最小成交量
  MinVolume: number;
  // 触发条件
  ContingentCondition: TThostFtdcContingentConditionType;
  // 止损价
  StopPrice: number;
  // 强平原因
  ForceCloseReason: TThostFtdcForceCloseReasonType;
  // 自动挂起标志
  IsAutoSuspend: number;
  // 业务单元
  BusinessUnit: string;
  // 请求编号
  RequestID: number;
  // 用户强评标志
  UserForceClose: number;
  // 交易所代码
  ExchangeID: string;
  // 预埋报单编号
  ParkedOrderID: string;
  // 用户类型
  UserType: TThostFtdcUserTypeType;
  // 预埋单状态
  Status: TThostFtdcParkedOrderStatusType;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 互换单标志
  IsSwapOrder: number;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 交易编码
  ClientID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 输入预埋单操作
export interface ICThostFtdcParkedOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报单操作引用
  OrderActionRef: number;
  // 报单引用
  OrderRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 价格
  LimitPrice: number;
  // 数量变化
  VolumeChange: number;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // 预埋撤单单编号
  ParkedOrderActionID: string;
  // 用户类型
  UserType: TThostFtdcUserTypeType;
  // 预埋撤单状态
  Status: TThostFtdcParkedOrderStatusType;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 查询预埋单
export interface ICThostFtdcQryParkedOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询预埋撤单
export interface ICThostFtdcQryParkedOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 删除预埋单
export interface ICThostFtdcRemoveParkedOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 预埋报单编号
  ParkedOrderID: string;
  // 投资单元代码
  InvestUnitID: string;
}

// 删除预埋撤单
export interface ICThostFtdcRemoveParkedOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 预埋撤单编号
  ParkedOrderActionID: string;
  // 投资单元代码
  InvestUnitID: string;
}

// 经纪公司可提资金算法表
export interface ICThostFtdcInvestorWithdrawAlgorithmField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 投资者代码
  InvestorID: string;
  // 可提资金比例
  UsingRatio: number;
  // 币种代码
  CurrencyID: string;
  // 货币质押比率
  FundMortgageRatio: number;
}

// 查询组合持仓明细
export interface ICThostFtdcQryInvestorPositionCombineDetailField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 组合持仓合约编码
  CombInstrumentID: string;
}

// 成交均价
export interface ICThostFtdcMarketDataAveragePriceField {
  // 当日均价
  AveragePrice: number;
}

// 校验投资者密码
export interface ICThostFtdcVerifyInvestorPasswordField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 密码
  Password: string;
}

// 用户IP
export interface ICThostFtdcUserIPField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // IP地址
  IPAddress: string;
  // IP地址掩码
  IPMask: string;
}

// 用户事件通知信息
export interface ICThostFtdcTradingNoticeInfoField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 发送时间
  SendTime: string;
  // 消息正文
  FieldContent: string;
  // 序列系列号
  SequenceSeries: number;
  // 序列号
  SequenceNo: number;
  // 投资单元代码
  InvestUnitID: string;
}

// 用户事件通知
export interface ICThostFtdcTradingNoticeField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 投资者代码
  InvestorID: string;
  // 序列系列号
  SequenceSeries: number;
  // 用户代码
  UserID: string;
  // 发送时间
  SendTime: string;
  // 序列号
  SequenceNo: number;
  // 消息正文
  FieldContent: string;
  // 投资单元代码
  InvestUnitID: string;
}

// 查询交易事件通知
export interface ICThostFtdcQryTradingNoticeField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投资单元代码
  InvestUnitID: string;
}

// 查询错误报单
export interface ICThostFtdcQryErrOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 错误报单
export interface ICThostFtdcErrOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报单引用
  OrderRef: string;
  // 用户代码
  UserID: string;
  // 报单价格条件
  OrderPriceType: TThostFtdcOrderPriceTypeType;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 组合开平标志
  CombOffsetFlag: string;
  // 组合投机套保标志
  CombHedgeFlag: string;
  // 价格
  LimitPrice: number;
  // 数量
  VolumeTotalOriginal: number;
  // 有效期类型
  TimeCondition: TThostFtdcTimeConditionType;
  // GTD日期
  GTDDate: string;
  // 成交量类型
  VolumeCondition: TThostFtdcVolumeConditionType;
  // 最小成交量
  MinVolume: number;
  // 触发条件
  ContingentCondition: TThostFtdcContingentConditionType;
  // 止损价
  StopPrice: number;
  // 强平原因
  ForceCloseReason: TThostFtdcForceCloseReasonType;
  // 自动挂起标志
  IsAutoSuspend: number;
  // 业务单元
  BusinessUnit: string;
  // 请求编号
  RequestID: number;
  // 用户强评标志
  UserForceClose: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 互换单标志
  IsSwapOrder: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 交易编码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 查询错误报单操作
export interface ICThostFtdcErrorConditionalOrderField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 报单引用
  OrderRef: string;
  // 用户代码
  UserID: string;
  // 报单价格条件
  OrderPriceType: TThostFtdcOrderPriceTypeType;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 组合开平标志
  CombOffsetFlag: string;
  // 组合投机套保标志
  CombHedgeFlag: string;
  // 价格
  LimitPrice: number;
  // 数量
  VolumeTotalOriginal: number;
  // 有效期类型
  TimeCondition: TThostFtdcTimeConditionType;
  // GTD日期
  GTDDate: string;
  // 成交量类型
  VolumeCondition: TThostFtdcVolumeConditionType;
  // 最小成交量
  MinVolume: number;
  // 触发条件
  ContingentCondition: TThostFtdcContingentConditionType;
  // 止损价
  StopPrice: number;
  // 强平原因
  ForceCloseReason: TThostFtdcForceCloseReasonType;
  // 自动挂起标志
  IsAutoSuspend: number;
  // 业务单元
  BusinessUnit: string;
  // 请求编号
  RequestID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 交易所代码
  ExchangeID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 保留的无效字段
  reserve2: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 报单提交状态
  OrderSubmitStatus: TThostFtdcOrderSubmitStatusType;
  // 报单提示序号
  NotifySequence: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 报单编号
  OrderSysID: string;
  // 报单来源
  OrderSource: TThostFtdcOrderSourceType;
  // 报单状态
  OrderStatus: TThostFtdcOrderStatusType;
  // 报单类型
  OrderType: TThostFtdcOrderTypeType;
  // 今成交数量
  VolumeTraded: number;
  // 剩余数量
  VolumeTotal: number;
  // 报单日期
  InsertDate: string;
  // 委托时间
  InsertTime: string;
  // 激活时间
  ActiveTime: string;
  // 挂起时间
  SuspendTime: string;
  // 最后修改时间
  UpdateTime: string;
  // 撤销时间
  CancelTime: string;
  // 最后修改交易所交易员代码
  ActiveTraderID: string;
  // 结算会员编号
  ClearingPartID: string;
  // 序号
  SequenceNo: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 用户端产品信息
  UserProductInfo: string;
  // 状态信息
  StatusMsg: string;
  // 用户强评标志
  UserForceClose: number;
  // 操作用户代码
  ActiveUserID: string;
  // 经纪公司报单编号
  BrokerOrderSeq: number;
  // 相关报单
  RelativeOrderSysID: string;
  // 郑商所成交数量
  ZCETotalTradedVolume: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 互换单标志
  IsSwapOrder: number;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 资金账号
  AccountID: string;
  // 币种代码
  CurrencyID: string;
  // 保留的无效字段
  reserve3: string;
  // Mac地址
  MacAddress: string;
  // 合约代码
  InstrumentID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // IP地址
  IPAddress: string;
}

// 查询错误报单操作
export interface ICThostFtdcQryErrOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 错误报单操作
export interface ICThostFtdcErrOrderActionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 报单操作引用
  OrderActionRef: number;
  // 报单引用
  OrderRef: string;
  // 请求编号
  RequestID: number;
  // 前置编号
  FrontID: number;
  // 会话编号
  SessionID: number;
  // 交易所代码
  ExchangeID: string;
  // 报单编号
  OrderSysID: string;
  // 操作标志
  ActionFlag: TThostFtdcActionFlagType;
  // 价格
  LimitPrice: number;
  // 数量变化
  VolumeChange: number;
  // 操作日期
  ActionDate: string;
  // 操作时间
  ActionTime: string;
  // 交易所交易员代码
  TraderID: string;
  // 安装编号
  InstallID: number;
  // 本地报单编号
  OrderLocalID: string;
  // 操作本地编号
  ActionLocalID: string;
  // 会员代码
  ParticipantID: string;
  // 客户代码
  ClientID: string;
  // 业务单元
  BusinessUnit: string;
  // 报单操作状态
  OrderActionStatus: TThostFtdcOrderActionStatusType;
  // 用户代码
  UserID: string;
  // 状态信息
  StatusMsg: string;
  // 保留的无效字段
  reserve1: string;
  // 营业部编号
  BranchID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 保留的无效字段
  reserve2: string;
  // Mac地址
  MacAddress: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 合约代码
  InstrumentID: string;
  // IP地址
  IPAddress: string;
}

// 查询交易所状态
export interface ICThostFtdcQryExchangeSequenceField {
  // 交易所代码
  ExchangeID: string;
}

// 交易所状态
export interface ICThostFtdcExchangeSequenceField {
  // 交易所代码
  ExchangeID: string;
  // 序号
  SequenceNo: number;
  // 合约交易状态
  MarketStatus: TThostFtdcInstrumentStatusType;
}

// 根据价格查询最大报单数量
export interface ICThostFtdcQryMaxOrderVolumeWithPriceField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 开平标志
  OffsetFlag: TThostFtdcOffsetFlagType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 最大允许报单数量
  MaxVolume: number;
  // 报单价格
  Price: number;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询经纪公司交易参数
export interface ICThostFtdcQryBrokerTradingParamsField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 币种代码
  CurrencyID: string;
  // 投资者帐号
  AccountID: string;
}

// 经纪公司交易参数
export interface ICThostFtdcBrokerTradingParamsField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保证金价格类型
  MarginPriceType: TThostFtdcMarginPriceTypeType;
  // 盈亏算法
  Algorithm: TThostFtdcAlgorithmType;
  // 可用是否包含平仓盈利
  AvailIncludeCloseProfit: TThostFtdcIncludeCloseProfitType;
  // 币种代码
  CurrencyID: string;
  // 期权权利金价格类型
  OptionRoyaltyPriceType: TThostFtdcOptionRoyaltyPriceTypeType;
  // 投资者帐号
  AccountID: string;
}

// 查询经纪公司交易算法
export interface ICThostFtdcQryBrokerTradingAlgosField {
  // 经纪公司代码
  BrokerID: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// 经纪公司交易算法
export interface ICThostFtdcBrokerTradingAlgosField {
  // 经纪公司代码
  BrokerID: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve1: string;
  // 持仓处理算法编号
  HandlePositionAlgoID: TThostFtdcHandlePositionAlgoIDType;
  // 寻找保证金率算法编号
  FindMarginRateAlgoID: TThostFtdcFindMarginRateAlgoIDType;
  // 资金处理算法编号
  HandleTradingAccountAlgoID: TThostFtdcHandleTradingAccountAlgoIDType;
  // 合约代码
  InstrumentID: string;
}

// 查询经纪公司资金
export interface ICThostFtdcQueryBrokerDepositField {
  // 经纪公司代码
  BrokerID: string;
  // 交易所代码
  ExchangeID: string;
}

// 经纪公司资金
export interface ICThostFtdcBrokerDepositField {
  // 交易日期
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 会员代码
  ParticipantID: string;
  // 交易所代码
  ExchangeID: string;
  // 上次结算准备金
  PreBalance: number;
  // 当前保证金总额
  CurrMargin: number;
  // 平仓盈亏
  CloseProfit: number;
  // 期货结算准备金
  Balance: number;
  // 入金金额
  Deposit: number;
  // 出金金额
  Withdraw: number;
  // 可提资金
  Available: number;
  // 基本准备金
  Reserve: number;
  // 冻结的保证金
  FrozenMargin: number;
}

// 查询保证金监管系统经纪公司密钥
export interface ICThostFtdcQryCFMMCBrokerKeyField {
  // 经纪公司代码
  BrokerID: string;
}

// 保证金监管系统经纪公司密钥
export interface ICThostFtdcCFMMCBrokerKeyField {
  // 经纪公司代码
  BrokerID: string;
  // 经纪公司统一编码
  ParticipantID: string;
  // 密钥生成日期
  CreateDate: string;
  // 密钥生成时间
  CreateTime: string;
  // 密钥编号
  KeyID: number;
  // 动态密钥
  CurrentKey: string;
  // 动态密钥类型
  KeyKind: TThostFtdcCFMMCKeyKindType;
}

// 保证金监管系统经纪公司资金账户密钥
export interface ICThostFtdcCFMMCTradingAccountKeyField {
  // 经纪公司代码
  BrokerID: string;
  // 经纪公司统一编码
  ParticipantID: string;
  // 投资者帐号
  AccountID: string;
  // 密钥编号
  KeyID: number;
  // 动态密钥
  CurrentKey: string;
}

// 请求查询保证金监管系统经纪公司资金账户密钥
export interface ICThostFtdcQryCFMMCTradingAccountKeyField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 用户动态令牌参数
export interface ICThostFtdcBrokerUserOTPParamField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 动态令牌提供商
  OTPVendorsID: string;
  // 动态令牌序列号
  SerialNumber: string;
  // 令牌密钥
  AuthKey: string;
  // 漂移值
  LastDrift: number;
  // 成功值
  LastSuccess: number;
  // 动态令牌类型
  OTPType: TThostFtdcOTPTypeType;
}

// 手工同步用户动态令牌
export interface ICThostFtdcManualSyncBrokerUserOTPField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 动态令牌类型
  OTPType: TThostFtdcOTPTypeType;
  // 第一个动态密码
  FirstOTP: string;
  // 第二个动态密码
  SecondOTP: string;
}

// 投资者手续费率模板
export interface ICThostFtdcCommRateModelField {
  // 经纪公司代码
  BrokerID: string;
  // 手续费率模板代码
  CommModelID: string;
  // 模板名称
  CommModelName: string;
}

// 请求查询投资者手续费率模板
export interface ICThostFtdcQryCommRateModelField {
  // 经纪公司代码
  BrokerID: string;
  // 手续费率模板代码
  CommModelID: string;
}

// 投资者保证金率模板
export interface ICThostFtdcMarginModelField {
  // 经纪公司代码
  BrokerID: string;
  // 保证金率模板代码
  MarginModelID: string;
  // 模板名称
  MarginModelName: string;
}

// 请求查询投资者保证金率模板
export interface ICThostFtdcQryMarginModelField {
  // 经纪公司代码
  BrokerID: string;
  // 保证金率模板代码
  MarginModelID: string;
}

// 仓单折抵信息
export interface ICThostFtdcEWarrantOffsetField {
  // 交易日期
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve1: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 数量
  Volume: number;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询仓单折抵信息
export interface ICThostFtdcQryEWarrantOffsetField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve1: string;
  // 投资单元代码
  InvestUnitID: string;
  // 合约代码
  InstrumentID: string;
}

// 查询投资者品种
export interface ICThostFtdcQryInvestorProductGroupMarginField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 保留的无效字段
  reserve1: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 品种
  ProductGroupID: string;
}

// 投资者品种
export interface ICThostFtdcInvestorProductGroupMarginField {
  // 保留的无效字段
  reserve1: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 冻结的保证金
  FrozenMargin: number;
  // 多头冻结的保证金
  LongFrozenMargin: number;
  // 空头冻结的保证金
  ShortFrozenMargin: number;
  // 占用的保证金
  UseMargin: number;
  // 多头保证金
  LongUseMargin: number;
  // 空头保证金
  ShortUseMargin: number;
  // 交易所保证金
  ExchMargin: number;
  // 交易所多头保证金
  LongExchMargin: number;
  // 交易所空头保证金
  ShortExchMargin: number;
  // 平仓盈亏
  CloseProfit: number;
  // 冻结的手续费
  FrozenCommission: number;
  // 手续费
  Commission: number;
  // 冻结的资金
  FrozenCash: number;
  // 资金差额
  CashIn: number;
  // 持仓盈亏
  PositionProfit: number;
  // 折抵总金额
  OffsetAmount: number;
  // 多头折抵总金额
  LongOffsetAmount: number;
  // 空头折抵总金额
  ShortOffsetAmount: number;
  // 交易所折抵总金额
  ExchOffsetAmount: number;
  // 交易所多头折抵总金额
  LongExchOffsetAmount: number;
  // 交易所空头折抵总金额
  ShortExchOffsetAmount: number;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 交易所代码
  ExchangeID: string;
  // 投资单元代码
  InvestUnitID: string;
  // 品种
  ProductGroupID: string;
}

// 查询监控中心用户令牌
export interface ICThostFtdcQueryCFMMCTradingAccountTokenField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投资单元代码
  InvestUnitID: string;
}

// 监控中心用户令牌
export interface ICThostFtdcCFMMCTradingAccountTokenField {
  // 经纪公司代码
  BrokerID: string;
  // 经纪公司统一编码
  ParticipantID: string;
  // 投资者帐号
  AccountID: string;
  // 密钥编号
  KeyID: number;
  // 动态令牌
  Token: string;
}

// 查询产品组
export interface ICThostFtdcQryProductGroupField {
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 产品代码
  ProductID: string;
}

// 投资者品种
export interface ICThostFtdcProductGroupField {
  // 保留的无效字段
  reserve1: string;
  // 交易所代码
  ExchangeID: string;
  // 保留的无效字段
  reserve2: string;
  // 产品代码
  ProductID: string;
  // 产品组代码
  ProductGroupID: string;
}

// 交易所公告
export interface ICThostFtdcBulletinField {
  // 交易所代码
  ExchangeID: string;
  // 交易日
  TradingDay: string;
  // 公告编号
  BulletinID: number;
  // 序列号
  SequenceNo: number;
  // 公告类型
  NewsType: string;
  // 紧急程度
  NewsUrgency: string;
  // 发送时间
  SendTime: string;
  // 消息摘要
  Abstract: string;
  // 消息来源
  ComeFrom: string;
  // 消息正文
  Content: string;
  // WEB地址
  URLLink: string;
  // 市场代码
  MarketID: string;
}

// 查询交易所公告
export interface ICThostFtdcQryBulletinField {
  // 交易所代码
  ExchangeID: string;
  // 公告编号
  BulletinID: number;
  // 序列号
  SequenceNo: number;
  // 公告类型
  NewsType: string;
  // 紧急程度
  NewsUrgency: string;
}

// MulticastInstrument
export interface ICThostFtdcMulticastInstrumentField {
  // 主题号
  TopicID: number;
  // 保留的无效字段
  reserve1: string;
  // 合约编号
  InstrumentNo: number;
  // 基准价
  CodePrice: number;
  // 合约数量乘数
  VolumeMultiple: number;
  // 最小变动价位
  PriceTick: number;
  // 合约代码
  InstrumentID: string;
}

// QryMulticastInstrument
export interface ICThostFtdcQryMulticastInstrumentField {
  // 主题号
  TopicID: number;
  // 保留的无效字段
  reserve1: string;
  // 合约代码
  InstrumentID: string;
}

// App客户端权限分配
export interface ICThostFtdcAppIDAuthAssignField {
  // 经纪公司代码
  BrokerID: string;
  // App代码
  AppID: string;
  // 交易中心代码
  DRIdentityID: number;
}

// 转帐开户请求
export interface ICThostFtdcReqOpenAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 汇钞标志
  CashExchangeCode: TThostFtdcCashExchangeCodeType;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 交易ID
  TID: number;
  // 用户标识
  UserID: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 转帐销户请求
export interface ICThostFtdcReqCancelAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 汇钞标志
  CashExchangeCode: TThostFtdcCashExchangeCodeType;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 交易ID
  TID: number;
  // 用户标识
  UserID: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 变更银行账户请求
export interface ICThostFtdcReqChangeAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 新银行帐号
  NewBankAccount: string;
  // 新银行密码
  NewBankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易ID
  TID: number;
  // 摘要
  Digest: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 转账请求
export interface ICThostFtdcReqTransferField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 期货公司流水号
  FutureSerial: number;
  // 用户标识
  UserID: string;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 转帐金额
  TradeAmount: number;
  // 期货可取金额
  FutureFetchAmount: number;
  // 费用支付标志
  FeePayFlag: TThostFtdcFeePayFlagType;
  // 应收客户费用
  CustFee: number;
  // 应收期货公司费用
  BrokerFee: number;
  // 发送方给接收方的消息
  Message: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 转账交易状态
  TransferStatus: TThostFtdcTransferStatusType;
  // 长客户姓名
  LongCustomerName: string;
}

// 银行发起银行资金转期货响应
export interface ICThostFtdcRspTransferField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 期货公司流水号
  FutureSerial: number;
  // 用户标识
  UserID: string;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 转帐金额
  TradeAmount: number;
  // 期货可取金额
  FutureFetchAmount: number;
  // 费用支付标志
  FeePayFlag: TThostFtdcFeePayFlagType;
  // 应收客户费用
  CustFee: number;
  // 应收期货公司费用
  BrokerFee: number;
  // 发送方给接收方的消息
  Message: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 转账交易状态
  TransferStatus: TThostFtdcTransferStatusType;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 冲正请求
export interface ICThostFtdcReqRepealField {
  // 冲正时间间隔
  RepealTimeInterval: number;
  // 已经冲正次数
  RepealedTimes: number;
  // 银行冲正标志
  BankRepealFlag: TThostFtdcBankRepealFlagType;
  // 期商冲正标志
  BrokerRepealFlag: TThostFtdcBrokerRepealFlagType;
  // 被冲正平台流水号
  PlateRepealSerial: number;
  // 被冲正银行流水号
  BankRepealSerial: string;
  // 被冲正期货流水号
  FutureRepealSerial: number;
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 期货公司流水号
  FutureSerial: number;
  // 用户标识
  UserID: string;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 转帐金额
  TradeAmount: number;
  // 期货可取金额
  FutureFetchAmount: number;
  // 费用支付标志
  FeePayFlag: TThostFtdcFeePayFlagType;
  // 应收客户费用
  CustFee: number;
  // 应收期货公司费用
  BrokerFee: number;
  // 发送方给接收方的消息
  Message: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 转账交易状态
  TransferStatus: TThostFtdcTransferStatusType;
  // 长客户姓名
  LongCustomerName: string;
}

// 冲正响应
export interface ICThostFtdcRspRepealField {
  // 冲正时间间隔
  RepealTimeInterval: number;
  // 已经冲正次数
  RepealedTimes: number;
  // 银行冲正标志
  BankRepealFlag: TThostFtdcBankRepealFlagType;
  // 期商冲正标志
  BrokerRepealFlag: TThostFtdcBrokerRepealFlagType;
  // 被冲正平台流水号
  PlateRepealSerial: number;
  // 被冲正银行流水号
  BankRepealSerial: string;
  // 被冲正期货流水号
  FutureRepealSerial: number;
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 期货公司流水号
  FutureSerial: number;
  // 用户标识
  UserID: string;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 转帐金额
  TradeAmount: number;
  // 期货可取金额
  FutureFetchAmount: number;
  // 费用支付标志
  FeePayFlag: TThostFtdcFeePayFlagType;
  // 应收客户费用
  CustFee: number;
  // 应收期货公司费用
  BrokerFee: number;
  // 发送方给接收方的消息
  Message: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 转账交易状态
  TransferStatus: TThostFtdcTransferStatusType;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 查询账户信息请求
export interface ICThostFtdcReqQueryAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 期货公司流水号
  FutureSerial: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 长客户姓名
  LongCustomerName: string;
}

// 查询账户信息响应
export interface ICThostFtdcRspQueryAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 期货公司流水号
  FutureSerial: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 银行可用金额
  BankUseAmount: number;
  // 银行可取金额
  BankFetchAmount: number;
  // 长客户姓名
  LongCustomerName: string;
}

// 期商签到签退
export interface ICThostFtdcFutureSignIOField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 摘要
  Digest: string;
  // 币种代码
  CurrencyID: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
}

// 期商签到响应
export interface ICThostFtdcRspFutureSignInField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 摘要
  Digest: string;
  // 币种代码
  CurrencyID: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // PIN密钥
  PinKey: string;
  // MAC密钥
  MacKey: string;
}

// 期商签退请求
export interface ICThostFtdcReqFutureSignOutField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 摘要
  Digest: string;
  // 币种代码
  CurrencyID: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
}

// 期商签退响应
export interface ICThostFtdcRspFutureSignOutField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 摘要
  Digest: string;
  // 币种代码
  CurrencyID: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 查询指定流水号的交易结果请求
export interface ICThostFtdcReqQueryTradeResultBySerialField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 流水号
  Reference: number;
  // 本流水号发布者的机构类型
  RefrenceIssureType: TThostFtdcInstitutionTypeType;
  // 本流水号发布者机构编码
  RefrenceIssure: string;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 币种代码
  CurrencyID: string;
  // 转帐金额
  TradeAmount: number;
  // 摘要
  Digest: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 查询指定流水号的交易结果响应
export interface ICThostFtdcRspQueryTradeResultBySerialField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 流水号
  Reference: number;
  // 本流水号发布者的机构类型
  RefrenceIssureType: TThostFtdcInstitutionTypeType;
  // 本流水号发布者机构编码
  RefrenceIssure: string;
  // 原始返回代码
  OriginReturnCode: string;
  // 原始返回码描述
  OriginDescrInfoForReturnCode: string;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 币种代码
  CurrencyID: string;
  // 转帐金额
  TradeAmount: number;
  // 摘要
  Digest: string;
}

// 日终文件就绪请求
export interface ICThostFtdcReqDayEndFileReadyField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 文件业务功能
  FileBusinessCode: TThostFtdcFileBusinessCodeType;
  // 摘要
  Digest: string;
}

// 返回结果
export interface ICThostFtdcReturnResultField {
  // 返回代码
  ReturnCode: string;
  // 返回码描述
  DescrInfoForReturnCode: string;
}

// 验证期货资金密码
export interface ICThostFtdcVerifyFuturePasswordField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 安装编号
  InstallID: number;
  // 交易ID
  TID: number;
  // 币种代码
  CurrencyID: string;
}

// 验证客户信息
export interface ICThostFtdcVerifyCustInfoField {
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 长客户姓名
  LongCustomerName: string;
}

// 验证期货资金密码和客户信息
export interface ICThostFtdcVerifyFuturePasswordAndCustInfoField {
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 币种代码
  CurrencyID: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 验证期货资金密码和客户信息
export interface ICThostFtdcDepositResultInformField {
  // 出入金流水号，该流水号为银期报盘返回的流水号
  DepositSeqNo: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 入金金额
  Deposit: number;
  // 请求编号
  RequestID: number;
  // 返回代码
  ReturnCode: string;
  // 返回码描述
  DescrInfoForReturnCode: string;
}

// 交易核心向银期报盘发出密钥同步请求
export interface ICThostFtdcReqSyncKeyField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 交易核心给银期报盘的消息
  Message: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
}

// 交易核心向银期报盘发出密钥同步响应
export interface ICThostFtdcRspSyncKeyField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 交易核心给银期报盘的消息
  Message: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 查询账户信息通知
export interface ICThostFtdcNotifyQueryAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 期货公司流水号
  FutureSerial: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 银行可用金额
  BankUseAmount: number;
  // 银行可取金额
  BankFetchAmount: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 银期转账交易流水表
export interface ICThostFtdcTransferSerialField {
  // 平台流水号
  PlateSerial: number;
  // 交易发起方日期
  TradeDate: string;
  // 交易日期
  TradingDay: string;
  // 交易时间
  TradeTime: string;
  // 交易代码
  TradeCode: string;
  // 会话编号
  SessionID: number;
  // 银行编码
  BankID: string;
  // 银行分支机构编码
  BankBranchID: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 银行帐号
  BankAccount: string;
  // 银行流水号
  BankSerial: string;
  // 期货公司编码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 期货公司帐号类型
  FutureAccType: TThostFtdcFutureAccTypeType;
  // 投资者帐号
  AccountID: string;
  // 投资者代码
  InvestorID: string;
  // 期货公司流水号
  FutureSerial: number;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 币种代码
  CurrencyID: string;
  // 交易金额
  TradeAmount: number;
  // 应收客户费用
  CustFee: number;
  // 应收期货公司费用
  BrokerFee: number;
  // 有效标志
  AvailabilityFlag: TThostFtdcAvailabilityFlagType;
  // 操作员
  OperatorCode: string;
  // 新银行帐号
  BankNewAccount: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 请求查询转帐流水
export interface ICThostFtdcQryTransferSerialField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 银行编码
  BankID: string;
  // 币种代码
  CurrencyID: string;
}

// 期商签到通知
export interface ICThostFtdcNotifyFutureSignInField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 摘要
  Digest: string;
  // 币种代码
  CurrencyID: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // PIN密钥
  PinKey: string;
  // MAC密钥
  MacKey: string;
}

// 期商签退通知
export interface ICThostFtdcNotifyFutureSignOutField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 摘要
  Digest: string;
  // 币种代码
  CurrencyID: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 交易核心向银期报盘发出密钥同步处理结果的通知
export interface ICThostFtdcNotifySyncKeyField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 安装编号
  InstallID: number;
  // 用户标识
  UserID: string;
  // 交易核心给银期报盘的消息
  Message: string;
  // 渠道标志
  DeviceID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易柜员
  OperNo: string;
  // 请求编号
  RequestID: number;
  // 交易ID
  TID: number;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 请求查询银期签约关系
export interface ICThostFtdcQryAccountregisterField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 银行编码
  BankID: string;
  // 银行分支机构编码
  BankBranchID: string;
  // 币种代码
  CurrencyID: string;
}

// 客户开销户信息表
export interface ICThostFtdcAccountregisterField {
  // 交易日期
  TradeDay: string;
  // 银行编码
  BankID: string;
  // 银行分支机构编码
  BankBranchID: string;
  // 银行帐号
  BankAccount: string;
  // 期货公司编码
  BrokerID: string;
  // 期货公司分支机构编码
  BrokerBranchID: string;
  // 投资者帐号
  AccountID: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 客户姓名
  CustomerName: string;
  // 币种代码
  CurrencyID: string;
  // 开销户类别
  OpenOrDestroy: TThostFtdcOpenOrDestroyType;
  // 签约日期
  RegDate: string;
  // 解约日期
  OutDate: string;
  // 交易ID
  TID: number;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 长客户姓名
  LongCustomerName: string;
}

// 银期开户信息
export interface ICThostFtdcOpenAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 汇钞标志
  CashExchangeCode: TThostFtdcCashExchangeCodeType;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 交易ID
  TID: number;
  // 用户标识
  UserID: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 银期销户信息
export interface ICThostFtdcCancelAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 汇钞标志
  CashExchangeCode: TThostFtdcCashExchangeCodeType;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 渠道标志
  DeviceID: string;
  // 期货单位帐号类型
  BankSecuAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 期货单位帐号
  BankSecuAcc: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易柜员
  OperNo: string;
  // 交易ID
  TID: number;
  // 用户标识
  UserID: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 银期变更银行账号信息
export interface ICThostFtdcChangeAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 新银行帐号
  NewBankAccount: string;
  // 新银行密码
  NewBankPassWord: string;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 银行密码标志
  BankPwdFlag: TThostFtdcPwdFlagType;
  // 期货资金密码核对标志
  SecuPwdFlag: TThostFtdcPwdFlagType;
  // 交易ID
  TID: number;
  // 摘要
  Digest: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
  // 长客户姓名
  LongCustomerName: string;
}

// 二级代理操作员银期权限
export interface ICThostFtdcSecAgentACIDMapField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 资金账户
  AccountID: string;
  // 币种
  CurrencyID: string;
  // 境外中介机构资金帐号
  BrokerSecAgentID: string;
}

// 二级代理操作员银期权限查询
export interface ICThostFtdcQrySecAgentACIDMapField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 资金账户
  AccountID: string;
  // 币种
  CurrencyID: string;
}

// 灾备中心交易权限
export interface ICThostFtdcUserRightsAssignField {
  // 应用单元代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 交易中心代码
  DRIdentityID: number;
}

// 经济公司是否有在本标示的交易权限
export interface ICThostFtdcBrokerUserRightAssignField {
  // 应用单元代码
  BrokerID: string;
  // 交易中心代码
  DRIdentityID: number;
  // 能否交易
  Tradeable: number;
}

// 灾备交易转换报文
export interface ICThostFtdcDRTransferField {
  // 原交易中心代码
  OrigDRIdentityID: number;
  // 目标交易中心代码
  DestDRIdentityID: number;
  // 原应用单元代码
  OrigBrokerID: string;
  // 目标易用单元代码
  DestBrokerID: string;
}

// Fens用户信息
export interface ICThostFtdcFensUserInfoField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 登录模式
  LoginMode: TThostFtdcLoginModeType;
}

// 当前银期所属交易中心
export interface ICThostFtdcCurrTransferIdentityField {
  // 交易中心代码
  IdentityID: number;
}

// 禁止登录用户
export interface ICThostFtdcLoginForbiddenUserField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 保留的无效字段
  reserve1: string;
  // IP地址
  IPAddress: string;
}

// 查询禁止登录用户
export interface ICThostFtdcQryLoginForbiddenUserField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 资金账户基本准备金
export interface ICThostFtdcTradingAccountReserveField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 基本准备金
  Reserve: number;
  // 币种代码
  CurrencyID: string;
}

// 查询禁止登录IP
export interface ICThostFtdcQryLoginForbiddenIPField {
  // 保留的无效字段
  reserve1: string;
  // IP地址
  IPAddress: string;
}

// 查询IP列表
export interface ICThostFtdcQryIPListField {
  // 保留的无效字段
  reserve1: string;
  // IP地址
  IPAddress: string;
}

// 查询用户下单权限分配表
export interface ICThostFtdcQryUserRightsAssignField {
  // 应用单元代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 银期预约开户确认请求
export interface ICThostFtdcReserveOpenAccountConfirmField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易ID
  TID: number;
  // 投资者帐号
  AccountID: string;
  // 期货密码
  Password: string;
  // 预约开户银行流水号
  BankReserveOpenSeq: string;
  // 预约开户日期
  BookDate: string;
  // 预约开户验证密码
  BookPsw: string;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 银期预约开户
export interface ICThostFtdcReserveOpenAccountField {
  // 业务功能码
  TradeCode: string;
  // 银行代码
  BankID: string;
  // 银行分支机构代码
  BankBranchID: string;
  // 期商代码
  BrokerID: string;
  // 期商分支机构代码
  BrokerBranchID: string;
  // 交易日期
  TradeDate: string;
  // 交易时间
  TradeTime: string;
  // 银行流水号
  BankSerial: string;
  // 交易系统日期
  TradingDay: string;
  // 银期平台消息流水号
  PlateSerial: number;
  // 最后分片标志
  LastFragment: TThostFtdcLastFragmentType;
  // 会话号
  SessionID: number;
  // 客户姓名
  CustomerName: string;
  // 证件类型
  IdCardType: TThostFtdcIdCardTypeType;
  // 证件号码
  IdentifiedCardNo: string;
  // 性别
  Gender: TThostFtdcGenderType;
  // 国家代码
  CountryCode: string;
  // 客户类型
  CustType: TThostFtdcCustTypeType;
  // 地址
  Address: string;
  // 邮编
  ZipCode: string;
  // 电话号码
  Telephone: string;
  // 手机
  MobilePhone: string;
  // 传真
  Fax: string;
  // 电子邮件
  EMail: string;
  // 资金账户状态
  MoneyAccountStatus: TThostFtdcMoneyAccountStatusType;
  // 银行帐号
  BankAccount: string;
  // 银行密码
  BankPassWord: string;
  // 安装编号
  InstallID: number;
  // 验证客户证件号码标志
  VerifyCertNoFlag: TThostFtdcYesNoIndicatorType;
  // 币种代码
  CurrencyID: string;
  // 摘要
  Digest: string;
  // 银行帐号类型
  BankAccType: TThostFtdcBankAccTypeType;
  // 期货公司银行编码
  BrokerIDByBank: string;
  // 交易ID
  TID: number;
  // 预约开户状态
  ReserveOpenAccStas: TThostFtdcReserveOpenAccStasType;
  // 错误代码
  ErrorID: number;
  // 错误信息
  ErrorMsg: string;
}

// 银行账户属性
export interface ICThostFtdcAccountPropertyField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 银行统一标识类型
  BankID: string;
  // 银行账户
  BankAccount: string;
  // 银行账户的开户人名称
  OpenName: string;
  // 银行账户的开户行
  OpenBank: string;
  // 是否活跃
  IsActive: number;
  // 账户来源
  AccountSourceType: TThostFtdcAccountSourceTypeType;
  // 开户日期
  OpenDate: string;
  // 注销日期
  CancelDate: string;
  // 录入员代码
  OperatorID: string;
  // 录入日期
  OperateDate: string;
  // 录入时间
  OperateTime: string;
  // 币种代码
  CurrencyID: string;
}

// 查询当前交易中心
export interface ICThostFtdcQryCurrDRIdentityField {
  // 交易中心代码
  DRIdentityID: number;
}

// 当前交易中心
export interface ICThostFtdcCurrDRIdentityField {
  // 交易中心代码
  DRIdentityID: number;
}

// 查询二级代理商资金校验模式
export interface ICThostFtdcQrySecAgentCheckModeField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
}

// 查询二级代理商信息
export interface ICThostFtdcQrySecAgentTradeInfoField {
  // 经纪公司代码
  BrokerID: string;
  // 境外中介机构资金帐号
  BrokerSecAgentID: string;
}

// 用户发出获取安全安全登陆方法请求
export interface ICThostFtdcReqUserAuthMethodField {
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 用户发出获取安全安全登陆方法回复
export interface ICThostFtdcRspUserAuthMethodField {
  // 当前可以用的认证模式
  UsableAuthMethod: number;
}

// 用户发出获取安全安全登陆方法请求
export interface ICThostFtdcReqGenUserCaptchaField {
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 生成的图片验证码信息
export interface ICThostFtdcRspGenUserCaptchaField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 图片信息长度
  CaptchaInfoLen: number;
  // 图片信息
  CaptchaInfo: string;
}

// 用户发出获取安全安全登陆方法请求
export interface ICThostFtdcReqGenUserTextField {
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
}

// 短信验证码生成的回复
export interface ICThostFtdcRspGenUserTextField {
  // 短信验证码序号
  UserTextSeq: number;
}

// 用户发出带图形验证码的登录请求请求
export interface ICThostFtdcReqUserLoginWithCaptchaField {
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 密码
  Password: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 接口端产品信息
  InterfaceProductInfo: string;
  // 协议信息
  ProtocolInfo: string;
  // Mac地址
  MacAddress: string;
  // 保留的无效字段
  reserve1: string;
  // 登录备注
  LoginRemark: string;
  // 图形验证码的文字内容
  Captcha: string;
  // 终端IP端口
  ClientIPPort: number;
  // 终端IP地址
  ClientIPAddress: string;
}

// 用户发出带短信验证码的登录请求请求
export interface ICThostFtdcReqUserLoginWithTextField {
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 密码
  Password: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 接口端产品信息
  InterfaceProductInfo: string;
  // 协议信息
  ProtocolInfo: string;
  // Mac地址
  MacAddress: string;
  // 保留的无效字段
  reserve1: string;
  // 登录备注
  LoginRemark: string;
  // 短信验证码文字内容
  Text: string;
  // 终端IP端口
  ClientIPPort: number;
  // 终端IP地址
  ClientIPAddress: string;
}

// 用户发出带动态验证码的登录请求请求
export interface ICThostFtdcReqUserLoginWithOTPField {
  // 交易日
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 密码
  Password: string;
  // 用户端产品信息
  UserProductInfo: string;
  // 接口端产品信息
  InterfaceProductInfo: string;
  // 协议信息
  ProtocolInfo: string;
  // Mac地址
  MacAddress: string;
  // 保留的无效字段
  reserve1: string;
  // 登录备注
  LoginRemark: string;
  // OTP密码
  OTPPassword: string;
  // 终端IP端口
  ClientIPPort: number;
  // 终端IP地址
  ClientIPAddress: string;
}

// api握手请求
export interface ICThostFtdcReqApiHandshakeField {
  // api与front通信密钥版本号
  CryptoKeyVersion: string;
}

// front发给api的握手回复
export interface ICThostFtdcRspApiHandshakeField {
  // 握手回复数据长度
  FrontHandshakeDataLen: number;
  // 握手回复数据
  FrontHandshakeData: string;
  // API认证是否开启
  IsApiAuthEnabled: number;
}

// api给front的验证key的请求
export interface ICThostFtdcReqVerifyApiKeyField {
  // 握手回复数据长度
  ApiHandshakeDataLen: number;
  // 握手回复数据
  ApiHandshakeData: string;
}

// 操作员组织架构关系
export interface ICThostFtdcDepartmentUserField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 投资者范围
  InvestorRange: TThostFtdcDepartmentRangeType;
  // 投资者代码
  InvestorID: string;
}

// 查询频率，每秒查询比数
export interface ICThostFtdcQueryFreqField {
  // 查询频率
  QueryFreq: number;
}

// 禁止认证IP
export interface ICThostFtdcAuthForbiddenIPField {
  // IP地址
  IPAddress: string;
}

// 查询禁止认证IP
export interface ICThostFtdcQryAuthForbiddenIPField {
  // IP地址
  IPAddress: string;
}

// 换汇可提冻结
export interface ICThostFtdcSyncDelaySwapFrozenField {
  // 换汇流水号
  DelaySwapSeqNo: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 源币种
  FromCurrencyID: string;
  // 源剩余换汇额度(可提冻结)
  FromRemainSwap: number;
  // 是否手工换汇
  IsManualSwap: number;
}

// 用户系统信息
export interface ICThostFtdcUserSystemInfoField {
  // 经纪公司代码
  BrokerID: string;
  // 用户代码
  UserID: string;
  // 用户端系统内部信息长度
  ClientSystemInfoLen: number;
  // 用户端系统内部信息
  ClientSystemInfo: string;
  // 保留的无效字段
  reserve1: string;
  // 终端IP端口
  ClientIPPort: number;
  // 登录成功时间
  ClientLoginTime: string;
  // App代码
  ClientAppID: string;
  // 用户公网IP
  ClientPublicIP: string;
  // 客户登录备注2
  ClientLoginRemark: string;
}

// 终端用户绑定信息
export interface ICThostFtdcAuthUserIDField {
  // 经纪公司代码
  BrokerID: string;
  // App代码
  AppID: string;
  // 用户代码
  UserID: string;
  // 校验类型
  AuthType: TThostFtdcAuthTypeType;
}

// 用户IP绑定信息
export interface ICThostFtdcAuthIPField {
  // 经纪公司代码
  BrokerID: string;
  // App代码
  AppID: string;
  // 用户代码
  IPAddress: string;
}

// 查询分类合约
export interface ICThostFtdcQryClassifiedInstrumentField {
  // 合约代码
  InstrumentID: string;
  // 交易所代码
  ExchangeID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // 产品代码
  ProductID: string;
  // 合约交易状态
  TradingType: TThostFtdcTradingTypeType;
  // 合约分类类型
  ClassType: TThostFtdcClassTypeType;
}

// 查询组合优惠比例
export interface ICThostFtdcQryCombPromotionParamField {
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
}

// 组合优惠比例
export interface ICThostFtdcCombPromotionParamField {
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
  // 投机套保标志
  CombHedgeFlag: string;
  // 期权组合保证金比例
  Xparameter: number;
}

// 投资者风险结算持仓查询
export interface ICThostFtdcQryRiskSettleInvstPositionField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 合约代码
  InstrumentID: string;
}

// 风险结算产品查询
export interface ICThostFtdcQryRiskSettleProductStatusField {
  // 产品代码
  ProductID: string;
}

// 投资者风险结算持仓
export interface ICThostFtdcRiskSettleInvstPositionField {
  // 合约代码
  InstrumentID: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 持仓多空方向
  PosiDirection: TThostFtdcPosiDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 持仓日期
  PositionDate: TThostFtdcPositionDateType;
  // 上日持仓
  YdPosition: number;
  // 今日持仓
  Position: number;
  // 多头冻结
  LongFrozen: number;
  // 空头冻结
  ShortFrozen: number;
  // 开仓冻结金额
  LongFrozenAmount: number;
  // 开仓冻结金额
  ShortFrozenAmount: number;
  // 开仓量
  OpenVolume: number;
  // 平仓量
  CloseVolume: number;
  // 开仓金额
  OpenAmount: number;
  // 平仓金额
  CloseAmount: number;
  // 持仓成本
  PositionCost: number;
  // 上次占用的保证金
  PreMargin: number;
  // 占用的保证金
  UseMargin: number;
  // 冻结的保证金
  FrozenMargin: number;
  // 冻结的资金
  FrozenCash: number;
  // 冻结的手续费
  FrozenCommission: number;
  // 资金差额
  CashIn: number;
  // 手续费
  Commission: number;
  // 平仓盈亏
  CloseProfit: number;
  // 持仓盈亏
  PositionProfit: number;
  // 上次结算价
  PreSettlementPrice: number;
  // 本次结算价
  SettlementPrice: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 开仓成本
  OpenCost: number;
  // 交易所保证金
  ExchangeMargin: number;
  // 组合成交形成的持仓
  CombPosition: number;
  // 组合多头冻结
  CombLongFrozen: number;
  // 组合空头冻结
  CombShortFrozen: number;
  // 逐日盯市平仓盈亏
  CloseProfitByDate: number;
  // 逐笔对冲平仓盈亏
  CloseProfitByTrade: number;
  // 今日持仓
  TodayPosition: number;
  // 保证金率
  MarginRateByMoney: number;
  // 保证金率(按手数)
  MarginRateByVolume: number;
  // 执行冻结
  StrikeFrozen: number;
  // 执行冻结金额
  StrikeFrozenAmount: number;
  // 放弃执行冻结
  AbandonFrozen: number;
  // 交易所代码
  ExchangeID: string;
  // 执行冻结的昨仓
  YdStrikeFrozen: number;
  // 投资单元代码
  InvestUnitID: string;
  // 大商所持仓成本差值，只有大商所使用
  PositionCostOffset: number;
  // tas持仓手数
  TasPosition: number;
  // tas持仓成本
  TasPositionCost: number;
}

// 风险品种
export interface ICThostFtdcRiskSettleProductStatusField {
  // 交易所代码
  ExchangeID: string;
  // 产品编号
  ProductID: string;
  // 产品结算状态
  ProductStatus: TThostFtdcProductStatusType;
}

// 风险结算追平信息
export interface ICThostFtdcSyncDeltaInfoField {
  // 追平序号
  SyncDeltaSequenceNo: number;
  // 追平状态
  SyncDeltaStatus: TThostFtdcSyncDeltaStatusType;
  // 追平描述
  SyncDescription: string;
  // 是否只有资金追平
  IsOnlyTrdDelta: number;
}

// 风险结算追平产品信息
export interface ICThostFtdcSyncDeltaProductStatusField {
  // 追平序号
  SyncDeltaSequenceNo: number;
  // 交易所代码
  ExchangeID: string;
  // 产品代码
  ProductID: string;
  // 是否允许交易
  ProductStatus: TThostFtdcProductStatusType;
}

// 风险结算追平持仓明细
export interface ICThostFtdcSyncDeltaInvstPosDtlField {
  // 合约代码
  InstrumentID: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 买卖
  Direction: TThostFtdcDirectionType;
  // 开仓日期
  OpenDate: string;
  // 成交编号
  TradeID: string;
  // 数量
  Volume: number;
  // 开仓价
  OpenPrice: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 成交类型
  TradeType: TThostFtdcTradeTypeType;
  // 组合合约代码
  CombInstrumentID: string;
  // 交易所代码
  ExchangeID: string;
  // 逐日盯市平仓盈亏
  CloseProfitByDate: number;
  // 逐笔对冲平仓盈亏
  CloseProfitByTrade: number;
  // 逐日盯市持仓盈亏
  PositionProfitByDate: number;
  // 逐笔对冲持仓盈亏
  PositionProfitByTrade: number;
  // 投资者保证金
  Margin: number;
  // 交易所保证金
  ExchMargin: number;
  // 保证金率
  MarginRateByMoney: number;
  // 保证金率(按手数)
  MarginRateByVolume: number;
  // 昨结算价
  LastSettlementPrice: number;
  // 结算价
  SettlementPrice: number;
  // 平仓量
  CloseVolume: number;
  // 平仓金额
  CloseAmount: number;
  // 先开先平剩余数量（DCE）
  TimeFirstVolume: number;
  // 特殊持仓标志
  SpecPosiType: TThostFtdcSpecPosiTypeType;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平组合持仓明细
export interface ICThostFtdcSyncDeltaInvstPosCombDtlField {
  // 交易日
  TradingDay: string;
  // 开仓日期
  OpenDate: string;
  // 交易所代码
  ExchangeID: string;
  // 结算编号
  SettlementID: number;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 组合编号
  ComTradeID: string;
  // 撮合编号
  TradeID: string;
  // 合约代码
  InstrumentID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 买卖
  Direction: TThostFtdcDirectionType;
  // 持仓量
  TotalAmt: number;
  // 投资者保证金
  Margin: number;
  // 交易所保证金
  ExchMargin: number;
  // 保证金率
  MarginRateByMoney: number;
  // 保证金率(按手数)
  MarginRateByVolume: number;
  // 单腿编号
  LegID: number;
  // 单腿乘数
  LegMultiple: number;
  // 成交组号
  TradeGroupID: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平资金
export interface ICThostFtdcSyncDeltaTradingAccountField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者帐号
  AccountID: string;
  // 上次质押金额
  PreMortgage: number;
  // 上次信用额度
  PreCredit: number;
  // 上次存款额
  PreDeposit: number;
  // 上次结算准备金
  PreBalance: number;
  // 上次占用的保证金
  PreMargin: number;
  // 利息基数
  InterestBase: number;
  // 利息收入
  Interest: number;
  // 入金金额
  Deposit: number;
  // 出金金额
  Withdraw: number;
  // 冻结的保证金
  FrozenMargin: number;
  // 冻结的资金
  FrozenCash: number;
  // 冻结的手续费
  FrozenCommission: number;
  // 当前保证金总额
  CurrMargin: number;
  // 资金差额
  CashIn: number;
  // 手续费
  Commission: number;
  // 平仓盈亏
  CloseProfit: number;
  // 持仓盈亏
  PositionProfit: number;
  // 期货结算准备金
  Balance: number;
  // 可用资金
  Available: number;
  // 可取资金
  WithdrawQuota: number;
  // 基本准备金
  Reserve: number;
  // 交易日
  TradingDay: string;
  // 结算编号
  SettlementID: number;
  // 信用额度
  Credit: number;
  // 质押金额
  Mortgage: number;
  // 交易所保证金
  ExchangeMargin: number;
  // 投资者交割保证金
  DeliveryMargin: number;
  // 交易所交割保证金
  ExchangeDeliveryMargin: number;
  // 保底期货结算准备金
  ReserveBalance: number;
  // 币种代码
  CurrencyID: string;
  // 上次货币质入金额
  PreFundMortgageIn: number;
  // 上次货币质出金额
  PreFundMortgageOut: number;
  // 货币质入金额
  FundMortgageIn: number;
  // 货币质出金额
  FundMortgageOut: number;
  // 货币质押余额
  FundMortgageAvailable: number;
  // 可质押货币金额
  MortgageableFund: number;
  // 特殊产品占用保证金
  SpecProductMargin: number;
  // 特殊产品冻结保证金
  SpecProductFrozenMargin: number;
  // 特殊产品手续费
  SpecProductCommission: number;
  // 特殊产品冻结手续费
  SpecProductFrozenCommission: number;
  // 特殊产品持仓盈亏
  SpecProductPositionProfit: number;
  // 特殊产品平仓盈亏
  SpecProductCloseProfit: number;
  // 根据持仓盈亏算法计算的特殊产品持仓盈亏
  SpecProductPositionProfitByAlg: number;
  // 特殊产品交易所保证金
  SpecProductExchangeMargin: number;
  // 延时换汇冻结金额
  FrozenSwap: number;
  // 剩余换汇额度
  RemainSwap: number;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 投资者风险结算总保证金
export interface ICThostFtdcSyncDeltaInitInvstMarginField {
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 追平前总风险保证金
  LastRiskTotalInvstMargin: number;
  // 追平前交易所总风险保证金
  LastRiskTotalExchMargin: number;
  // 本次追平品种总保证金
  ThisSyncInvstMargin: number;
  // 本次追平品种交易所总保证金
  ThisSyncExchMargin: number;
  // 本次未追平品种总保证金
  RemainRiskInvstMargin: number;
  // 本次未追平品种交易所总保证金
  RemainRiskExchMargin: number;
  // 追平前总特殊产品风险保证金
  LastRiskSpecTotalInvstMargin: number;
  // 追平前总特殊产品交易所风险保证金
  LastRiskSpecTotalExchMargin: number;
  // 本次追平品种特殊产品总保证金
  ThisSyncSpecInvstMargin: number;
  // 本次追平品种特殊产品交易所总保证金
  ThisSyncSpecExchMargin: number;
  // 本次未追平品种特殊产品总保证金
  RemainRiskSpecInvstMargin: number;
  // 本次未追平品种特殊产品交易所总保证金
  RemainRiskSpecExchMargin: number;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平组合优先级
export interface ICThostFtdcSyncDeltaDceCombInstrumentField {
  // 合约代码
  CombInstrumentID: string;
  // 交易所代码
  ExchangeID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // 成交组号
  TradeGroupID: number;
  // 投机套保标志
  CombHedgeFlag: TThostFtdcHedgeFlagType;
  // 组合类型
  CombinationType: TThostFtdcDceCombinationTypeType;
  // 买卖
  Direction: TThostFtdcDirectionType;
  // 产品代码
  ProductID: string;
  // 期权组合保证金比例
  Xparameter: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平投资者期货保证金率
export interface ICThostFtdcSyncDeltaInvstMarginRateField {
  // 合约代码
  InstrumentID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 是否相对交易所收取
  IsRelative: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平交易所期货保证金率
export interface ICThostFtdcSyncDeltaExchMarginRateField {
  // 经纪公司代码
  BrokerID: string;
  // 合约代码
  InstrumentID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平中金现货期权交易所保证金率
export interface ICThostFtdcSyncDeltaOptExchMarginField {
  // 经纪公司代码
  BrokerID: string;
  // 合约代码
  InstrumentID: string;
  // 投机空头保证金调整系数
  SShortMarginRatioByMoney: number;
  // 投机空头保证金调整系数
  SShortMarginRatioByVolume: number;
  // 保值空头保证金调整系数
  HShortMarginRatioByMoney: number;
  // 保值空头保证金调整系数
  HShortMarginRatioByVolume: number;
  // 套利空头保证金调整系数
  AShortMarginRatioByMoney: number;
  // 套利空头保证金调整系数
  AShortMarginRatioByVolume: number;
  // 做市商空头保证金调整系数
  MShortMarginRatioByMoney: number;
  // 做市商空头保证金调整系数
  MShortMarginRatioByVolume: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平中金现货期权投资者保证金率
export interface ICThostFtdcSyncDeltaOptInvstMarginField {
  // 合约代码
  InstrumentID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机空头保证金调整系数
  SShortMarginRatioByMoney: number;
  // 投机空头保证金调整系数
  SShortMarginRatioByVolume: number;
  // 保值空头保证金调整系数
  HShortMarginRatioByMoney: number;
  // 保值空头保证金调整系数
  HShortMarginRatioByVolume: number;
  // 套利空头保证金调整系数
  AShortMarginRatioByMoney: number;
  // 套利空头保证金调整系数
  AShortMarginRatioByVolume: number;
  // 是否跟随交易所收取
  IsRelative: number;
  // 做市商空头保证金调整系数
  MShortMarginRatioByMoney: number;
  // 做市商空头保证金调整系数
  MShortMarginRatioByVolume: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平期权标的调整保证金率
export interface ICThostFtdcSyncDeltaInvstMarginRateULField {
  // 合约代码
  InstrumentID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 多头保证金率
  LongMarginRatioByMoney: number;
  // 多头保证金费
  LongMarginRatioByVolume: number;
  // 空头保证金率
  ShortMarginRatioByMoney: number;
  // 空头保证金费
  ShortMarginRatioByVolume: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平期权手续费率
export interface ICThostFtdcSyncDeltaOptInvstCommRateField {
  // 合约代码
  InstrumentID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 开仓手续费率
  OpenRatioByMoney: number;
  // 开仓手续费
  OpenRatioByVolume: number;
  // 平仓手续费率
  CloseRatioByMoney: number;
  // 平仓手续费
  CloseRatioByVolume: number;
  // 平今手续费率
  CloseTodayRatioByMoney: number;
  // 平今手续费
  CloseTodayRatioByVolume: number;
  // 执行手续费率
  StrikeRatioByMoney: number;
  // 执行手续费
  StrikeRatioByVolume: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平期货手续费率
export interface ICThostFtdcSyncDeltaInvstCommRateField {
  // 合约代码
  InstrumentID: string;
  // 投资者范围
  InvestorRange: TThostFtdcInvestorRangeType;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 开仓手续费率
  OpenRatioByMoney: number;
  // 开仓手续费
  OpenRatioByVolume: number;
  // 平仓手续费率
  CloseRatioByMoney: number;
  // 平仓手续费
  CloseRatioByVolume: number;
  // 平今手续费率
  CloseTodayRatioByMoney: number;
  // 平今手续费
  CloseTodayRatioByVolume: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平交叉汇率
export interface ICThostFtdcSyncDeltaProductExchRateField {
  // 产品代码
  ProductID: string;
  // 报价币种类型
  QuoteCurrencyID: string;
  // 汇率
  ExchangeRate: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平行情
export interface ICThostFtdcSyncDeltaDepthMarketDataField {
  // 交易日
  TradingDay: string;
  // 合约代码
  InstrumentID: string;
  // 交易所代码
  ExchangeID: string;
  // 合约在交易所的代码
  ExchangeInstID: string;
  // 最新价
  LastPrice: number;
  // 上次结算价
  PreSettlementPrice: number;
  // 昨收盘
  PreClosePrice: number;
  // 昨持仓量
  PreOpenInterest: number;
  // 今开盘
  OpenPrice: number;
  // 最高价
  HighestPrice: number;
  // 最低价
  LowestPrice: number;
  // 数量
  Volume: number;
  // 成交金额
  Turnover: number;
  // 持仓量
  OpenInterest: number;
  // 今收盘
  ClosePrice: number;
  // 本次结算价
  SettlementPrice: number;
  // 涨停板价
  UpperLimitPrice: number;
  // 跌停板价
  LowerLimitPrice: number;
  // 昨虚实度
  PreDelta: number;
  // 今虚实度
  CurrDelta: number;
  // 最后修改时间
  UpdateTime: string;
  // 最后修改毫秒
  UpdateMillisec: number;
  // 申买价一
  BidPrice1: number;
  // 申买量一
  BidVolume1: number;
  // 申卖价一
  AskPrice1: number;
  // 申卖量一
  AskVolume1: number;
  // 申买价二
  BidPrice2: number;
  // 申买量二
  BidVolume2: number;
  // 申卖价二
  AskPrice2: number;
  // 申卖量二
  AskVolume2: number;
  // 申买价三
  BidPrice3: number;
  // 申买量三
  BidVolume3: number;
  // 申卖价三
  AskPrice3: number;
  // 申卖量三
  AskVolume3: number;
  // 申买价四
  BidPrice4: number;
  // 申买量四
  BidVolume4: number;
  // 申卖价四
  AskPrice4: number;
  // 申卖量四
  AskVolume4: number;
  // 申买价五
  BidPrice5: number;
  // 申买量五
  BidVolume5: number;
  // 申卖价五
  AskPrice5: number;
  // 申卖量五
  AskVolume5: number;
  // 当日均价
  AveragePrice: number;
  // 业务日期
  ActionDay: string;
  // 上带价
  BandingUpperPrice: number;
  // 下带价
  BandingLowerPrice: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平现货指数
export interface ICThostFtdcSyncDeltaIndexPriceField {
  // 经纪公司代码
  BrokerID: string;
  // 合约代码
  InstrumentID: string;
  // 指数现货收盘价
  ClosePrice: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}

// 风险结算追平仓单折抵
export interface ICThostFtdcSyncDeltaEWarrantOffsetField {
  // 交易日期
  TradingDay: string;
  // 经纪公司代码
  BrokerID: string;
  // 投资者代码
  InvestorID: string;
  // 交易所代码
  ExchangeID: string;
  // 合约代码
  InstrumentID: string;
  // 买卖方向
  Direction: TThostFtdcDirectionType;
  // 投机套保标志
  HedgeFlag: TThostFtdcHedgeFlagType;
  // 数量
  Volume: number;
  // 操作标志
  ActionDirection: TThostFtdcActionDirectionType;
  // 追平序号
  SyncDeltaSequenceNo: number;
}
