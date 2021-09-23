/**
 * real-time-global-orderbook.js
 * 
 * Streams a real-time orderbook for the supplied pair
 * An example of the real-time orderbook is available here:
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

const clientId = "Enter client id here";
const clientSecret = "Enter client secret here";


(async () => {

  const stream = await initGlobalOrderbook('BTC', 'USDT');

  stream.on('GLOBAL_ORDERBOOK', (globalOrderbook) => {

    console.log('bids');
    console.table(['bid px','bid size', 'bid size cumulative', 'bid sum', 'bid sum cumulative', 'exchange'],globalOrderbook.bids);

    console.log('asks');
    console.table(['bid px','bid size', 'bid size cumulative', 'bid sum', 'bid sum cumulative', 'exchange'],globalOrderbook.asks);

  });

})();

async function initGlobalOrderbook(base,quote) {
  await apexe3.initialise(clientId, clientSecret);
  return await apexe3.initialiseGlobalOrderbook(base,quote,null,null);
}
