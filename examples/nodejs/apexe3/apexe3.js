/**
 * apexe3.js
 * 
 * Wrapper and utility functions for the APEX:E3 API defined here:
 * https://api.ae3platform.com/docs
 * 
 * Disclaimer:
 * APEX:E3 is a financial technology company based in the United Kingdom https://www.apexe3.com
 * None of this code constitutes financial advice. APEX:E3 is not 
 * liable for any loss resulting from the use of this code or the API. 
 * 
 * This code is governed by The MIT License (MIT)
 * 
 * Copyright (c) 2020 APEX:E3 Team
 * 
 **/

const _ = require('lodash');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const { Base64 } = require('js-base64');
const { emit } = require('process');
const emitter = require('events').EventEmitter;
const authUrl = 'https://keycloak.ae3platform.com/auth/realms/ApexE3/protocol/openid-connect/token';
const requestApiUrl = 'https://api.ae3platform.com';
const websocketUrl = 'wss://ws.ae3platform.com';
const appUrl = "https://app.ae3platform.com/";
var ohlcvRestApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCV";
var ohlcvRestTwoAssetsApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCVTwoAssets";
var ohlcvExchangeRestApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCVHistory";
var marketCapRestApiUrl = "https://www.apexe3.ai/__/data-service/fetchMarketCap";
var backtestingRestApiUrl = "https://www.apexe3.ai/__/backtesting-service/runBacktest";
const INVALID_CREDS_MESSAGE = [['Your APEX:E3 Client Id or Client Secret is invalid. You need valid credentials to recieve data.']];

//screener filter values for reference
const rsi = ["rsi14d_gte_80_lt_90",
  , "rsi14d_gte_90_lt_100"
  , "rsi14d_gte_70_lt_80"
  , "rsi14d_gte_60_lt_70"
  , "rsi14d_gte_40_lt_50"
  , "rsi14d_gte_30_lt_40"
  , "rsi14d_gte_20_lt_30"
  , "rsi14d_gte_10_lt_20"
  , "rsi14d_lt_60_gt_0"
  , "rsi14d_lt_b50_gt_0"
  , "rsi14d_gt_50_lt_101"
  , "rsi14d_gt_40_lt_101"];

const smaCross = ["p20dSMAxAbove", "p20dSMAxBelow", "p50dSMAxBelow", "p50dSMAxAbove"];
const volatility = ["vltWeekChg_gt_3",
  , "vltWeekChg_gt_4"
  , "vltWeekChg_gt_5"
  , "vltWeekChg_gt_6"
  , "vltWeekChg_gt_7"
  , "vltWeekChg_gt_8"
  , "vltWeekChg_gt_9"
  , "vltWeekChg_gt_10"
  , "vltWeekChg_gt_12"
  , "vltWeekChg_gt_15"
  , "vltWeekChg_gt_20"
  , "vltMonChg_gt_3"
  , "vltMonChg_gt_4"
  , "vltMonChg_gt_5"
  , "vltMonChg_gt_6"
  , "vltMonChg_gt_7"
  , "vltMonChg_gt_8"
  , "vltMonChg_gt_9"
  , "vltMonChg_gt_10"
  , "vltMonChg_gt_12"
  , "vltMonChg_gt_15"
  , "vltMonChg_gt_20"];

const bollingerBandsAboveMiddle = 'above-middle';
const bollingerBandsAboveUpper = "above-upper";
const bollingerBandsAboveLower = "above-lower";
const bollingerBandsBelowLower = "below-lower";
const bollingerBandsTightBands = "tight-bands";
const fibRetracements = ["fibRetracement_gte_0_lte_0.236", "fibRetracement_gt_0.236_lte_0.382", "fibRetracement_gt_0.382_lte_0.5", "fibRetracement_gt_0.5_lte_0.619", "fibRetracement_gt_0.619_lte_0.786", "fibRetracement_gt_0.786_lte_1"];
const trends = ["neutral", "uptrend", "downtrend"];
const ichimoku = ["withinCloud", "aboveCloud", "belowCloud"];

