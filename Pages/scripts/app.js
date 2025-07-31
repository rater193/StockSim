// This file contains the JavaScript code for the stock tracker application. 
// It handles fetching stock data from APIs, updating the UI with stock information, and implementing any interactive features.

document.addEventListener('DOMContentLoaded', function() {
    const stockList = document.getElementById('stock-list');
    const addStockBtn = document.getElementById('add-stock-btn');
    const addStockModal = document.getElementById('add-stock-modal');
    const modalStockSymbol = document.getElementById('modal-stock-symbol');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const trackBtn = document.getElementById('track-stock');
    const stockInput = document.getElementById('stock-symbol');
    const stockInfo = document.getElementById('stock-info');

    // Store tracked stocks
    let trackedStocks = [];

    // WARNING: Never expose your real keys in production!
    const API_KEY = "PKGPM5LOAP0A6S2YS8TW";
    const API_SECRET = "mgXzCP48R4Mf5AwyjJKOMDbAfLQjMiwZf7DvTjTR";

    async function fetchStock(symbol) {
        try {
            const url = `https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`;
            const response = await fetch(url, {
                headers: {
                    "APCA-API-KEY-ID": API_KEY,
                    "APCA-API-SECRET-KEY": API_SECRET
                }
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data && data.trade && data.trade.p) {
                return {
                    symbol,
                    price: data.trade.p,
                    time: new Date(data.trade.t).toLocaleString()
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    // Helper: fetch intraday bars for a symbol (1-min bars for today)
    async function fetchIntradayBars(symbol) {
        const today = new Date().toISOString().slice(0, 10);
        const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Min&start=${today}T09:30:00Z&limit=100`;
        try {
            const response = await fetch(url, {
                headers: {
                    "APCA-API-KEY-ID": API_KEY,
                    "APCA-API-SECRET-KEY": API_SECRET
                }
            });
            if (!response.ok) return [];
            const data = await response.json();
            if (!data.bars) return [];
            // Convert to Chart.js financial format
            return data.bars.map(bar => ({
                x: new Date(bar.t),
                o: bar.o,
                h: bar.h,
                l: bar.l,
                c: bar.c
            }));
        } catch {
            return [];
        }
    }

    // Store local price history for each holding
    let holdingPriceHistory = {}; // { symbol: [ { t, o, h, l, c } ] }

    // Store chart instances to avoid duplicates
    const holdingCharts = {};

    // Update holdings prices and record price history
    async function updateHoldingsPrices() {
        for (const symbol in holdings) {
            const stock = await fetchStock(symbol);
            if (stock) {
                holdings[symbol].lastPrice = stock.price;
            }
        }
        updatePaperUI();
    }

    async function updateStockList() {
        stockList.innerHTML = '';
        for (const symbol of trackedStocks) {
            const stock = await fetchStock(symbol);

            // Create container for stock info only (no chart)
            const container = document.createElement('div');
            container.className = 'stock-item';

            // Stock info
            const infoDiv = document.createElement('div');
            if (stock) {
                infoDiv.innerHTML = `<strong>${stock.symbol}</strong> - $${stock.price} <small>(${stock.time})</small>`;
            } else {
                infoDiv.textContent = `${symbol} - Error fetching data`;
            }

            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.style.marginLeft = '10px';
            removeBtn.addEventListener('click', () => {
                trackedStocks = trackedStocks.filter(s => s !== symbol);
                updateStockList();
            });
            infoDiv.appendChild(removeBtn);

            container.appendChild(infoDiv);
            stockList.appendChild(container);

            // Removed candlestick chart rendering for tracked stocks
        }
    }

    const clearStocksBtn = document.getElementById('clear-stocks-btn');

    // Clear all tracked stocks
    if (clearStocksBtn) {
        clearStocksBtn.addEventListener('click', () => {
            trackedStocks = [];
            updateStockList();
        });
    }

    // Modal logic
    addStockBtn.addEventListener('click', () => {
        addStockModal.style.display = 'flex';
        modalStockSymbol.value = '';
        modalStockSymbol.focus();
    });
    modalCancelBtn.addEventListener('click', () => {
        addStockModal.style.display = 'none';
    });
    modalOkBtn.addEventListener('click', () => {
        const symbol = modalStockSymbol.value.trim().toUpperCase();
        if (symbol && !trackedStocks.includes(symbol)) {
            trackedStocks.push(symbol);
            updateStockList();
        }
        addStockModal.style.display = 'none';
    });

    // Also allow Enter key in modal input
    modalStockSymbol.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            modalOkBtn.click();
        }
    });

    // Track single stock info (optional)
    if (trackBtn && stockInput && stockInfo) {
        trackBtn.addEventListener('click', async function() {
            const symbol = stockInput.value.trim().toUpperCase();
            if (!symbol) {
                stockInfo.textContent = "Please enter a stock symbol.";
                return;
            }
            stockInfo.textContent = "Loading...";
            const stock = await fetchStock(symbol);
            if (stock) {
                stockInfo.innerHTML = `<strong>${stock.symbol}</strong><br>Price: $${stock.price}<br>Time: ${stock.time}`;
            } else {
                stockInfo.textContent = "No data found for this symbol.";
            }
        });
    }

    // Paper trading state
    let paperBalance = 10000.00;
    let holdings = {}; // { symbol: { qty, avgPrice } }
    let tradeHistory = [];
    const tradeHistoryList = document.getElementById('trade-history-list');

    // Paper trading UI elements
    const paperBalanceSpan = document.getElementById('paper-balance');
    const tradeSymbolInput = document.getElementById('trade-symbol');
    const tradeQtyInput = document.getElementById('trade-qty');
    const buyBtn = document.getElementById('buy-btn');
    const sellBtn = document.getElementById('sell-btn');
    const holdingsList = document.getElementById('holdings-list');
    const avgTradeGainSpan = document.getElementById('avg-trade-gain');

    function updateAverageTradeGain() {
        // Only consider completed trades (sell)
        let totalGain = 0;
        let count = 0;
        tradeHistory.forEach(entry => {
            if (entry.type === 'sell' && entry.buyPrice !== undefined) {
                const gain = ((entry.price - entry.buyPrice) / entry.buyPrice) * 100;
                totalGain += gain;
                count++;
            }
        });
        avgTradeGainSpan.textContent = count ? (totalGain / count).toFixed(2) + '%' : '0.00%';
    }

    function updateTradeHistoryUI() {
        tradeHistoryList.innerHTML = '';
        tradeHistory.slice().reverse().forEach(entry => {
            let gainStr = '';
            if (entry.type === 'sell' && entry.buyPrice !== undefined) {
                const gain = ((entry.price - entry.buyPrice) / entry.buyPrice) * 100;
                gainStr = ` | Gain: ${gain.toFixed(2)}%`;
            }
            const li = document.createElement('li');
            li.textContent = `[${entry.time}] ${entry.type.toUpperCase()} ${entry.qty} ${entry.symbol} @ $${entry.price.toFixed(2)} = $${entry.total.toFixed(2)}${gainStr}`;
            tradeHistoryList.appendChild(li);
        });
        updateAverageTradeGain();
    }

    // Call renderHoldingCharts() inside updatePaperUI to keep charts in sync
    function updatePaperUI() {
        // Update balance
        if (paperBalanceSpan) {
            paperBalanceSpan.textContent = paperBalance.toFixed(2);
        }
        // Update holdings
        if (holdingsList) {
            holdingsList.innerHTML = '';
            Object.keys(holdings).forEach(symbol => {
                const h = holdings[symbol];
                let gainStr = '';
                if (h.lastPrice) {
                    const gain = ((h.lastPrice - h.avgPrice) / h.avgPrice) * 100;
                    gainStr = ` | Gain: ${gain.toFixed(2)}%`;
                }
                const li = document.createElement('li');
                li.textContent = `${symbol}: ${h.qty} @ $${h.avgPrice.toFixed(2)}${gainStr}`;
                holdingsList.appendChild(li);
            });
        }
    }

    if (buyBtn && sellBtn && tradeSymbolInput && tradeQtyInput) {
        buyBtn.addEventListener('click', async () => {
            const symbol = tradeSymbolInput.value.trim().toUpperCase();
            const qty = parseInt(tradeQtyInput.value, 10);
            if (!symbol || !qty || qty < 1) return;
            const stock = await fetchStock(symbol);
            if (!stock) return alert("Stock not found.");
            const cost = stock.price * qty;
            if (cost > paperBalance) return alert("Not enough balance.");
            paperBalance -= cost;
            if (!holdings[symbol]) {
                holdings[symbol] = { qty: 0, avgPrice: 0 };
            }
            // Weighted average price
            const prev = holdings[symbol];
            const totalQty = prev.qty + qty;
            prev.avgPrice = ((prev.avgPrice * prev.qty) + (stock.price * qty)) / totalQty;
            prev.qty = totalQty;
            prev.lastPrice = stock.price;

            // Add to history
            tradeHistory.push({
                type: 'buy',
                symbol,
                qty,
                price: stock.price,
                total: cost,
                time: new Date().toLocaleString()
            });

            updatePaperUI();
            updateTradeHistoryUI();
        });

        sellBtn.addEventListener('click', async () => {
            const symbol = tradeSymbolInput.value.trim().toUpperCase();
            const qty = parseInt(tradeQtyInput.value, 10);
            if (!symbol || !qty || qty < 1) return;
            if (!holdings[symbol] || holdings[symbol].qty < qty) return alert("Not enough shares.");
            const stock = await fetchStock(symbol);
            if (!stock) return alert("Stock not found.");
            const proceeds = stock.price * qty;
            paperBalance += proceeds;
            holdings[symbol].qty -= qty;
            holdings[symbol].lastPrice = stock.price;
            if (holdings[symbol].qty === 0) delete holdings[symbol];

            // Find average buy price for this symbol
            let avgBuyPrice = holdings[symbol] && holdings[symbol].avgPrice ? holdings[symbol].avgPrice : stock.price;
            // Add to history
            tradeHistory.push({
                type: 'sell',
                symbol,
                qty,
                price: stock.price,
                total: proceeds,
                time: new Date().toLocaleString(),
                buyPrice: avgBuyPrice
            });

            updatePaperUI();
            updateTradeHistoryUI();
        });
    }

    // Update every 15 seconds
    setInterval(updateStockList, 15000);
    setInterval(updateHoldingsPrices, 15000);

    // Optional: update immediately on load
    updateStockList();
    updateHoldingsPrices();
    updateTradeHistoryUI();
});