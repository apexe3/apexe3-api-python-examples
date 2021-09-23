'''
/**
 * apexe3.py
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
'''


import requests
import websocket
import _thread
import time
import json
import urllib.parse
from operator import itemgetter
import pandas as pd
import numpy as np
import event_emitter as events
import base64
import pandas as pd
import ssl



#authUrl = "https://keycloak.ae3platform.com/auth/realms/ApexE3/protocol/openid-connect/token"
authUrl = 'https://apexe3.ai/auth/realms/ApexE3/protocol/openid-connect/token'
requestApiUrl = "https://api.ae3platform.com"
websocketUrl = "wss://ws.ae3platform.com"
appUrl = "https://app.ae3platform.com/"
ohlcvRestApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCV"
ohlcvRestTwoAssetsApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCVTwoAssets"
ohlcvExchangeRestApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCVHistory"
backtestingRestApiUrl = "https://www.apexe3.ai/__/backtesting-service/runBacktest"
marketCapRestApiUrl = "https://www.apexe3.ai/__/data-service/fetchMarketCap"
accessToken = ""
assetIdToCannonicalId = {}
globalOrderbookBids = []    #in-memory global orderbook of bids
globalOrderbookAsks = []    #in-memory global orderbook of asks
liveLiquidity = []          #in-memory live liquidity
activeStreamsCount = 0      #in-memory live liquidity stats
streamIds = {}
emitter = events.EventEmitter()

#screener filter values for reference
rsi = ["rsi14d_gte_80_lt_90"
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
  , "rsi14d_gt_40_lt_101"]

smaCross = ["p20dSMAxAbove", "p20dSMAxBelow", "p50dSMAxBelow", "p50dSMAxAbove"]
volatility = ["vltWeekChg_gt_3"
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
  , "vltMonChg_gt_20"]

bollingerBandsAboveMiddle = 'above-middle'
bollingerBandsAboveUpper = "above-upper"
bollingerBandsAboveLower = "above-lower"
bollingerBandsBelowLower = "below-lower"
bollingerBandsTightBands = "tight-bands"
fibRetracements = ["fibRetracement_gte_0_lte_0.236", "fibRetracement_gt_0.236_lte_0.382", "fibRetracement_gt_0.382_lte_0.5", "fibRetracement_gt_0.5_lte_0.619", "fibRetracement_gt_0.619_lte_0.786", "fibRetracement_gt_0.786_lte_1"]
trends = ["neutral", "uptrend", "downtrend"]
ichimoku = ["withinCloud", "aboveCloud", "belowCloud"]

'''
  /**
   * Initialises the assetId to cannonical id map 
   */
'''
def initialise_assetId_to_cannoicalId():
    global assetIdToCannonicalId
    assets = fetch_reference_data("/reference/assets")
    for asset in assets:
        assetIdToCannonicalId[asset['n']] = asset['id']

'''
  /**
   * Authenticates and retrieves the autentication token used by subsequent calls 
   * 
   * @param {*} clientId 
   * @param {*} clientSecret
   * @param {*} username
   * @param {*} password 
   */
'''
def initialise(clientId, clientSecret, username, password):
    global accessToken
    global emitter
    accessToken = obtain_access_token(clientId, clientSecret, username, password)
    #initialise_assetId_to_cannoicalId()
    return emitter

'''
    /**
    * 
    * Facilitates non-cannonical identifier lookup
    * 
    * @param {*} part 
    */
'''
def convert_symbol_part(part):
    part = str(part).upper()
    if part !='' and ((part.find(':CRYPTO')==-1) and (part.find(':CCY')==-1)):
    
        if(part in assetIdToCannonicalId):
            return assetIdToCannonicalId[part]
        else:
            return 'SYMBOL_NOT_FOUND'
    else:
        return part

    print(part)        

'''
    /**
    * Uses the supplied parameters to authenticate and obtain a valid JWT token
    * 
    * @param {*} clientId 
    * @param {*} clientSecret
    * @param {*} username
    * @param {*} password  
    */
'''
def obtain_access_token(clientId, clientSecret, username, password):
    print("--------- Authenticating ---------\n\n")
    data = {
        'grant_type': (None, 'password'),
        'client_id': (None, clientId),
        'client_secret': (None, clientSecret),
        'scope': 'openid',
        'username' : (None, username),
        'password' : (None, password)
    }
    r = requests.post(authUrl, data)
    result = r.json()

    if 'access_token' in result:
        accessToken = result['access_token']
        if accessToken:
            print("--------- Authentication Token Recieved ---------\n\n")
            print(accessToken)
            print("\n\n")
            return accessToken
        else:
            print(
                "--------- Authentication Token Not Recieved. Check creds ---------\n\n")
            return ""
    else:
        print("--------- Authentication Token Not Recieved. Check creds ---------\n\n")
        return ""

