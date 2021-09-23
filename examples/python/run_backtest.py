'''
/**
 * run_backtest.py
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
'''

import sys
sys.path.append('..')
from apexe3.apexe3 import initialise
from apexe3.apexe3 import run_backtest
import json

import pandas as pd

def init():
    clientId = "Enter API client Id here"
    clientSecret = "Enter API secret here"
    username = "Enter username here"
    password = "Enter password here"
    initialise(clientId, clientSecret, username, password)

if __name__ == "__main__":
    init()
    
    #Read about how to use this API here:
    #https://intercom.help/apexe3/en/articles/4711970-programmatic-backtesing
    
    indicatorParams = {

        'indicator1': {
            'type': 'price'
        },

        'indicator2': {

            'type': 'macd',
            'shortPeriod': '12',
            'longPeriod': '26',
            'signalPeriod': '9',
            'priceComponent': 'close'

        }

    }
    strategyParams = {

        'entryDirection': 'long',
        'entryIndicator1': 'macd',
        'entryOperator': '>',
        'entryIndicator2': 'histogram',
        'exitIndicator1': 'signal',
        'exitOperator': '<',
        'exitIndicator2': 'macd',
        'stopLoss': '0.1'

    }

    
    result = run_backtest('10000', 'COINBASEPRO', 'BTC', 'USD', '2018-01-01', '2021-09-01', indicatorParams, strategyParams,'1m','','DIGITAL','SPOT')
    
    print(result['analysis'])

    #table=pd.DataFrame(result['trades'])
    #table=pd.DataFrame(result['marketData'])
    #print(table)