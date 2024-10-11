import { toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const main = provider.open(Main.createFromConfig({
        n: 69n
    }, await compile('Main')));

    await main.sendDeploy(provider.sender(), toNano('0.05'));

    await main.sendValue(provider.sender(), toNano('0.05'), 123n);

    await main.sendValue(provider.sender(), toNano('0.05'), 69n);
}
