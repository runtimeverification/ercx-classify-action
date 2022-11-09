const core = require('@actions/core');
const exec = require('@actions/exec');
const { promises: fs } = require('fs');


// most @actions toolkit packages have async methods
async function run() {
  try {
    core.info('Running classifier');
    const infura_api_key = core.getInput('infura_api_key');
    const testFile = 'test/ERC20PostDeploymentTest.sol';
    const addressFile = 'lib/awesome-buggy-erc20-tokens/bad_tokens.top.json';
    
    // Read token list file
    const addressFileContents = await fs.readFile(addressFile, 'utf8');
    const addressJson = JSON.parse(addressFileContents);
    const addresses = Object.keys(addressJson).slice(0, 3);

    // Call post deployment test for each address

    for (let address of addresses) {

      const options = {
        ignoreReturnCode: true,
        env : {
          ERC20_ADDRESS : address
        }
      };

      // Run forge test
      const forgeTestOut = await exec.getExecOutput(
        'forge',
        [
          'test',
          '--silent',
          '--match-path', testFile,
          '--fork-url', `https://mainnet.infura.io/v3/${infura_api_key}`
        ],
        options
      );
      const testResult = forgeTestOut.stdout;

    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();