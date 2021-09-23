/**
 * run-backtest.js
 * 
 * Runs a backtest based on supplied parameters
 * Read more here: https://intercom.help/apexe3/en/articles/4711970-programmatic-backtesing
 * 
 * Disclaimer:
 * APEX:E3 is a financial technology company based in the United Kingdom https://www.apexe3.com
 *  
 * None of this code constitutes financial advice. APEX:E3 is not 
 * liable for any loss resulting from the use of this code or the API. 
 * 
 * This code is governed by The MIT License (MIT)
 * 
 * Copyright (c) 2020 APEX:E3 Team
 * 
 **/
const apexe3 = require('./apexe3/apexe3');
const cTable = require('console.table');

const clientId = "Enter API client Id here";
const clientSecret = "Enter API client secret here";
const username = "Enter username here";
const password = "Enter password here";

(async () => {

    await apexe3.initialise(clientId, clientSecret, username, password);

    //Read about how to use this API here:
    //https://intercom.help/apexe3/en/articles/4711970-programmatic-backtesing

    let indicatorParams = {

        indicator1: {
            type: 'price'
        },

        indicator2: {

            type: 'macd',
            shortPeriod: 12,
            longPeriod: 26,
            signalPeriod: 9,
            priceComponent: 'close'

        }

    };

    let strategyParams = {

        entryDirection: 'long',
        entryIndicator1: 'macd',
        entryOperator: '>',
        entryIndicator2: 'histogram',
        exitIndicator1: 'signal',
        exitOperator: '<',
        exitIndicator2: 'macd',
        stopLoss: 0.1

    }

    let results = await apexe3.runBacktest(10000, 'COINBASEPRO', 'BTC', 'USD', '2018-01-01', '2020-12-31', indicatorParams, strategyParams, 'DIGITAL', 'SPOT');

    console.table(results.analysis);
    console.table(results.trades);
    console.table(results.marketData);


})();