'''
    /**
    * 
    * Calls the API based on the spec defined in:
    * https://api.ae3platform.com/docs#tag/Reference
    * 
    * @param {*} endpointUrlPart 
    */
'''
def fetch_reference_data(endpointUrlPart):
    global accessToken

    referenceListUrl = requestApiUrl + endpointUrlPart
    headers = {
        'Authorization': 'bearer ' + accessToken,
        'Content-Type': 'application/json'
    }
    references = requests.get(referenceListUrl, headers=headers)
    if(references and 'result' in references.json()):
        return references.json()['result']
    else:
        return "references not found"

'''
  /**
   * 
   * Retrieves a list of exchanges for the provided pair
   * 
   * @param {*} base 
   * @param {*} quote 
   */
'''
def fetch_exchanges_for_pair(base,quote):
    #base = convert_symbol_part(base)
    #quote = convert_symbol_part(quote)
    
    base = base+':CRYPTO'
    quote = quote + ':CRYPTO'
    
    markets = fetch_reference_data("/reference/markets")
    for market in markets:
        if(market['b']==base and market['q']==quote and market['f']==''):
           print(market['e'])
           return market['e'] 
    
    print('market not found for ' + str(base) + ' ' + str(quote))

'''
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
'''
def generate_default_global_orderbook_stream_configurations(base, quote, exchanges, marketType):
    base = convert_symbol_part(base)
    quote = convert_symbol_part(quote)
    exchangesForPair = []

    if(exchanges != None):
        exchangesForPair = exchanges
    else:
        exchangesForPair = fetch_exchanges_for_pair(base,quote)
    
    streamConfigs = []
    subscriptionRequest = {
            "action": "SUBSCRIBE",
            "data": {
                "event": "ORDERBOOK",
                "baseId": base,
                "quoteId": quote,
                "exchangeId": exchangesForPair,
                "marketType": marketType,
                "assetClassification": "ALT",
            }
    }
    streamConfigs.append(subscriptionRequest)
    return streamConfigs

'''
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
'''
def generate_default_insights_stream_configurations(base,quote):
    base = convert_symbol_part(base)
    quote = convert_symbol_part(quote)

    streamConfigs = []

    bidImbalanceSubscriptionConfig = {
        "action": "SUBSCRIBE",
            "data": {
            "event": "INSIGHTS",
            "baseId": base,
            "quoteId": quote,
            "futureId": None,
            "exchangeId": None,
            "marketType": "SPOT",
            "analyticType": "VOI_BID",
            "analyticSize": "ALL",
            "analyticPivot": "PAIR",
            "assetClassification": "ALT"
        }
    }
    streamConfigs.append(bidImbalanceSubscriptionConfig) 

    askImbalanceSubscriptionConfig = {
        "action": "SUBSCRIBE",
            "data": {
            "event": "INSIGHTS",
            "baseId": base,
            "quoteId": quote,
            "futureId": None,
            "exchangeId": None,
            "marketType": "SPOT",
            "analyticType": "VOI_ASK",
            "analyticSize": "ALL",
            "analyticPivot": "PAIR",
            "assetClassification": "ALT"
        }
    }
    streamConfigs.append(askImbalanceSubscriptionConfig) 

    whalesSubscriptionConfig = {
        "action": "SUBSCRIBE",
            "data": {
            "event": "INSIGHTS",
            "baseId": base,
            "quoteId": quote,
            "futureId": None,
            "exchangeId": None,
            "marketType": "SPOT",
            "analyticType": "WHALE",
            "analyticSize": "ALL",
            "analyticPivot": "PAIR",
            "assetClassification": "ALT"
        }
    }
    streamConfigs.append(whalesSubscriptionConfig)

    spreadsSubscriptionConfig = {
    "action": "SUBSCRIBE",
        "data": {
            "event": "INSIGHTS",
            "baseId": base,
            "quoteId": quote,
            "futureId": None,
            "exchangeId": None,
            "marketType": "SPOT",
            "analyticType": "SPREAD",
            "analyticSize": "ALL",
            "analyticPivot": "PAIR",
            "assetClassification": "ALT",
        }
    }
    streamConfigs.append(spreadsSubscriptionConfig)

    spreadNegativeSubscriptionConfig = {
    "action": "SUBSCRIBE",
        "data": {
            "event": "INSIGHTS",
            "baseId": None,
            "quoteId": None,
            "futureId": None,
            "exchangeId": None,
            "marketType": "SPOT",
            "analyticType": "SPREAD_NEGATIVE",
            "analyticSize": "ALL",
            "analyticPivot": "ALL",
            "assetClassification": "ALT",
        }
    }
    streamConfigs.append(spreadNegativeSubscriptionConfig)
    return streamConfigs

