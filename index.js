const core = require('@actions/core');
const exec = require('@actions/exec');
const { promises: fs } = require('fs');
const { Writable } = require('node:stream');


const testFile = 'test/ERC20PostDeploymentTest.sol';
const testContract = 'ERC20PostDeploymentTest';
const testSuite = `${testFile}:${testContract}`;
const addressFile = 'lib/awesome-buggy-erc20-tokens/bad_tokens.top.json';
const outStream = new Writable();

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
    for (let address of addresses) {
      const testResult = await forgeTest(address);
      const results = testResult[testSuite].test_results;
      const resultsSorted = Object.entries(results).sort(([aKey,aVal],[bKey, bVal]) => 
        aKey < bKey ? -1 : (aKey === bKey) ? 0 : 1
      );
      let resultBitString = "";
      for (let [testName, result] of resultsSorted) {
        resultBitString += result.success ? "1" : "0";
      }
      summary += `${address}:${resultBitString}\n`;
    }
    core.info("Results");
    core.info(testCases.join("\n"));
    core.info(summary);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function forgeTest(address) {
  const infura_api_key = core.getInput('infura_api_key');
  const options = {
    outStream,
    siltent: true,
    ignoreReturnCode: true,
    env : {
      ERC20_ADDRESS : address
    }
  };
  const forgeTestOut = await exec.getExecOutput(
    'forge',
    [
      'test',
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
  const addresses = Object.keys(addressJson).slice(0, 10);
  return addresses;
}

run();