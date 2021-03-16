var keycloakUrl = "https://keycloak.ae3platform.com/auth/realms/ApexE3/protocol/openid-connect/token";
var betaUrl = "https://app.ae3platform.com/";
var apiRestURL = "https://www.ae3platform.com/";
var ohlcvRestApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCV";
var ohlcvRestTwoAssetsApiUrl = "https://www.apexe3.ai/__/data-service/fetchOHLCVTwoAssets";
const INVALID_CREDS_MESSAGE = [['Your APEX:E3 Client Id or Client Secret is invalid. You need valid credentials to recieve data.']];

/**
 * When the spreadsheet opens, setup triggers
 * that will help refresh relevant sheets
 * @param e 
 */
function onOpen(e) {

    var triggers = ScriptApp.getProjectTriggers();
    var name = triggers[0].getHandlerFunction();

    if (triggers == null || triggers.length == 0) {
        startIt(e);
    }

};

function testOnOpen(){
 
  onOpen('');
  
}

/**
 * Help function to show GSheets Ui popup
 * 
 * @param title 
 * @param message 
 */
function showInformationPopup(title, message) {

    var ui = SpreadsheetApp.getUi(); // Same variations.

    var result = ui.alert(
        title,
        message,
        ui.ButtonSet.OK);
}

/**
 * Invoke trigger creation
 * 
 * @param e 
 */
function startIt(e) {
    createTimeDrivenTriggers()
}

/**
 * 
 * Create triggers
 * 
 */
function createTimeDrivenTriggers() {
    // Trigger every minute
    ScriptApp.newTrigger('refreshData')
        .timeBased()
        .everyMinutes(5)
        .create();
}

/**
 * 
 * Programmatically remove triggers
 * 
 */
function removeTriggers() {

    var sheet = SpreadsheetApp.getActiveSpreadsheet();

    var triggers = ScriptApp.getUserTriggers(sheet);

    for (var trigger in triggers) {

        ScriptApp.deleteTrigger(trigger);
    }

}

/**
 * 
 * Refresh data in sheets
 * 
 */
function refreshData() {
    updateDateOnInsights();
    updateDateOnExchangeAnalytics();
    updateDateOnGlobalOrderbook();
    updateDateOnGlobalOutlookDataSets();
    updateDateOnEthDataSet();
}

/**
 * 
 * Refresh global Outlook Data sets by refreshing the date
 * 
 */
function updateDateOnGlobalOutlookDataSets() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Global Outlook Datasets');
    sheet.getRange('BC1').setValue(Utilities.formatDate(new Date(), 'Etc/GMT', 'dd-MMM-yyyy HH:mm:ss'));
}


/**
 * 
 * Refresh Eth Data set by refreshing the date
 * 
 */
function updateDateOnEthDataSet() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ETH Data');
    sheet.getRange('L1').setValue(Utilities.formatDate(new Date(), 'Etc/GMT', 'dd-MMM-yyyy HH:mm:ss'));
}


/**
 * 
 * Refresh global orderbook by refreshing the date
 * 
 */
function updateDateOnGlobalOrderbook() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Global Orderbook');
    sheet.getRange('K1').setValue(Utilities.formatDate(new Date(), 'Etc/GMT', 'dd-MMM-yyyy HH:mm:ss'));
}

/**
 * 
 * Refresh insights by refreshing the date
 * 
 */
function updateDateOnInsights() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Insights');
    sheet.getRange('K1').setValue(Utilities.formatDate(new Date(), 'Etc/GMT', 'dd-MMM-yyyy HH:mm:ss'));
}

/**
 * 
 * Refresh exchange analytics by refreshing
 * the date
 * 
 */
function updateDateOnExchangeAnalytics() {

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Exchange Analytics');
    sheet.getRange('K1').setValue(Utilities.formatDate(new Date(), 'Etc/GMT', 'dd-MMM-yyyy HH:mm:ss'));

}

/**
 * 
 * Retrieves mapping for token -> cannoicalId e.g.
 * BTC -> BTC:CRYPTO
 * 
 */
