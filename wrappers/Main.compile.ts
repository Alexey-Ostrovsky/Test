import { CompilerConfig, buildOne } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'func',
    targets: [
        'contracts/main.fc',
    ],
    async preCompileHook() {
        console.log("\nPrecompiling jettonWallet...");
        await buildOne('JettonWallet');
        console.log("Precompiling jettonWallet successful");
    },
};