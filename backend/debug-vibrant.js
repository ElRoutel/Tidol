console.log('--- Attempt 1: Named import from main ---');
try {
    const { Vibrant } = await import('node-vibrant');
    console.log('Success Named:', Vibrant);
} catch (e) {
    console.log('Failed Named:', e.message);
}

console.log('--- Attempt 2: Default from main ---');
try {
    const mod = await import('node-vibrant');
    console.log('Mod keys:', Object.keys(mod));
    console.log('Mod default:', mod.default);
} catch (e) {
    console.log('Failed Default:', e.message);
}

console.log('--- Attempt 3: Default from /node ---');
try {
    const modNode = await import('node-vibrant/node');
    console.log('Node Mod keys:', Object.keys(modNode));
} catch (e) {
    console.log('Failed /node:', e.message);
}