function getTokenToCannoicalIdMap() {

    var tokenToCannoicalIdMap = new Map();
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Supported Tokens');
    var last = sh.getLastRow();
    var data = sh.getRange(1, 1, last, 2).getValues();

    for (nn = 0; nn < data.length; ++nn) {
        tokenToCannoicalIdMap.set(data[nn][0], data[nn][1]);

    }

    return tokenToCannoicalIdMap;
}

/**
 * 
 * Retrieves mapping for  cannoicalId -> token e.g.
 * BTC:CRYPTO -> BTC
 * 
 */
function getCannonicalIdToTokenMap() {

    var cannonicalIdToTokenMap = new Map();
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Supported Tokens');
    var last = sh.getLastRow();
    var data = sh.getRange(1, 1, last, 2).getValues();

    for (nn = 0; nn < data.length; ++nn) {
        cannonicalIdToTokenMap.set(data[nn][1], data[nn][0]);

    }

    return cannonicalIdToTokenMap;

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
 * Helper function to generate auth payload
 * per the APEX:E3 API spec
 * 
 * @param clientId 
 * @param clientSecret 
 */
function genAPICredsPayload(clientId, clientSecret) {

    return {
        "grant_type": "client_credentials",
        "client_id": clientId,
        "client_secret": clientSecret
    };

}

/**
 * 
 * Fetches access token using auth credentials
 * 
 */
function fetchAccessToken() {
    try {


        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Credentials');
        var clientId = sheet.getRange('B1').getValue();
        var clientSecret = sheet.getRange('B2').getValue();

        if (clientId === '' || clientId == null || clientSecret === '' || clientSecret == null) {

            //SpreadsheetApp.getActiveSpreadsheet().toast("You need to set yout APEXE:E3 Client Id and Client Secret to continue", "APEX:E3 CREDENTIALS NOT VALID");

            showInformationPopup('Invalid APEX:E3 Credentials', 'To recieve data, you need to set your APEX:E3 Client Id and Client Secret in the Credentials tab. Email contactus@apexe3.com to request credentials.');

        } else {
            //check that credentials are valid 

            var url = keycloakUrl;

            var creds = genAPICredsPayload(clientId, clientSecret);

            var options = {
                'method': 'post',
                'payload': creds,
                'headers': { "content-type": "application/x-www-form-urlencoded" }
            };

            var response = UrlFetchApp.fetch(url, options);

            if (response != null && response.getContentText() != null) {

                var content = JSON.parse(response.getContentText());

                return content.access_token;


            } else {

                return null;
            }


        }
    } catch (e) {

        return INVALID_CREDS_MESSAGE;
    }
}

/**
 * 
 * Fetches reference entity information per
 * the APEX:E3 API spec
 * 
 * @param entity 
 */
function supportedReferenceEntity(entity) {

    try {
        var accessToken = fetchAccessToken();

        if (accessToken != null) {

            var url = apiRestURL + 'reference/' + entity;

            var options = getOptions(accessToken);
            var response = UrlFetchApp.fetch(url, options);
            var entities = JSON.parse(response.getContentText()).result;
            var entitiesArr = [];



            for (var i = 0; i < entities.length; i++) {
                if (entity === 'markets') {
                    entitiesArr.push(entities[i].b + '-' + entities[i].q);
                } else if (entity === 'assets') {
                    entitiesArr.push([entities[i].n, entities[i].id]);
                } else {
                    entitiesArr.push(entities[i].n);
                }
            }

            Logger.log(entitiesArr);

            return entitiesArr;

        } else {

            Logger.log('No access token retrieved. Check your credentials');

        }
    } catch (e) {

        return 'there was a problem fetching content ' + e;
    }

    return 'check your credentials';

}

/**
 * 
 *  Fetches supported exchange list information per
 * the APEX:E3 API spec
 * 
 */
function supportedExchanges() {
    return supportedReferenceEntity('exchanges')
}

/**
 * 
 * Fetches supported token/asset list information per
 * the APEX:E3 API spec
 * 
 */
function supportedAssets() {
    return supportedReferenceEntity('assets')
}

/**
 * 
 * Fetches supported markets list information per
 * the APEX:E3 API spec
 * 
 */
function supportedMarkets() {
    return supportedReferenceEntity('markets')
}

/**
 * 
 *  Fetches bid imbalance ratio for specified
 * 
 * @param base 
 * @param quote 
 * @param exchangeId 
 */
function ASBIDIMBALANCE(base, quote, exchangeId) {

    var tokenToCannoicalIdMap = getTokenToCannoicalIdMap();
    var cannonicalIdToTokenMap = getCannonicalIdToTokenMap();

    exchangeId != null ? exchangeId = exchangeId.toUpperCase() : null;
    base != null ? base = base.toUpperCase() : null;
    quote != null ? quote = quote.toUpperCase() : null;

    baseId = tokenToCannoicalIdMap.get(base);
    quoteId = tokenToCannoicalIdMap.get(quote);


    var accessToken = fetchAccessToken();

    if (accessToken != null) {

        var encodedBase = encodeURIComponent(base);
        var encodedQuote = encodeURIComponent(quote);

        ////analytics/wall/bid/{marketType}/{analyticPivot}/{analyticSize}

        var params = 'baseId=' + encodedBase + '&quoteId=' + encodedQuote + '&assetClassification=ALT';
        var url = apiRestURL + 'analytics/wall/bid/SPOT/PAIR/ALL?' + params;
        var creds = getOptions(accessToken);
        var response = UrlFetchApp.fetch(url, creds);
        var entities = JSON.parse(response.getContentText()).result;

        var result = [[]];
        for (var i = 0; i < entities.length; i++) {

            var entity = entities[i];
            if (entity.e === exchange) {

                result = [[exchange, entity.v]]


            } else { }

        }
        Logger.log(result);
        return result;
    } else {

        return ['Check credentials'];
    }
}

/**
 * 
 * Programmatically Screens based on supplied parameters 
 * 
 * See https://app.ae3platform.com/ as a live example
 * 
 * @param base 
 * @param quote 
 * @param exchangeId 
 * @param time 
 * @param rsi 
 * @param smaCross 
 * @param volatility 
 * @param bollingerBand 
 * @param fibRetracement 
 * @param ichimoku 
 * @param trends 
 */
function AE3SCREEN(base, quote, exchangeId, time, rsi, smaCross, volatility, bollingerBand, fibRetracement, ichimoku, trends) {

    var accessToken = fetchAccessToken();

    if (accessToken == INVALID_CREDS_MESSAGE) {
        return INVALID_CREDS_MESSAGE;
    } else { }

    var tokenToCannoicalIdMap = getTokenToCannoicalIdMap();
    var cannonicalIdToTokenMap = getCannonicalIdToTokenMap();

    exchangeId != null ? exchangeId = exchangeId.toUpperCase() : null;
    base != null ? base = base.toUpperCase() : null;
    quote != null ? quote = quote.toUpperCase() : null;

    baseId = tokenToCannoicalIdMap.get(base);
    quoteId = tokenToCannoicalIdMap.get(quote);

    if (smaCross == null || smaCross === '') {

        smaCross = [];
    } else {

        smaCross = smaCross.toLowerCase();

        if (smaCross === "20d above") {

            smaCross = ["p20dSMAxAbove"];

        } else if (smaCross === "20d below") {

            smaCross = ["p20dSMAxBelow"];

        } else if (smaCross === "50d above") {

            smaCross = ["p50dSMAxAbove"];

        } else if (smaCross === "50d below") {

            smaCross = ["p50dSMAxBelow"];

        } else { }

    }


    if (bollingerBand != null) {
        bollingerBand = bollingerBand.toLowerCase();
    } else { }

    if (bollingerBand == null || bollingerBand === '') {
        bollingerBand = null;
    } else if (bollingerBand === 'above upper') {
        bollingerBand = "above-upper";
    } else if (bollingerBand === 'above middle') {
        bollingerBand = "above-middle";
    } else if (bollingerBand === 'above lower') {
        bollingerBand = "above-lower";
    } else if (bollingerBand === 'below lower') {
        bollingerBand = "below-lower";
    } else if (bollingerBand === 'tight bands') {
        bollingerBand = "tight-bands";
    } else { }


    if (fibRetracement != null) {
        fibRetracement = fibRetracement.toLowerCase();
    } else { }

    if (fibRetracement == null || fibRetracement === '') {
        fibRetracement = [];
    } else if (fibRetracement === '0 to 23.6%') {
        fibRetracement = ["fibRetracement_gte_0_lte_0.236"];
    } else if (fibRetracement === '23.6% to 38.2%') {
        fibRetracement = ["fibRetracement_gt_0.236_lte_0.382"];
    } else if (fibRetracement === '38.2% to 50%') {
        fibRetracement = ["fibRetracement_gt_0.382_lte_0.5"];
    } else if (fibRetracement === '50% to 61.9%') {
        fibRetracement = ["fibRetracement_gt_0.5_lte_0.619"];
    } else if (fibRetracement === '61.9% to 78.6%') {
        fibRetracement = ["fibRetracement_gt_0.619_lte_0.786"];
    } else if (fibRetracement === '78.6% to 100%') {
        fibRetracement = ["fibRetracement_gt_0.786_lte_1"];
    }
    else { }


    if (ichimoku != null) {
        ichimoku = ichimoku.toLowerCase();
    } else { }

    if (ichimoku == null || ichimoku === '') {
        ichimoku = [];
    } else if (ichimoku === 'above cloud') {
        ichimoku = ["aboveCloud"];
    } else if (ichimoku === 'within cloud') {
        ichimoku = ["withinCloud"];
    } else if (ichimoku === 'below cloud') {
        ichimoku = ["belowCloud"];
    } else { }


    if (volatility != null) {
        volatility = volatility.toLowerCase();
    } else { }

    if (volatility == null || volatility === '') {
        volatility = [];
    } else if (volatility === 'weekly high') {
        volatility = ["vltWeekChg_gt_12", "vltWeekChg_gt_15", "vltWeekChg_gt_20"];
    } else if (volatility === 'weekly medium') {
        volatility = ["vltWeekChg_gt_6", "vltWeekChg_gt_7", "vltWeekChg_gt_8", "vltWeekChg_gt_9", "vltWeekChg_gt_10"];
    } else if (volatility === 'weekly low') {
        volatility = ["vltWeekChg_gt_3", "vltWeekChg_gt_4", "vltWeekChg_gt_5"];
    } else if (volatility === 'monthly high') {
        volatility = ["vltMonChg_gt_10", "vltMonChg_gt_12", "vltMonChg_gt_15", "vltMonChg_gt_20"];
    } else if (volatility === 'monthly medium') {
        volatility = ["vltMonChg_gt_6", "vltMonChg_gt_7", "vltMonChg_gt_8", "vltMonChg_gt_9", "vltMonChg_gt_10"];
    } else if (volatility === 'monthly low') {
        volatility = ["vltMonChg_gt_3", "vltMonChg_gt_4", "vltMonChg_gt_5"];
    } else { }


    if (trends != null) {
        trends = trends.toLowerCase();
    } else { }

    if (trends == null || trends === '') {
        trends = [];
    } else { }


    if (trends === "neutral") {
        trends = ["neutral"];
    } else if (trends === "up") {
        trends = ["uptrend"];
    } else if (trends === "down") {
        trends = ["downtrend"];
    } else { }

    if (rsi == null || rsi === '') {
        rsi = [];
    } else if (rsi <= 20) {

        rsi = ["rsi14d_gte_10_lt_20"];

    } else if (rsi <= 30) {

        rsi = ["rsi14d_gte_20_lt_30"];

    }
    else if (rsi <= 40) {

        rsi = ["rsi14d_gte_30_lt_40"];

    } else if (rsi <= 50) {

        rsi = ["rsi14d_gte_40_lt_50"];

    } else if (rsi <= 70) {

        rsi = ["rsi14d_gte_60_lt_70"];

    } else if (rsi <= 80) {

        rsi = ["rsi14d_gte_70_lt_80"];

    } else if (rsi <= 90) {

        rsi = ["rsi14d_gte_80_lt_90"];

    } else if (rsi <= 100) {

        rsi = ["rsi14d_gte_90_lt_100"];

    } else { }


    var base = baseId == '' ? null : baseId;
    var quote = quoteId == '' ? null : quoteId;
    var exchange = exchangeId == '' ? null : [exchangeId];

    var url = betaUrl + "graphql";
    var query = "query recent($filters: RecentFilters, $sortBy: SortBy) {  recent(filters: $filters, sortBy: $sortBy) {items {hash exchangeId baseId quoteId marketType v30dChg v24HrChg v30dSum v24HrSum p24HrChg p7dChg p15MinChg pLast p1HrChg v24HrVsV30dSum __typename} exchanges quotes bases __typename}}";

    var screenResults = [['Exchange', 'Token Symbol', 'Quote', 'Px', 'Vol 24hr Sum', 'Vol 30d Sum', 'Vol 30d Chg', 'Vol 24hr vs 30d sum', 'Px 15m Chg', 'Px 1hr chg', 'Px 24hr Chg', 'Px 7d Chg']];
    //var screenResults = [];                 
    var data = [{
        "operationName": "recent",

        "variables": {
            "filters": {
                "exchanges": exchange,
                "bases": base,
                "quote": quote,
                "rsi": rsi,
                "smaCross": smaCross,
                "bollingerBands": bollingerBand,
                "fibRetracement": fibRetracement,
                "ichimoku": ichimoku,
                "trend": trends,
                "volatility": volatility,
                "weeklyOpenChg": []
            },
            "sortBy": {
                "colId": "v30dSum",
                "sort": "desc"

            }

        },

        "query": query


    }];

    var options = {
        'method': 'post',
        'payload': JSON.stringify(data),
        'headers': { "content-type": "application/json", 'Authorization': 'bearer ' + accessToken }

    };

    var response = UrlFetchApp.fetch(url, options);

    if (response != null && response.getContentText() != null) {

        //Logger.log(response.getContentText());

        var resultstr = response.getContentText();
        var resultjson = JSON.parse(resultstr);

        var recent = resultjson[0];

        if (recent != null && recent.data != null && recent.data.recent != null && recent.data.recent.items != null && recent.data.recent.items.length > 0) {

            for (var i = 0; i < recent.data.recent.items.length; i++) {

                var row = [recent.data.recent.items[i].exchangeId,
                cannonicalIdToTokenMap.get(recent.data.recent.items[i].baseId),
                cannonicalIdToTokenMap.get(recent.data.recent.items[i].quoteId),
                recent.data.recent.items[i].pLast,
                recent.data.recent.items[i].v24HrSum,
                recent.data.recent.items[i].v30dSum,
                recent.data.recent.items[i].v30dChg,
                recent.data.recent.items[i].v24HrVsV30dSum,
                recent.data.recent.items[i].p15MinChg,
                recent.data.recent.items[i].p1HrChg,
                recent.data.recent.items[i].p24HrChg,
                recent.data.recent.items[i].p7dChg,
                ]

                screenResults.push(row);
            }

        } else { }

        return screenResults;

    } else {

        return null;
    }

    return null;

}

/**
 * 
 * Retrieves OHLCV for supplied market
 * 
 * @param base 
 * @param quote 
 * @param exchange 
 */
function AE3OHLCV_DEPRECATED(base, quote, exchange) {

    var MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
    var TEN_DAYS_AGO = MILLIS_PER_DAY * 365;
    var now = new Date();
    var tenDaysAgo = new Date(now.getTime() - TEN_DAYS_AGO);

    var nowFormatted = Utilities.formatDate(now, 'Etc/GMT', 'yyyy-MM-dd');
    var tenDaysAgoFormatted = Utilities.formatDate(tenDaysAgo, 'Etc/GMT', 'yyyy-MM-dd');

    var base = 'BTC:CRYPTO';
    var quote = 'USDT:CRYPTO';
    var exchange = 'BINANCE';

    var url = betaUrl + "graphql";
    var query = "query history($context: HistoryContext, $startDate: String, $endDate: String, $interval: String) {  history(context: $context, startDate: $startDate, endDate: $endDate, interval: $interval) { earliestTime latestTime totalCount edges { node { v t __typename } cursor __typename }  pageInfo { endCursor hasNextPage __typename} __typename } }";

    var today = new Date();


    var data = [{
        "operationName": "history",

        "variables": {
            "context": {
                "exchangeId": exchange,
                "baseId": base,
                "quoteId": quote,
                "futureId": null,
                "instrumentId": null,
                "type": "MARKET"
            },
            "endDate": nowFormatted,
            "startDate": tenDaysAgoFormatted,
            "interval": "1d"
        },

        "query": query

    }];

    var options = {
        'method': 'post',
        'payload': JSON.stringify(data),
        'headers': { "content-type": "application/json" }
    };

    var response = UrlFetchApp.fetch(url, options);

    if (response != null && response.getContentText() != null) {

        var resultstr = response.getContentText();
        var resultjson = JSON.parse(resultstr);

        var ohlcv = resultjson[0];
        var ohlcvResult = [['Time', 'Open', 'High', 'Low', 'Close', 'Volume']];
        if (ohlcv != null && ohlcv.data != null && ohlcv.data.history != null && ohlcv.data.history.edges != null) {

            for (var i = 0; i < ohlcv.data.history.edges.length; i++) {

                var edge = ohlcv.data.history.edges[i];

                if (edge.node != null && edge.node.v != null) {

                    var t = [Utilities.formatDate(new Date(Number(edge.node.t)), 'Etc/GMT', 'yyyy-MM-dd\'T\'HH:mm\'Z\'')];
                    var row = t.concat(edge.node.v);
                    ohlcvResult.push(row);

                } else { }


            }

        }

        return ohlcvResult;

    } else {
        return "-";
    }
}
 
/**
 * 
 * Retrieves OHLCV for the specified symbol and ranges
 * usage example =AE3OHLCV($B$4,JOIN("'",$B$5), JOIN("'",$B$6),$B$9,"g")
 */
function AE3OHLCV(asset, from, to, interval,refreshValue){
 
  try{
    
    var accessToken = fetchAccessToken();

    if(accessToken ==null){
      return [['Please check your credentials or email contactus@apexe3.com quoting your API Client ID']];
    }else{}
    
   
    
    //UNCOMMENT TO DEBUG
   //asset = 'UNI-USD';
   //from = '01-01-2020';
   // to = '31-12-2020';
   // interval = "";
    // var time = new Date(timeStamps[i]*1000); may have to do this for all time values..
    
     var encodedAsset = encodeURIComponent(asset);
    
    var params = 'symbol=' + encodedAsset + '&from=' + from + '&to='+to+'&interval='+interval;
    var url = ohlcvRestApiUrl + '?' + params;
    var creds = getOptions(accessToken);
    var response = UrlFetchApp.fetch(url, creds);
    var entities = JSON.parse(response.getContentText()).result;
    
    return entities
    
  }catch(e){
  
    return [['problem fetching content']];
  }
  
}
 
  /**
 * 
 * Retrieves OHLCV for the specified symbols and ranges
 * 
 */
function AE3OHLCVTWOASSETS(asset1, asset2, from, to, interval,refreshValue){
  try{
    
    var accessToken = fetchAccessToken();

    if(accessToken ==null){
      return [['Please check your credentials or email contactus@apexe3.com quoting your API Client ID']];
    }else{}
    

    
    //UNCOMMENT TO DEBUG
     //asset1 = 'TSLA';
     //asset2 = 'BTC-USD';
     //from = '01-01-2017';
     //to = '01-11-2020';
     //interval = '';
    // var time = new Date(timeStamps[i]*1000); may have to do this for all time values..

    var encodedAsset1 = encodeURIComponent(asset1);
    var encodedAsset2 = encodeURIComponent(asset2);
    
    var params = 'symbol1=' + encodedAsset1 + '&symbol2='+encodedAsset2+'&from=' + from + '&to='+to+'&interval='+interval;
    var url =  ohlcvRestTwoAssetsApiUrl + '?' + params;
    var creds = getOptions(accessToken);
    var response = UrlFetchApp.fetch(url, creds);
    var entities = JSON.parse(response.getContentText()).result;
    var combinedResults = [['Symbol','Time', 'Open', 'High', 'Low', 'Close', '','','', 'Symbol', 'Time', 'Open', 'High', 'Low', 'Close',]]
    
    if(entities!=null && entities.symbol1Result!=null && entities.symbol2Result!=null){
      
          //var resultsForAsset1 = entities.symbol1Result;
          //var resultsForAsset2 = entities.symbol2Result;
         for(var i=0; i< entities.symbol1Result.length; i++){
                    
             var combinedResult = [asset1,entities.symbol1Result[i][0], entities.symbol1Result[i][1], entities.symbol1Result[i][2], entities.symbol1Result[i][3], entities.symbol1Result[i][4],'','','', asset2,entities.symbol2Result[i][0], entities.symbol2Result[i][1], entities.symbol2Result[i][2], entities.symbol2Result[i][3], entities.symbol2Result[i][4]];              
             combinedResults.push(combinedResult);              
         }
        
         return combinedResults;
    
      
    }else{
      
       return [['problem fetching content']];
    }

  }catch(e){
  
    return [['problem fetching content ' + e]];
  }
  
}
           
          
         

/**
 * 
 * Retrieves global orderbook for supplied pair
 * 
 * @param base 
 * @param quote 
 * @param refreshValue 
 */
function fetchGlobalOrderbook(base, quote, refreshValue) {

    try {
        
        if (base == null || base == '' || quote == null || quote == '') {

            return [['Must specify a valid basedId and quoteId']];
        }

        //Assume the quoteId is one row above and one column to the right, above the selected cell

        var accessToken = fetchAccessToken();

        if (accessToken == INVALID_CREDS_MESSAGE) {
            return INVALID_CREDS_MESSAGE;
        } else { }

        if (accessToken != null) {

            var tokenToCannoicalIdMap = getTokenToCannoicalIdMap();
            var cannonicalIdToTokenMap = getCannonicalIdToTokenMap();

            base != null ? base = base.toUpperCase() : null;
            quote != null ? quote = quote.toUpperCase() : null;

            var baseId = tokenToCannoicalIdMap.get(base);
            var quoteId = tokenToCannoicalIdMap.get(quote);

            //baseId = 'FIL:CRYPTO';
            //quoteId = 'USDT:CRYPTO';
          
            var encodedBase = encodeURIComponent(baseId);
            var encodedQuote = encodeURIComponent(quoteId);

            var params = 'baseId=' + encodedBase + '&quoteId=' + encodedQuote + '&aggregate=true';
            var url = apiRestURL + 'orderbook/SPOT?' + params;

            var creds = getOptions(accessToken);
            var response = UrlFetchApp.fetch(url, creds);

            Logger.log(response);
            
            var responseContent = JSON.parse(response.getContentText());

            var entities = JSON.parse(response.getContentText()).result;

            var bids = [];
            var asks = [];

            var global = [['Exchange', 'Bid Size', 'Bid Price', 'Ask Price', 'Ask Size', 'Exchange']];

            //assume top 25 of each orderbook to avoid depth noise
            for (var i = 0; i < entities.length; i++) {

                for (var j = 0; j < Math.min(entities[i].bids.length,entities[i].asks.length); j++) {

                  try{
                    var bidRow = [entities[i].e, entities[i].bids[j][1], entities[i].bids[j][0]]
                    bids.push(bidRow);

                    var askRow = [entities[i].asks[j][0], entities[i].asks[j][1], entities[i].e]
                    asks.push(askRow);
                  }
                  catch(e){}

                }

            }

            //bids descending
            bids = bids.sort(compareBidsDesc);
            //asks ascending
            asks = asks.sort(compareAsksAsc);
            //asks = asks.reverse();

            var globalAggLength = Math.min(bids.length, asks.length);

            
            for (var i = 0; i < globalAggLength; i++) {

                var row = [bids[i][0], bids[i][1], bids[i][2], asks[i][0], asks[i][1], asks[i][2]];
                global.push(row);

            }

            return global;


        } else {
            return [['No access token retrieved. Check your credentials']];

            Logger.log('No access token retrieved. Check your credentials');

        }


    } catch (e) {

        Logger.log(e);
        return [['There was a problem fetching global orderbook data. Check supplied token symbol, quoted market or your credentials']];

    }


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