'''
    /**
    * 
    * Updates the in-memory global orderbook
    * 
    * @param {*} parsedMsg 
    */
'''
def updateGlobalOrderbook(msg):
    global globalOrderbookBids
    global globalOrderbookAsks

    if('e' in msg):
        exchange = msg['e']
        bids = msg['bids']
        asks = msg['asks']
        
        for bid in bids:
            bid.append(exchange)
        
        for ask in asks:
            ask.append(exchange)

        for i in range(len(globalOrderbookBids)-1, -1, -1):
            if(globalOrderbookBids[i]!=None and len(globalOrderbookBids[i])==6 and globalOrderbookBids[i][5]==exchange):
                globalOrderbookBids.remove(globalOrderbookBids[i])

        for j in range(len(globalOrderbookAsks)-1, -1, -1):
            if(globalOrderbookAsks[j]!=None and len(globalOrderbookAsks[j])==6 and globalOrderbookAsks[j][5]==exchange):
                globalOrderbookAsks.remove(globalOrderbookAsks[j])
 

        for bid in bids:
            globalOrderbookBids.append(bid)         

        for ask in asks:
            globalOrderbookAsks.append(ask)   

        globalOrderbookBidsSorted = sorted(globalOrderbookBids, key=itemgetter(0), reverse=True)
        globalOrderbookAsksSorted = sorted(globalOrderbookAsks, key=itemgetter(0))

        return {"bids":globalOrderbookBidsSorted, "asks":globalOrderbookAsksSorted}


'''
  /**
   * 
   * On-demand global orderbook for pair
   * 
   * @param {*} base 
   * @param {*} quote 
   * @param {*} marketType 
   */
'''   
def fetch_global_orderbook_for_pair(base, quote, marketType):
    global accessToken

    base = convert_symbol_part(base)
    quote = convert_symbol_part(quote)

    encodedBase = urllib.parse.quote(base)
    encodedQuote = urllib.parse.quote(quote)

    params = 'baseId=' + encodedBase + '&quoteId=' + encodedQuote + '&aggregate=true'
    url = requestApiUrl + '/orderbook/' + marketType + '?' + params

    headersVal = { "Authorization": "bearer " + accessToken }
    response = requests.get(url, headers=headersVal)

    entities = response.json()["result"]

    bids = []
    asks = []

    globalOB = []

    for i in range(0,len(entities)):
      for j in range(0, min(len(entities[i]['bids']), len(entities[i]['asks']))):
        try:
          bidRow = [entities[i]['e'], entities[i]['bids'][j][1], entities[i]['bids'][j][0]]
          bids.append(bidRow)

          askRow = [entities[i]['asks'][j][0], entities[i]['asks'][j][1], entities[i]['e']]
          asks.append(askRow)

        except ValueError:
            print('')


    bids = sorted(bids, key=itemgetter(2), reverse=True)
    asks = sorted(asks, key=itemgetter(0))


    globalAggLength = min(len(bids), len(asks))

    for i in range(0,globalAggLength):
      row = [bids[i][0], bids[i][1], bids[i][2], asks[i][0], asks[i][1], asks[i][2]]
      globalOB.append(row)
    

    return globalOB

