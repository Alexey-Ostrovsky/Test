import { toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const main = provider.open(Main.createFromConfig({
        n: 292n
    }, await compile('Main')));

    await main.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(main.address);

    // run methods on `main`

    var value = await main.sendValue(provider.sender(), toNano('0.05'), 292n);

    console.log("Initial n value: ", await main.getCurrentNValue());
}
