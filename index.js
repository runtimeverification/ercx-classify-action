const core = require('@actions/core');
const exec = require('@actions/exec');
const { promises: fs } = require('fs');
const { Writable } = require('node:stream');

const testFile = 'test/ERC20PostDeploymentTest.sol';
const testContract = 'ERC20PostDeploymentTest';
const testSuite = `${testFile}:${testContract}`;
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

  const timeoutOut = await exec.getExecOutput(
    'which',
    ['timeout']
  );

  core.info(`${timeoutOut.stdout}`);


  try {
    core.info('Running classifier');
    core.info(`Test set name: ${core.getInput('test_set_name')}`);
    core.info(`Test set start index: ${core.getInput('test_set_start_index')}`);
    core.info(`Test set count: ${core.getInput('test_set_count')}`);
    const forgeList = await forgeTestList();
    const testCases = forgeList[testFile][testContract];
    // Read token list file
    const addresses = await readAddresses();

    core.info("Results");
    core.info(`Name,Symbol,Decimals,Address,${testCases.join(",")}`);
    // Call post deployment test for each address
    for (let tokenInfo of addresses) {
      try {
        const address = tokenInfo.address;
        const testResult = await forgeTest(address);
        const results = testResult[testSuite].test_results;
        const resultsSorted = Object.entries(results).sort(([aKey,aVal],[bKey, bVal]) => 
          aKey < bKey ? -1 : (aKey === bKey) ? 0 : 1
        );
        const name = results["testFailName()"].reason || "unknown";
        const symbol = results["testFailSymbol()"].reason || "unknown";
        const decimals = results["testFailDecimals()"].reason || "unknown";
        const resultBits = [];
        for (let [testName, result] of resultsSorted) {
          resultBits.push(result.success ? "1" : "0");
        }
        const resultBitString = resultBits.join(",");
        const row = `${name},${symbol},${decimals},${address},${resultBitString}`;
        core.info(row);
      } catch (e) {
        core.warning(`Couldn't test token ${tokenInfo.name ?? 'Unknown name'} (address ${address})`);
        core.warning(e);
      }
    }
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
    ['test', '--list', '--json', '--silent'],
    { outStream }
  );
  const forgeListJson = JSON.parse(forgeListOut.stdout);
  return forgeListJson;
}

async function readAddresses() {
  const testSetName = core.getInput('test_set_name');
  if (!(['bigquery-top-100', 'buggy-top-100', 'etherscan-top-1000'].includes(testSetName))) {
    throw `Unknown test set: ${testSetName}`
  }
  const addressFile = `${__dirname}/testset/${testSetName}.json`;
  const startIndex = Number(core.getInput('test_set_start_index'));
  const count = Number(core.getInput('test_set_count'));
  const addressFileContents = await fs.readFile(addressFile, 'utf8');
  const addressJson = JSON.parse(addressFileContents);
  const addresses = addressJson.slice(
    startIndex,
    startIndex + count
  );
  return addresses;
}

run();