'''
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
'''
def fetch_aggregated_OHLCV(asset,fromDate,to,interval):
    global accessToken

    if(accessToken=='' or accessToken==None):
        return [['Invalid credentials']]

    encodedAsset = urllib.parse.quote(asset)
    params = 'symbol=' + encodedAsset + '&from=' + fromDate + '&to='+to+'&interval='+interval
    url = ohlcvRestApiUrl + '?' + params
    headersVal = { "Authorization": "bearer " + accessToken }
    response = requests.get(url, headers=headersVal)

    entities = response.json()["result"]
    return entities

'''
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


'''
def fetch_OHLCV_for_exchange(exchange,base,quote,fromDate,to,timeFrame, assetType,marketType):
    global accessToken

    if(accessToken=='' or accessToken==None):
        return [['Invalid credentials']]

    params = 'exchange='+exchange+'&base='+base+'&quote='+quote+'&from='+fromDate+'&to='+to+'&timeFrame='+timeFrame+'&assetType='+assetType+'&marketType='+marketType
    url = ohlcvExchangeRestApiUrl + '?' + params
    headersVal = { "Authorization": "bearer " + accessToken }
    response = requests.get(url, headers=headersVal)

    entities = response.json()
    return entities

'''
  /**
   * 
   * Retrieves Market Cap history
   * for the specified symbol and date range
   * 
   * @param {*} symbol 
   * @param {*} from 
   * @param {*} to 
   */
'''
def fetch_marketcap_for_crypto_symbol(symbol, fromDate, to):
    global accessToken

    if(accessToken=='' or accessToken==None):
        return [['Invalid credentials']]

    params = 'symbol=' + symbol + '&from=' + fromDate + '&to=' + to
    url = marketCapRestApiUrl + '?' + params
    headersVal = { "Authorization": "bearer " + accessToken }
    response = requests.get(url, headers=headersVal)

    entities = response.json()
    return entities    

