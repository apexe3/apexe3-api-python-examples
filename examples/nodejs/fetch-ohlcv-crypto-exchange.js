/**
 * fetch-aggregate-ohlcv.js
 * 
 * Retrieves OHLCV for digital assets listed on an exchange
 * 
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
	
const clientId = "dapi-astrosbadhabits-gmail-com";
const clientSecret = "e64611c4-8237-44d7-a78a-53128f94cd9f";

(async () => {
   
    await apexe3.initialise(clientId, clientSecret);
    //Change parameters as desired -run supported-asset-markets-exchanges.js file for a list of supported markets / exchanges
    //This endpoint is currently limited to COINBASEPRO and FTX for the free tier
    const ohlcv = await apexe3.fetchOHLCVForExchange('COINBASEPRO','BTC','USD','01-01-2018','31-12-2020','1d', 'DIGITAL', 'SPOT');
   
    console.table(['Time','Open','High','Low', 'Close', 'Volume'],ohlcv);
   

})();