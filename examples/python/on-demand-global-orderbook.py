'''
/**
 * on_demand_global_orderbook.py
 * 
 * Fetches orderbook for the supplied pair
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
'''

import sys
sys.path.append('..')
from apexe3.apexe3 import initialise
from apexe3.apexe3 import fetch_global_orderbook_for_pair

import pandas as pd

def init():
    clientId = "Enter API client Id here"
    clientSecret = "Enter API secret here"
    username = "Enter username here"
    password = "Enter password here"
    initialise(clientId, clientSecret, username, password)

if __name__ == "__main__":
    init()
    #Change these values to a base or quote you are interested in
    table=pd.DataFrame(fetch_global_orderbook_for_pair("btc", "usdt", "SPOT"))
    table.columns = ['exchange', 'bid size', 'bid px', 'ask px', 'ask aize', 'exchange']
    print(table)