'''
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
'''
def run_backtest(startingCapital, exchange, base, quote, fromDate, to, indicatorParams, strategyParams, timeFrame, isMultiStrategy, assetType, marketType): 
    global accessToken

    if(accessToken=='' or accessToken==None):
        return [['Invalid credentials']]

    indicator1 = indicatorParams['indicator1']
    indicator2 = indicatorParams['indicator2']

    period1 =''
    if 'period' in indicator1:
        period1 = indicator1['period']

    period2 =''
    if 'period' in indicator2:
        period2 = indicator2['period']    

    priceComponent1 = ''
    if 'priceComponent' in indicator1:
        priceComponent1 = indicator1['priceComponent'] 

    priceComponent2 = ''
    if 'priceComponent' in indicator2:
        priceComponent2 = indicator2['priceComponent'] 

    stdDevUpper1=''
    if 'stdDevUpper' in indicator1:
        stdDevUpper1 = indicator1['stdDevUpper']

    stdDevUpper2=''
    if 'stdDevUpper' in indicator2:
        stdDevUpper2 = indicator2['stdDevUpper']

    stdDevLower1=''
    if 'stdDevLower' in indicator1:
        stdDevLower1 = indicator1['stdDevLower']

    stdDevLower2=''
    if 'stdDevLower' in indicator2:
        stdDevLower2 = indicator2['stdDevLower']   

    shortPeriod1=''
    if 'shortPeriod' in indicator1:
     shortPeriod1 = indicator1['shortPeriod']         

    longPeriod1=''
    if 'longPeriod' in indicator1:
       longPeriod1=indicator1['longPeriod']  

    signalPeriod1=''
    if 'signalPeriod' in indicator1:
        signalPeriod1 = indicator1['signalPeriod']  

    shortPeriod2=''
    if 'shortPeriod' in indicator2:
     shortPeriod2 = indicator2['shortPeriod']         

    longPeriod2=''
    if 'longPeriod' in indicator2:
       longPeriod2=indicator2['longPeriod']  

    signalPeriod2=''
    if 'signalPeriod' in indicator2:
        signalPeriod2 = indicator2['signalPeriod'] 



    entryDirection=''
    if 'entryDirection' in strategyParams:
        entryDirection = strategyParams['entryDirection'] 

    entryIndicator1=''
    if 'entryIndicator1' in strategyParams:
        entryIndicator1 = strategyParams['entryIndicator1']            

    entryOperator=''
    if 'entryOperator' in strategyParams:
        entryOperator = strategyParams['entryOperator']      

    entryIndicator2=''
    if 'entryIndicator2' in strategyParams:
        entryIndicator2 = strategyParams['entryIndicator2']      

    exitIndicator1=''
    if 'exitIndicator1' in strategyParams:
        exitIndicator1= strategyParams['exitIndicator1']   

    exitOperator=''
    if 'exitOperator' in strategyParams:
        exitOperator= strategyParams['exitOperator']

    exitIndicator2=''
    if 'exitIndicator2' in strategyParams:
        exitIndicator2= strategyParams['exitIndicator2']   

    stopLoss=''
    if 'stopLoss' in strategyParams:
        stopLoss= strategyParams['stopLoss']   

    longEntryIndicator1=''
    if 'longEntryIndicator1' in strategyParams:
        longEntryIndicator1= strategyParams['longEntryIndicator1']   

    longEntryOperator=''
    if 'longEntryOperator' in strategyParams:
        longEntryOperator= strategyParams['longEntryOperator']       
    
    longEntryIndicator2=''
    if 'longEntryIndicator2' in strategyParams:
        longEntryIndicator2= strategyParams['longEntryIndicator2']   

    shortEntryIndicator1=''
    if 'shortEntryIndicator1' in strategyParams:
        shortEntryIndicator1= strategyParams['shortEntryIndicator1']       
    
    shortEntryOperator=''
    if 'shortEntryOperator' in strategyParams:
        shortEntryOperator= strategyParams['shortEntryOperator']       
    
    shortEntryIndicator2=''
    if 'shortEntryIndicator2' in strategyParams:
        shortEntryIndicator2= strategyParams['shortEntryIndicator2']   

    longExitIndicator1=''
    if 'longExitIndicator1' in strategyParams:
        longExitIndicator1= strategyParams['longExitIndicator1']       
    
    longExitOperator=''
    if 'longExitOperator' in strategyParams:
        longExitOperator= strategyParams['longExitOperator']       
    
    longExitIndicator2=''
    if 'longExitIndicator2' in strategyParams:
        longExitIndicator2= strategyParams['longExitIndicator2']   
    
    
    shortExitIndicator1=''
    if 'shortExitIndicator1' in strategyParams:
        shortExitIndicator1= strategyParams['shortExitIndicator1']       
    

    shortExitOperator=''
    if 'shortExitOperator' in strategyParams:
       shortExitOperator= strategyParams['shortExitOperator']       

    
    shortExitIndicator2=''
    if 'shortExitIndicator2' in strategyParams:
        shortExitIndicator2= strategyParams['shortExitIndicator2']   




    params =('exchange=' + exchange
            + '&base=' + base
            + '&quote=' + quote
            + '&from=' + fromDate
            + '&to=' + to
            + '&timeFrame=' + timeFrame
            + '&startingCapital=' + startingCapital
            + '&isMultiStrategy=' +isMultiStrategy
            + '&indicator1.type=' + indicator1['type']
            
            
            + '&indicator1.period=' + period1
            + '&indicator1.priceComponent=' + priceComponent1

            + '&indicator2.type=' + indicator2['type']
            + '&indicator2.period=' + period2
            + '&indicator2.priceComponent=' + priceComponent2

            + '&indicator1.stdDevUpper=' +  stdDevUpper1
            + '&indicator1.stdDevLower=' + stdDevLower1

            + '&indicator2.stdDevUpper=' + stdDevUpper2
            + '&indicator2.stdDevLower=' + stdDevLower2

            + '&indicator1.shortPeriod=' + shortPeriod1
            + '&indicator1.longPeriod=' + longPeriod1
            + '&indicator1.signalPeriod=' + signalPeriod1

            + '&indicator2.shortPeriod=' + shortPeriod2
            + '&indicator2.longPeriod=' + longPeriod2
            + '&indicator2.signalPeriod=' + signalPeriod2

            + '&entryDirection=' + entryDirection
            + '&entryIndicator1=' + entryIndicator1
            + '&entryOperator=' + entryOperator
            + '&entryIndicator2=' + entryIndicator2
            + '&exitIndicator1=' + exitIndicator1
            + '&exitOperator=' + exitOperator
            + '&exitIndicator2=' + exitIndicator2


            + '&longEntryIndicator1=' + longEntryIndicator1
            + '&longEntryOperator=' + longEntryOperator
            + '&longEntryIndicator2=' + longEntryIndicator2

            + '&shortEntryIndicator1=' + shortEntryIndicator1
            + '&shortEntryOperator=' + shortEntryOperator
            + '&shortEntryIndicator2=' + shortEntryIndicator2


            + '&longExitIndicator1=' + longExitIndicator1
            + '&longExitOperator=' + longExitOperator
            + '&longExitIndicator2=' + longExitIndicator2

            + '&shortExitIndicator1=' + shortExitIndicator1
            + '&shortExitOperator=' + shortExitOperator
            + '&shortExitIndicator2=' + shortExitIndicator2

            + '&stopLoss=' + stopLoss
            
            + '&marketType=' + marketType
            + '&assetType=' + assetType)

    url = backtestingRestApiUrl + '?' + params
    headersVal = { "Authorization": "bearer " + accessToken }
    response = requests.get(url, headers=headersVal)

    entities = response.json()
    return entities


