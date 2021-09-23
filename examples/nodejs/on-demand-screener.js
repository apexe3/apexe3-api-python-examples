/**
 * on-demand-screener.js
 * 
 * Provides a progammatic way to screen markets. 
 * A visualisation of the screener is available at:
 * https://app.ae3platform.com/
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

const clientId = "Enter API client Id here";
const clientSecret = "Enter API client secret here";
const username = "Enter username here";
const password = "Enter password here";

(async () => {
    await apexe3.initialise(clientId, clientSecret, username, password);
    const stats = await screenPair('BTC','USDT');
    console.table(stats, ['exchangeId','baseId', 'quoteId', 'v24HrChg','v30dChg','v24HrVsV30dSum','p15MinChg','p1HrChg','p7dChg','pLast']);

})();


async function screenPair(base,quote){

    return await apexe3.screen(base,quote);
}