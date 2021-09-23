'''
/**
 * on_demand_screener.py
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

'''

import sys
sys.path.append('..')
from apexe3.apexe3 import initialise
from apexe3.apexe3 import screen
import pandas as pd

def init():
    clientId = "Enter API client Id here"
    clientSecret = "Enter API secret here"
    username = "Enter username here"
    password = "Enter password here"
    initialise(clientId, clientSecret, username, password)
  
#Filter Screen todo think of clearer name
def screenPair(base,quote):
    result = screen(base,quote)
    table=pd.DataFrame(result)
    table = table[['exchangeId','baseId', 'quoteId', 'v24HrChg','v30dChg','v24HrVsV30dSum','p15MinChg','p1HrChg','p7dChg','pLast']]
    print(table)


if __name__ == "__main__":
    init()
    #Change these values to a base or quote you are interested in
    screenPair('btc','usdt')