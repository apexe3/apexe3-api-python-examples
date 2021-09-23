/**
 * on-demand-global-orderbook.js
 * 
 * Retrieves global orderbook for the supplied pair
 * 
 * An example of the orderbook is available here:
 * https://app.ae3platform.com/markets/p/BTC/USDT
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
    let globalOrderbook = await apexe3.fetchGlobalOrderbookForPair('BTC', 'USDT', 'SPOT');
   
    console.table(['Exchange', 'Bid Size', 'Bid Price', 'Ask Price', 'Ask Size', 'Exchange'],globalOrderbook);
   

})();



