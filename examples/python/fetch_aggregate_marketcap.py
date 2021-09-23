'''
/**
 * fetch-aggregate-ohlcv.js
 * 
 * Retrieves market cap OHLCV for digital assets
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
'''

import sys
sys.path.append('..')
from apexe3.apexe3 import initialise
from apexe3.apexe3 import fetch_marketcap_for_crypto_symbol

import pandas as pd

def init():
    clientId = "Enter API client Id here"
    clientSecret = "Enter API secret here"
    username = "Enter username here"
    password = "Enter password here"
    initialise(clientId, clientSecret, username, password)

if __name__ == "__main__":
    init()
    #Change these values to a ticker you are interested in - see the supportedAssetIdsForAggregateOHLCV folder for searchable tickers
    table=pd.DataFrame(fetch_marketcap_for_crypto_symbol('BTC', '01-01-2018','31-12-2020')['result'])
    
    print(table)