//singleton state
const assetIdToCannonicalId = new Map();
let stream = null;
let activeStreamsCount = 0;
let streamIds = new Map();
let globalOrderbookBids = [];  //in-memory global orderbook of bids
let globalOrderbookAsks = [];  //in-memory global orderbook of asks
let liveLiquidty = [];         //in-memory live liquidity   
let liveLiquidityStats = [];   //in-memory live liquidity stats
let accessToken = '';


module.exports = {

  /**
   * Initialises the assetId to cannonical id map 
   */
  async initialiseAssetIdToCannonicalId() {
    const assets = await this.fetchReferenceData('/reference/assets');
    _.map(assets, (asset) => {
      assetIdToCannonicalId.set(asset.n, asset.id);
    })
  },

  /**
   * Authenticates and retrieves the autentication token used by subsequent calls 
   * 
   * @param {*} clientId 
   * @param {*} clientSecret 
   */
  async initialise(clientId, clientSecret) {

    this.accessToken = await this.obtainAccessToken(clientId, clientSecret);
    await this.initialiseAssetIdToCannonicalId();

  },
  /**
   * Uses the supplied parameters to authenticate and obtain a valid JWT token
   * 
   * @param {*} clientId 
   * @param {*} clientSecret 
   */
  async obtainAccessToken(clientId, clientSecret) {

    console.log(`--------- Authenticating ---------\n\n`);
    const data = new URLSearchParams();
    data.append('grant_type', 'client_credentials');
    data.append('client_id', clientId);
    data.append('client_secret', clientSecret);
    const authRespose = await fetch(authUrl, {
      method: "POST",
      body: data,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: "*",
      },
    });
    const accessToken = await authRespose.json().then((v) => v.access_token);
    console.log('--------- Authentication Token Obtained ---------\n\n');
    console.log(accessToken);
    console.log('\n\n');

    return accessToken;


  },
  /**
   * 
   * Calls the API based on the spec defined in:
   * https://api.ae3platform.com/docs#tag/Reference
   * 
   * @param {*} endpointUrlPart 
   */
  async fetchReferenceData(endpointUrlPart) {

    const referenceListUrl = requestApiUrl + endpointUrlPart;

    const references = await fetch(referenceListUrl, {
      method: "GET",
      headers: {
        'Authorization': 'bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
    });

    return references.json().then((references) => { return references.result });
  },

  /**
   * 
   * Retrieves a list of all supported exchanges
   * 
   */
  async fetchExchangeList() {

    const referenceListUrl = requestApiUrl + '/reference/exchanges';

    const references = await fetch(referenceListUrl, {
      method: "GET",
      headers: {
        'Authorization': 'bearer ' + this.accessToken,
        'Content-Type': 'application/json'
      },
    });

    return await references.json().then((references) => { return _.map(references.result, 'id') });

  },

  /**
   * 
   * Retrieves a list of exchanges for the provided pair
   * 
   * @param {*} base 
   * @param {*} quote 
   */
  async fetchExchangesForPair(base, quote) {

    base = convertSymbolPart(base);
    quote = convertSymbolPart(quote);

    const supportedMarkets = await this.fetchReferenceData('/reference/markets');

    //assumption, only one market should exist
    let market = _.filter(supportedMarkets, (market) => {

      return market.b === base && market.q === quote && market.f === '';


    })[0]

    return market != null ? market.e : null;

  },

  /**
   * Initialises the websocket with the provided configurations.
   * This is based on the API spec found in:
   * https://api.ae3platform.com/docs#section/Endpoints/Websocket-API
   * 
   * All messages from the server are parsed and emitted for downstream
   * processing.
   * 
   * @param {*} subscriptionRequests 
   */
  async initialiseStream(subscriptionRequests) {

    if (subscriptionRequests == null || subscriptionRequests == {} || subscriptionRequests === '') {
      console.log('You need to specify at least one subscription request');
      return null;
    } else { }
    const wsEmitter = new emitter();
    const websocketUrlWithToken = `${websocketUrl}?token=${this.accessToken}`;
    stream = new WebSocket(websocketUrlWithToken);

    stream.on("upgrade", (res) => { })

    stream.onopen = (e) => {

      setInterval(() => {
        stream.send(JSON.stringify({ action: "HEARTBEAT" }));
      }, 5000);


      stream.onerror = (error) => {
        console.log(`WebSocket error:`, error);
      };

      subscriptionRequests.forEach(subsciptionRequest => {
        stream.send(JSON.stringify(subsciptionRequest));
      });

    }

    stream.onmessage = (msg) => {
      console.log(`\n\n--------- Message From Stream ---------\n\n`);
      if (msg && msg.data) {

        const parsedMsg = JSON.parse(msg.data);

        setActiveStreamsCount(parsedMsg);
        setActiveSubscriptionIds(parsedMsg);
        if (parsedMsg.subId) {
          const decodedMetaData = JSON.parse(Base64.decode(parsedMsg.subId));
          parsedMsg.metaData = decodedMetaData;

          wsEmitter.emit('MessagesFromStream', parsedMsg);

          if (decodedMetaData && decodedMetaData.event === 'INSIGHTS') {

            if (decodedMetaData.analyticType === 'SPREAD') {

              wsEmitter.emit('SPREAD', parsedMsg);

            } else if (decodedMetaData.analyticType === 'SPREAD_NEGATIVE') {

              wsEmitter.emit('ARBITRAGE', parsedMsg);


            } else if (decodedMetaData.analyticType === 'VOI_BID') {

              wsEmitter.emit('VOI_BID', parsedMsg);


            } else if (decodedMetaData.analyticType === 'VOI_ASK') {

              wsEmitter.emit('VOI_ASK', parsedMsg);


            } else if (decodedMetaData.analyticType === 'WHALE') {

              wsEmitter.emit('WHALE', parsedMsg);


            } else { }

          } if (decodedMetaData && decodedMetaData.event === 'ORDERBOOK') {

            //wsEmitter.emit('ORDERBOOK', parsedMsg);
            wsEmitter.emit('GLOBAL_ORDERBOOK', updateGlobalOrderbook(parsedMsg));
            const liveLiquidity = updateLiveLiquidity(parsedMsg);
            wsEmitter.emit('LIVE_LIQUIDITY', liveLiquidity);
            wsEmitter.emit('LIVE_LIQUIDITY_STATS', updateLiveLiquidityStats(liveLiquidity));

          } else { }

        } else { }



      } else { }
    };


    return wsEmitter;

  },

  /**
   * Sets up a real-time global orderbook for the supplied parameters. The definition of the 
   * orderbook can be found here:
   * https://api.ae3platform.com/docs#operation/OrderbookController_root
   * 
   * @param {*} base 
   * @param {*} quote 
   * @param {*} exchange 
   * @param {*} marketType 
   */
  async initialiseGlobalOrderbook(base, quote, exchange, marketType) {

    base = convertSymbolPart(base);
    quote = convertSymbolPart(quote);

    const orderbookConfigs = await this.generateDefaultGlobalOrderbookStreamConfigurations(base, quote, exchange, marketType);
    const stream = await this.initialiseStream(orderbookConfigs);
    return stream;

  },

  /**
   * 
   * Default insights configurations for the specified pair.
   * These will be supplied to the websocket, which in return
   * will stream insights. Insight detail can be found here:
   * https://api.ae3platform.com/docs#tag/Analytics
   * 
   * @param {*} base 
   * @param {*} quote 
   */
  async initialiseDefaultInsightsForPair(base, quote) {

    base = convertSymbolPart(base);
    quote = convertSymbolPart(quote);

    const analyticsConfigs = await this.generateInsightsStreamConfigurions(base, quote);
    const stream = await this.initialiseStream(analyticsConfigs);
    return stream

  },
  /**
   * Default global orderbook configuration for the specified pair and parameters.
   * These will be supplied to the websocket, which in return
   * will stream the global orderbook across exchanges. Orderbook detail can be found here:
   * https://api.ae3platform.com/docs#tag/Orderbook
   * 
   * @param {*} base 
   * @param {*} quote 
   * @param {*} exchange 
   * @param {*} marketType 
   */
  async generateDefaultGlobalOrderbookStreamConfigurations(base, quote, exchange = null, marketType = 'SPOT') {

    base = convertSymbolPart(base);
    quote = convertSymbolPart(quote);

    const streamConfigs = [];
    let exchangesForPair

    if (exchange != null) {
      exchangesForPair = [exchange];
    } else {

      exchangesForPair = await this.fetchExchangesForPair(base, quote);
    }

    if (marketType == null) {
      marketType = 'SPOT';
    } else { }


    const globalOrderbookSubscriptionConfig = {
      action: "SUBSCRIBE",
      data: {
        event: 'ORDERBOOK',
        baseId: base,
        quoteId: quote,
        futureId: null,
        exchangeId: exchangesForPair,
        marketType: marketType
      },
    };

    streamConfigs.push(globalOrderbookSubscriptionConfig);

    return streamConfigs;
  },

  /**
   * 
   * Default insights configurations for the specified pair.
   * These will be supplied to the websocket, which in return
   * will stream insights. Insight detail can be found here:
   * https://api.ae3platform.com/docs#tag/Analytics
   * 
   * @param {*} base 
   * @param {*} quote 
   */
  async generateInsightsStreamConfigurions(base, quote) {

    base = convertSymbolPart(base);
    quote = convertSymbolPart(quote);

    const streamConfigs = [];

    //Top Bid Volume Order Imbalances
    const bidImbalanceSubscriptionConfig = {
      action: "SUBSCRIBE",
      data: {
        event: "INSIGHTS",
        baseId: base,
        quoteId: quote,
        futureId: null,
        exchangeId: null,
        marketType: "SPOT",
        analyticType: "VOI_BID",
        analyticSize: "ALL",
        analyticPivot: "PAIR",
        assetClassification: "ALT",

      },
    };

    //Top ASK Volume Order Imbalances
    const askImbalanceSubscriptionConfig = {
      action: "SUBSCRIBE",
      data: {
        event: "INSIGHTS",
        baseId: base,
        quoteId: quote,
        futureId: null,
        exchangeId: null,
        marketType: "SPOT",
        analyticType: "VOI_ASK",
        analyticSize: "ALL",
        analyticPivot: "PAIR",
        assetClassification: "ALT",

      },
    };

    //Whales
    const whalesSubscriptionConfig = {
      action: "SUBSCRIBE",
      data: {
        event: "INSIGHTS",
        baseId: base,
        quoteId: quote,
        futureId: null,
        exchangeId: null,
        marketType: "SPOT",
        analyticType: "WHALE",
        analyticSize: "ALL",
        analyticPivot: "PAIR",
        assetClassification: "ALT",

      },
    };

    //Spreads
    const spreadsSubscriptionConfig = {
      action: "SUBSCRIBE",
      data: {
        event: "INSIGHTS",
        baseId: base,
        quoteId: quote,
        futureId: null,
        exchangeId: null,
        marketType: "SPOT",
        analyticType: "SPREAD",
        analyticSize: "ALL",
        analyticPivot: "PAIR",
        assetClassification: "ALT",

      },
    };

    const negativeSpreadsSubscriptionConfig = {
      action: "SUBSCRIBE",
      data: {
        event: "INSIGHTS",
        baseId: null,
        quoteId: null,
        futureId: null,
        exchangeId: null,
        marketType: "SPOT",
        analyticType: "SPREAD_NEGATIVE",
        analyticSize: "ALL",
        analyticPivot: "ALL",
        assetClassification: "ALT",
      }
    }


    streamConfigs.push(bidImbalanceSubscriptionConfig);
    streamConfigs.push(whalesSubscriptionConfig);
    streamConfigs.push(askImbalanceSubscriptionConfig);
    streamConfigs.push(spreadsSubscriptionConfig);
    streamConfigs.push(negativeSpreadsSubscriptionConfig);

    return streamConfigs;

  },

  /**
   * 
   * Provides the ability to programatically screen markets. 
   * Example implementation can be found here:
   * https://app.ae3platform.com/
   * 
   * @param {*} base 
   * @param {*} quote 
   * @param {*} exchanges
   * @param {*} rsi 
   * @param {*} smaCross 
   * @param {*} volatility 
   * @param {*} weeklyOpenChg 
   * @param {*} bollingerBand 
   * @param {*} fibRetracements 
   * @param {*} trends 
   * @param {*} ichimoku 
   */
  async screen(base, quote, exchanges, rsi, smaCross, volatility, weeklyOpenChg, bollingerBand, fibRetracements, trends, ichimoku) {
    return await screen(base, quote, exchanges, rsi, smaCross, volatility, weeklyOpenChg, bollingerBand, fibRetracements, trends, ichimoku);
  },
  /**
   * 
   * On-demand global orderbook for pair
   * 
   * @param {*} base 
   * @param {*} quote 
   * @param {*} marketType 
   */
  async fetchGlobalOrderbookForPair(base, quote, marketType) {

    base = convertSymbolPart(base);
    quote = convertSymbolPart(quote);

    var encodedBase = encodeURIComponent(base);
    var encodedQuote = encodeURIComponent(quote);

    var params = 'baseId=' + encodedBase + '&quoteId=' + encodedQuote + '&aggregate=true';
    var url = requestApiUrl + '/orderbook/' + marketType + '?' + params;

    var creds = getOptions(this.accessToken);

    if (this.accessToken === '' || this.accessToken == null) {
      console.log('Invalid credentials');
      return null;
    } else { }

    var response = await fetch(url, creds);

    var entities = await response.json().then((r) => r.result);

    var bids = [];
    var asks = [];

    var global = [];


    for (var i = 0; i < entities.length; i++) {
      for (var j = 0; j < Math.min(entities[i].bids.length, entities[i].asks.length); j++) {
        try {
          var bidRow = [entities[i].e, entities[i].bids[j][1], entities[i].bids[j][0]]
          bids.push(bidRow);

          var askRow = [entities[i].asks[j][0], entities[i].asks[j][1], entities[i].e]
          asks.push(askRow);
        }
        catch (e) { }
      }
    }

    //bids descending
    bids = bids.sort(compareBidsDesc);
    //asks ascending
    asks = asks.sort(compareAsksAsc);

    var globalAggLength = Math.min(bids.length, asks.length);

    for (var i = 0; i < globalAggLength; i++) {
      var row = [bids[i][0], bids[i][1], bids[i][2], asks[i][0], asks[i][1], asks[i][2]];
      global.push(row);
    }

    return global;

  },

  /**
   * 
   * Fetching aggregated OHLCV pricing data for digital and traditional assets
   * 
   * Using standard symbol lookup
   * 
   * @param {*} asset 
   * @param {*} from 
   * @param {*} to 
   * @param {*} interval 
   */
  async fetchAggregatedOHLCV(asset, from, to, interval) {

    try {

      if (this.accessToken === '' || this.accessToken == null) {
        console.log('Invalid credentials');
        return null;
      } else { }

      var encodedAsset = encodeURIComponent(asset);
      var params = 'symbol=' + encodedAsset + '&from=' + from + '&to=' + to + '&interval=' + interval;
      var url = ohlcvRestApiUrl + '?' + params;
      var creds = getOptions(this.accessToken);
      var response = await fetch(url, creds);

      return await response.json().then((r) => r.result);


    } catch (e) {

      return [['problem fetching content ' + e]];

    }
  },

  /**
   * 
   * Fetches OHLCV data for a given crypto exchange, base and quote
   * over the specified interval and timeframe.
   * 
   * Supported time frames: 1min | 15min | 1hr | 4hr | 24hr
   * 
   * @param {*} exchange 
   * @param {*} base 
   * @param {*} quote 
   * @param {*} from 
   * @param {*} to 
   * @param {*} timeFrame 
   */
  async fetchOHLCVForExchange(exchange, base, quote, from, to, timeFrame, assetType, marketType) {

    try {

      if (this.accessToken === '' || this.accessToken == null) {
        console.log('Invalid credentials');
        return null;
      } else { }

      var params = 'exchange=' + exchange + '&base=' + base + '&quote=' + quote + '&from=' + from + '&to=' + to + '&timeFrame=' + timeFrame + '&assetType=' + assetType + '&marketType=' + marketType;
      var url = ohlcvExchangeRestApiUrl + '?' + params;
      var creds = getOptions(this.accessToken);
      var response = await fetch(url, creds);

      return await response.json().then((r) => r);

    } catch (e) {

      return [['problem fetching content ' + e]];

    }
  },

  /**
   * 
   * Retrieves Market Cap history
   * for the specified symbol and date range
   * 
   * @param {*} symbol 
   * @param {*} from 
   * @param {*} to 
   */
  async fetchMarketCapForCryptoSymbol(symbol, from, to ){
    try {

      if (this.accessToken === '' || this.accessToken == null) {
        console.log('Invalid credentials');
        return null;
      } else { }

      var params = 'symbol=' + symbol + '&from=' + from + '&to=' + to ;
      var url = marketCapRestApiUrl + '?' + params;
      var creds = getOptions(this.accessToken);
      var response = await fetch(url, creds);

      return await response.json().then((r) => r);

    } catch (e) {

      return [['problem fetching content ' + e]];

    }


  },

  /**
   * 
   * Run a backtest by supplying relevant parameters
   * 
   * @param {*} startingCapital 
   * @param {*} exchange 
   * @param {*} base 
   * @param {*} quote 
   * @param {*} from 
   * @param {*} indicatorParams 
   * @param {*} stategyParams 
   */
  async runBacktest(startingCapital, exchange, base, quote, from, to, indicatorParams, strategyParams, assetType, marketType) {
    try {

      if (this.accessToken === '' || this.accessToken == null) {
      
        console.log('Invalid credentials');
        return null;
      } else { }


      let indicator1 = indicatorParams.indicator1;
      let indicator2 = indicatorParams.indicator2;

      var params =
        'exchange=' + exchange
        + '&base=' + base
        + '&quote=' + quote
        + '&from=' + from
        + '&to=' + to
        + '&timeFrame=1d'
        + '&startingCapital=' + startingCapital
        + '&indicator1.type=' + indicator1.type
        + '&indicator1.period=' + indicator1.period
        + '&indicator1.priceComponent=' + indicator1.priceComponent
        + '&indicator2.type=' + indicator2.type
        + '&indicator2.period=' + indicator2.period
        + '&indicator2.priceComponent=' + indicator2.priceComponent
        + '&indicator1.stdDevUpper=' + indicator1.stdDevUpper
        + '&indicator1.stdDevLower=' + indicator1.stdDevLower
        + '&indicator2.stdDevUpper=' + indicator2.stdDevUpper
        + '&indicator2.stdDevLower=' + indicator2.stdDevLower
        + '&indicator1.shortPeriod=' + indicator1.shortPeriod
        + '&indicator1.longPeriod=' + indicator1.longPeriod
        + '&indicator1.signalPeriod=' + indicator1.signalPeriod
        + '&indicator2.shortPeriod=' + indicator2.shortPeriod
        + '&indicator2.longPeriod=' + indicator2.longPeriod
        + '&indicator2.signalPeriod=' + indicator2.signalPeriod
        + '&entryDirection=' + strategyParams.entryDirection
        + '&entryIndicator1=' + strategyParams.entryIndicator1
        + '&entryOperator=' + strategyParams.entryOperator
        + '&entryIndicator2=' + strategyParams.entryIndicator2
        + '&exitIndicator1=' + strategyParams.exitIndicator1
        + '&exitOperator=' + strategyParams.exitOperator
        + '&exitIndicator2=' + strategyParams.exitIndicator2
        + '&stopLoss=' + strategyParams.stopLoss
        + '&marketType=' + marketType
        + '&assetType=' + assetType;

      var url = backtestingRestApiUrl + '?' + params;

      var creds = getOptions(this.accessToken);
      var response = await fetch(url, creds);

      return await response.json().then((r) => r);

    } catch (e) {

      return { result: ['Unable to run backtest'] };
    }

  }

}

