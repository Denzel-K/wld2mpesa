
async function test() {
    try {
        const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=WLDUSD,USDKES');
        console.log(`Status: ${response.status}`);
        const data = await response.json();
        console.log(`Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error:`, e);
    }
}
test();
