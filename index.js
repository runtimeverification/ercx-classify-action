const core = require('@actions/core');
const exec = require('@actions/exec');
const { promises: fs } = require('fs');
const { Writable } = require('node:stream');


const testFile = 'test/ERC20PostDeploymentTest.sol';
const testContract = 'ERC20PostDeploymentTest';
const testSuite = `${testFile}:${testContract}`;
const addressFile = 'lib/awesome-buggy-erc20-tokens/bad_tokens.all.json';
const outStream = new Writable({
  write(chunk, encoding, callback) {
    // discard output
  },
  writev(chunks, callback) {
    // discard output
  }
});

// most @actions toolkit packages have async methods
async function run() {
  try {
    core.info('Running classifier');
    const forgeList = await forgeTestList();
    const testCases = forgeList[testFile][testContract];
    // Read token list file
    const addresses = await readAddresses();

    // Call post deployment test for each address
    let summary = "";
    for (let [address, tokenInfo] of addresses) {
      try {
        const testResult = await forgeTest(address);
        const results = testResult[testSuite].test_results;
        const resultsSorted = Object.entries(results).sort(([aKey,aVal],[bKey, bVal]) => 
          aKey < bKey ? -1 : (aKey === bKey) ? 0 : 1
        );
        const resultBits = [];
        for (let [testName, result] of resultsSorted) {
          resultBits.push(result.success ? "1" : "0");
        }
        const resultBitString = resultBits.join(",");
        const name = tokenInfo.name ?? 'Unknown name';
        const symbol = tokenInfo.symbol ?? 'Unknown symbol';
        const decimals = tokenInfo.decimals ?? 'Unknown decimals';
        summary += `${address},${resultBitString},${name},${symbol},${decimals}\n`;
      } catch (e) {
        core.warning(`Couldn't test token ${tokenInfo.name ?? 'Unknown name'} (address ${address})`);
        core.warning(e);
      }
    }
    core.info("Results");
    core.info(`Address,${testCases.join(",")},Name,Symbol,Decimals`);
    core.info(summary);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function forgeTest(address) {
  const infura_api_key = core.getInput('infura_api_key');
  const etherscan_api_key = core.getInput('etherscan_api_key');
  const options = {
    outStream,
    silent: true,
    ignoreReturnCode: true,
    env : {
      ERC20_ADDRESS : address,
      ERC20_IMPLEMENTATION_ADDRESS : address,
      ETHERSCAN_API_KEY : etherscan_api_key
    }
  };
  const forgeTestOut = await exec.getExecOutput(
    'forge',
    [
      'test',
      '--ffi',
      '--silent',
      '--json',
      '--match-path', testFile,
      '--fork-url', `https://mainnet.infura.io/v3/${infura_api_key}`
    ],
    options
  );
  const forgeTestJson = JSON.parse(forgeTestOut.stdout);
  return forgeTestJson;
}

async function forgeTestList() {
  const forgeListOut = await exec.getExecOutput(
    'forge',
    ['test', '--list', '--json', '--silent']
  );
  const forgeListJson = JSON.parse(forgeListOut.stdout);
  return forgeListJson;
}

async function readAddresses() {
  const addressFileContents = await fs.readFile(addressFile, 'utf8');
  const addressJson = JSON.parse(addressFileContents);
  const addresses = Object.entries(addressJson).slice(0, 100);
  return addresses;
}

run();