/**
 * 
 * Maintains a count of the active numnber of subscriptions
 * 
 * @param {*} parsedMsg 
 */
function setActiveStreamsCount(parsedMsg) {

  if (parsedMsg != null) {

    if (parsedMsg.totalActiveSubscriptions) {
      activeStreamsCount = parsedMsg.totalActiveSubscriptions;
    } else { }

  } else { };
}

/**
 * 
 * Maintains the id's of the active subscriptions
 * 
 * @param {*} parsedMsg 
 */
function setActiveSubscriptionIds(parsedMsg) {

  if (parsedMsg != null && parsedMsg.event == 'SUBSCRIPTION_INFO') {

    console.log('sub info recieved', parsedMsg.totalActiveSubscriptions);

    for (var i = 0; i < parsedMsg.activeSubscriptions.length; i++) {

      console.log(parsedMsg.activeSubscriptions[i].id);
      streamIds.set(parsedMsg.activeSubscriptions[i].id, parsedMsg.activeSubscriptions[i].id);

    }


  } else { }

}


/**
 * 
 * Updates the in-memory global orderbook
 * 
 * @param {*} parsedMsg 
 */
function updateGlobalOrderbook(parsedMsg) {


  const exchange = parsedMsg.e;
  const bids = parsedMsg.bids;
  const asks = parsedMsg.asks;

  bids.forEach(element => {
    element.push(exchange);
  });
  asks.forEach(element => {
    element.push(exchange);
  });

  globalOrderbookBids = _.remove(globalOrderbookBids, (row) => {
    return row[5] != exchange;
  });

  globalOrderbookAsks = _.remove(globalOrderbookAsks, (row) => {
    return row[5] != exchange;
  });


  globalOrderbookBids = _.concat(globalOrderbookBids, bids);
  globalOrderbookAsks = _.concat(globalOrderbookAsks, asks);

  //sort bids descending price
  globalOrderbookBids = _.orderBy(globalOrderbookBids, (row) => {

    return row[0];

  }, 'desc');

  globalOrderbookAsks = _.orderBy(globalOrderbookAsks, (row) => {

    return row[0];

  }, 'asc');


  return {
    bids: globalOrderbookBids,
    asks: globalOrderbookAsks,
  }

}