'''
   /**
    * 
    * Maintains a count of the active numnber of subscriptions
    * 
    * @param {*} parsedMsg 
    */
'''
def set_active_streams_count(msg):
    global activeStreamsCount
    if (msg != None and 'totalActiveSubscriptions' in msg and msg['totalActiveSubscriptions'] != None):
        activeStreamsCount = msg['totalActiveSubscriptions']

    #print('active streams count ' + str(activeStreamsCount))    

'''
   /**
    * 
    * Maintains the id's of the active subscriptions
    * 
    * @param {*} parsedMsg 
    */
'''
def set_active_subscription_id(msg):
    global streamIds
    if(msg != None and 'event' in msg and msg['event']=='SUBSCRIPTION_INFO' and 'totalActiveSubscriptions' in msg and 'activeSubscriptions' in msg):
        for subId in msg['activeSubscriptions']:
            streamIds[subId['id']] = subId['id']

    #print('active sub Ids')
    #print(streamIds)

'''
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
'''
def process_message(message):
    
    msg = (json.loads(message))
    set_active_streams_count(msg)
    set_active_subscription_id(msg)
    if ('subId' in msg):
        decodedMetaData = json.loads(base64.b64decode(msg['subId']))
        emitter.emit('MessagesFromStream', msg)
        if(decodedMetaData != None and 'event' in decodedMetaData and decodedMetaData['event']=='ORDERBOOK'):
            update = updateGlobalOrderbook(msg)
            emitter.emit('GLOBAL_ORDERBOOK', update)
            liveLiquidityLatest = updateLiveLiquidity(msg)
            liveLiquidityStats = updateLiveLiquidityStats(liveLiquidityLatest)
            emitter.emit('LIVE_LIQUIDITY', liveLiquidityLatest)
            emitter.emit('LIVE_LIQUIDITY_STATS', liveLiquidityStats)
        elif(decodedMetaData != None and 'event' in decodedMetaData and decodedMetaData['event']=='INSIGHTS' and 'analyticType' in decodedMetaData):
            if(decodedMetaData['analyticType'] == 'SPREAD'):
                emitter.emit('SPREAD', msg)
            elif(decodedMetaData['analyticType'] == 'SPREAD_NEGATIVE'):
                emitter.emit('ARBITRAGE', msg)
            elif(decodedMetaData['analyticType'] == 'VOI_BID'):
                 emitter.emit('VOI_BID', msg)
            elif(decodedMetaData['analyticType'] == 'VOI_ASK'):
                 emitter.emit('VOI_ASK', msg)
            elif(decodedMetaData['analyticType'] == 'WHALE'):
                 emitter.emit('WHALE', msg)
            else:
                print('unrecognised insight type')          
        else:
            print('unrecognised event type') 
        #print(decodedMetaData)

'''
   /**
    * 
    * Aggregation of live liquidity
    * 
    * @param {*} liveLiquidity 
    */
'''
def updateLiveLiquidityStats(liveLiquidityLatest):

  liveLiquidityStats = []
  
  table=pd.DataFrame(liveLiquidityLatest)
  totalAvailableLiquidity = sum(table[1].tolist())  #np.sum(liveLiquidityLatest, 1)
  totalAvailableAsset = sum(table[3].tolist())
  totalImbalance = sum(table[4].tolist())
 
  liveLiquidityStats.append([totalAvailableLiquidity, totalAvailableAsset, totalImbalance])
 
  return liveLiquidityStats



