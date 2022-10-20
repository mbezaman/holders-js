
const fs = require("fs");
require("dotenv").config();
const ethers = require('ethers');
const moment = require('moment');
const erc20abi = require('./erc20abi.json');
const transfers = require('./transfers.json');

const tokenAddress = "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE"; // using this address for testing

const provider = new ethers.providers.WebSocketProvider(process.env.INFURA_WEBSOCKET);
const contract = new ethers.Contract(tokenAddress, erc20abi, provider);

// call the updateHolders function on a schedule
// or whenever it is needed to get a current holders list
async function updateHolders() {
  const transfer_list = require('./transfers.json');
  const holder_list = require('./holders.json');
  const decimals = await contract.decimals();

  for (let i = 0; i < transfer_list.length; i++){
    let obj = transfer_list[i];

    // skip the token address, don't include it in holders file
    // we can add other addesses to skip later i.e. dev wallet
    if(obj['from'] != tokenAddress) {
      let from_balance = await contract.balanceOf(obj['from']);
      let info = {
        address: obj['from'],
        balance: parseFloat(ethers.utils.formatUnits(from_balance, decimals))
      };
      if (info != null) {
        holder_list.push(info);
      }
    }

    if(obj['to'] != tokenAddress) {
      let to_balance = await contract.balanceOf(obj['to']);
      let info = {
        address: obj['to'],
        balance: parseFloat(ethers.utils.formatUnits(to_balance, decimals))
      };
      if (info != null) {
        holder_list.push(info);
      }
    }
  }

  const dedupedArray = removeDuplicates(holder_list);

  dedupedArray.sort(function(a, b){
    // return a.balance - b.balance;   //sort ascending
    return b.balance - a.balance;      //sort decending
  });

  fs.writeFile("holders.json", JSON.stringify(dedupedArray, null, 2), err => {
    if (err) console.log("Error writing holders file:", err);
  });

  console.log('Success: Updated Holders File')
};


function removeDuplicates(holdersList) {
  let dedupedArray = [];
  let uniqueObject = {};
  for (let i in holdersList) {
    objAddress = holdersList[i]['address'];
    uniqueObject[objAddress] = holdersList[i];
  }
  for (i in uniqueObject) {
    if (uniqueObject[i] != null) {
      dedupedArray.push(uniqueObject[i]);
    }
  }
  return dedupedArray;
};


// listen for contract transfer event
async function main() {
  const decimals = await contract.decimals();
  contract.on("Transfer", (from, to, value, event) => {
    let info = {
      from: from,
      to: to,
      value: ethers.utils.formatUnits(value, decimals),
      block: event['blockNumber'],
      tx: event['transactionHash'],
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };

    transfers.push(info);

    fs.writeFile("transfers.json", JSON.stringify(transfers, null, 2), err => {
      if (err) console.log("Error writing transfers file:", err);
    });

    console.log(JSON.stringify(info, null, 4));
  });
};

console.log('Start Listening for Transfer Events...')
main();

// change this to whatever interval you want
let minutes = 5;
let the_interval = minutes * 60 * 1000;
setInterval(function() {
  updateHolders();
}, the_interval);