/**
 * 
 * Aggregation of live liquidity
 * 
 * @param {*} liveLiquidity 
 */
function updateLiveLiquidityStats(liveLiquidity) {

  liveLiquidityStats = [];

  const totalAvailableLiquidity = _.sumBy(liveLiquidity, (liquidity) => {

    return liquidity[1];

  });

  const totalAvailableAsset = _.sumBy(liveLiquidity, (liquidity) => {

    return liquidity[3];

  });

  const totalImbalance = _.sumBy(liveLiquidity, (liquidity) => {

    return liquidity[4];

  });

  liveLiquidityStats.push([totalAvailableLiquidity, totalAvailableAsset, totalImbalance]);

  return liveLiquidityStats;


}

/**
 * 
 * Aggregates liquidity across exchanges in real-time, producing the following structure:
 * 
 * |exchange | ask liquidity | bid liquidity | imbalance | market price | volume
 * 
 * This can be used to perform smart order routing across exchanges
 * 
 * @param {*} parsedMsg 
 */
function updateLiveLiquidity(parsedMsg) {

  const exchange = parsedMsg.e;
  const bids = parsedMsg.bids;
  const asks = parsedMsg.asks;

  liveLiquidty = _.remove(liveLiquidty, (row) => {

    return row[0] != exchange;

  });

  if (asks.length > 0 && bids.length > 0) {
    let askLiquidity = asks[asks.length - 1][4];
    let bidLiquidity = bids[bids.length - 1][4];
    let imbalance = askLiquidity - bidLiquidity;
    let cumAskQty = asks[asks.length - 1][2];
    let marketPrice = askLiquidity / cumAskQty;
    let assetAmount = askLiquidity / marketPrice;

    liveLiquidty.push([exchange, askLiquidity, bidLiquidity, assetAmount, imbalance, marketPrice]);

    liveLiquidty = _.orderBy(liveLiquidty, (row) => {

      return row[5];

    }, 'asc');

    return liveLiquidty;

  } else { }

}