'''
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
'''
def updateLiveLiquidity(msg):
  global liveLiquidity
  exchange = msg['e']
  bids = msg['bids']
  asks = msg['asks']

  for i in range(len(liveLiquidity)-1,-1,-1):
      if(liveLiquidity[i]!=None and liveLiquidity[i][0]!=None and liveLiquidity[i][0]==exchange):
        liveLiquidity.remove(liveLiquidity[i])

  if (len(asks) > 0 and len(bids) > 0):
    askLiquidity = asks[len(asks) - 1][4]
    bidLiquidity = bids[len(bids) - 1][4]
    imbalance = askLiquidity - bidLiquidity
    cumAskQty = asks[len(asks) - 1][2]
    marketPrice = askLiquidity / cumAskQty
    assetAmount = askLiquidity / marketPrice
    liveLiquidity.append([exchange, askLiquidity, bidLiquidity, assetAmount, imbalance, marketPrice])

  liveLiquiditySorted = sorted(liveLiquidity, key=itemgetter(5))

  return liveLiquiditySorted

'''
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
'''    
def initialise_stream(subscriptionRequests):
    global accessToken
    def on_message(ws, message):
        process_message(message)


    def on_error(ws, error):
        print(error)


    def on_close(ws):
        print("### closed ###")

    def on_open(ws):
        def run(*args):
            # while True:
            print("--------- WebSocket Opened ---------\n\n")
            print("--------- Subscription Request ---------\n\n")
            print(subscriptionRequests)

            print("\n\n")
            #time.sleep(1)
            for streamConfig in subscriptionRequests:
                ws.send(json.dumps(streamConfig))
        
        _thread.start_new_thread(run, ())

    if (subscriptionRequests == None or subscriptionRequests == {} or len(subscriptionRequests) == 0):
        print('You need to specify at least one subscription request')
        return None
    else:
        print('Setting up subscriptions')  
        websocket.enableTrace(True)
        text = websocketUrl+"?token="+accessToken
        ws = websocket.WebSocketApp(text, on_message=on_message, on_error=on_error, on_close=on_close)
        ws.on_open = on_open
        ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})

'''
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
'''
def initialise_global_orderbook(base="BTC:CRYPTO", quote="USDT:CRYPTO", exchanges=["BINANCE"], marketType="SPOT"):
    global emitter
    base = convert_symbol_part(base)
    quote = convert_symbol_part(quote)
    streamConfigs = generate_default_global_orderbook_stream_configurations(base, quote, exchanges, marketType)
    initialise_stream(streamConfigs)

'''
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
'''
def initialise_insights_for_pair(base="BTC:CRYPTO", quote="USDT:CRYPTO"):
    global emitter
    base = convert_symbol_part(base)
    quote = convert_symbol_part(quote)
    streamConfigs =  generate_default_insights_stream_configurations(base,quote)
    initialise_stream(streamConfigs)   


'''
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
'''
def screen(base,quote,exchanges=None, rsi=[],smaCross=[],volatility=[], weeklyOpenChg=[], bollingerBand=None, fibRetracements=[], trends=[], ichimoku=[]):
    #base = convert_symbol_part(base)
    #quote = convert_symbol_part(quote)
    
    base = base+':CRYPTO'
    quote = quote + ':CRYPTO'

    url = appUrl + "graphql"
  
    query = "query recent($filters: RecentFilters, $sortBy: SortBy) {  recent(filters: $filters, sortBy: $sortBy) {items {hash exchangeId baseId quoteId marketType v30dChg v24HrChg v30dSum v24HrSum p24HrChg p7dChg p15MinChg pLast p1HrChg v24HrVsV30dSum __typename} exchanges quotes bases __typename}}"
  
    data = [{
            "operationName": "recent", 
        
            "variables": {
            "filters":{
                "exchanges":exchanges,
                "bases":base, 
                "quote":quote,
                "rsi":rsi,
                "smaCross":smaCross,
                "volatility":volatility,
        "weeklyOpenChg":weeklyOpenChg,
        "bollingerBands": bollingerBand,
        "fibRetracement": fibRetracements,
        "trend": trends,
        "ichimoku": ichimoku


            },
            "sortBy":{
                    "colId":"v30dSum",
                    "sort":"desc"
                    
                    }
            
        },
        
        "query": query

    
    }]
  
    r = requests.post(url, data=json.dumps(data),headers={"content-type": "application/json"})
    stats = r.json()
    return stats[0]['data']['recent']['items']
  