/**
 * 
 * Provides the ability to programatically screen markets. 
 * Example implementation can be found here:
 * https://app.ae3platform.com/
 * 
 * @param {*} base 
 * @param {*} quote 
 * @param {*} exchanges
 * @param {*} rsi 
 * @param {*} smaCross 
 * @param {*} volatility 
 * @param {*} weeklyOpenChg 
 * @param {*} bollingerBand 
 * @param {*} fibRetracements 
 * @param {*} trends 
 * @param {*} ichimoku 
 */
async function screen(base, quote, exchanges, rsi, smaCross, volatility, weeklyOpenChg, bollingerBand, fibRetracements, trends, ichimoku) {
  base = convertSymbolPart(base);
  quote = convertSymbolPart(quote);

  var url = appUrl + "graphql";

  var query = "query recent($filters: RecentFilters, $sortBy: SortBy) {  recent(filters: $filters, sortBy: $sortBy) {items {hash exchangeId baseId quoteId marketType v30dChg v24HrChg v30dSum v24HrSum p24HrChg p7dChg p15MinChg pLast p1HrChg v24HrVsV30dSum __typename} exchanges quotes bases __typename}}";

  var data = [{
    "operationName": "recent",

    "variables": {
      "filters": {
        "exchanges": exchanges,
        "bases": base,
        "quote": quote,
        "rsi": rsi,
        "smaCross": smaCross,
        "volatility": volatility,
        "weeklyOpenChg": weeklyOpenChg,
        "bollingerBands": bollingerBand,
        "fibRetracement": fibRetracements,
        "trend": trends,
        "ichimoku": ichimoku


      },
      "sortBy": {
        "colId": "v30dSum",
        "sort": "desc"

      }

    },

    "query": query


  }];


  const references = await fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "content-type": "application/json" },
  });

  return references.json().then((stats) => { return stats[0].data.recent.items });

}

/**
 * 
 * Facilitates non-cannonical identifier lookup
 * 
 * @param {*} part 
 */
function convertSymbolPart(part) {

  part = part.toUpperCase();
  if (part != '' && ((part.indexOf(':CRYPTO') == -1) && (part.indexOf(':CCY') == -1))) {
    return assetIdToCannonicalId.get(part);
  } else { }

  return part;

}


/**
 * 
 * Helper function to generate requestion options
 * per the APEX:E3 API spec
 * 
 * @param accessToken 
 */
function getOptions(accessToken) {
  return {
    'method': 'get',
    'headers': { "Authorization": "bearer " + accessToken }
  };
}

/**
 * 
 * Helper function for bids descending sort
 * 
 * @param a 
 * @param b 
 */
function compareBidsDesc(a, b) {
  if (a[2] > b[2])
    return -1;
  if (a[2] < b[2])
    return 1;

  return 0;
}

/**
* 
* Helper function for asks descending sort
* 
* @param a 
* @param b 
*/
function compareAsksDesc(a, b) {
  if (a[0] > b[0])
    return -1;
  if (a[0] < b[0])
    return 1;
  return 0;
}

/**
* 
* Helper function for asks ascending sort
* 
* @param a 
* @param b 
*/
function compareAsksAsc(a, b) {
  if (a[0] > b[0])
    return 1;
  if (a[0] < b[0])
    return -1;
  return 0;
}

