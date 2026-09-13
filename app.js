(function () {
  var STORAGE_KEY = "portfolio-lens-v3";
  var OLD_STORAGE_KEY = "portfolio-lens-v1";
  var TAB_KEY = "portfolio-lens-tab";
  var BENCHMARKS = {
    asOf: "2026-09-04",
    ytd: { sp500: 5.9 },
    yoy: { sp500: 15.1 }
  };
  var REGION_COLORS = { kr: "#4F7FC4", us: "#0F8A92" };
  var BUCKETS = ["인덱스", "개별종목", "현금", "크립토"];
  var BUCKET_COLORS = {
    "인덱스": "#3182f6", "개별종목": "#6b4eff",
    "현금": "#03b26c", "크립토": "#f09a00"
  };
  var DEFAULT_TARGETS = { "인덱스": 50, "개별종목": 20, "현금": 25, "크립토": 5 };
  var DEFAULT_CASH_BAND = { min: 20, max: 30 };
  var BUCKET_TOLERANCE = 5;
  var INDEX_TICKERS = {
    SPY: true, SPLG: true, VOO: true, IVV: true, VTI: true, VT: true,
    QQQ: true, QQQM: true, SCHD: true, DIA: true, IWM: true,
    VEA: true, VWO: true, EFA: true, ACWI: true
  };
  var CRYPTO_TICKERS = {
    BTC: true, ETH: true, XRP: true, SOL: true, DOGE: true,
    IBIT: true, FBTC: true, ETHA: true, GLD: true, IAU: true
  };
  var INDEX_NAME_RE = /S&P\s?500|SP500|나스닥\s?100|NASDAQ\s?100|코스피|코스닥|다우존스|MSCI|토탈마켓|TOTAL\s?MARKET|전세계|선진국|신흥국|지수추종/i;
  var LEVERAGE_RE = /레버리지|인버스|2X|3X|TQQQ|SQQQ|QLD|SOXL|SOXS|UPRO|SPXL/i;
  var CRYPTO_NAME_RE = /비트코인|이더리움|리플|코인|크립토|가상자산|금현물|골드|BITCOIN|ETHEREUM/i;
  var AI_TICKERS = {
    NVDA: true, AMD: true, AVGO: true, PLTR: true, GOOGL: true,
    MSFT: true, META: true, AMZN: true, ORCL: true, IREN: true,
    INTC: true, MU: true, TSM: true, ASML: true, ARM: true,
    SMCI: true, DRAM: true, "005930": true, "000660": true,
    "487130": true, "491010": true, "456600": true,
    "0174B0.KS": true, "0177N0.KS": true, "396500": true
  };

  var SAMPLE = {
    fx: 1400,
    cashKrw: 2000000,
    cashUsd: 1000,
    holdings: [
      { id: "s1", name: "삼성전자", ticker: "005930", shares: 100, currency: "KRW", price: 80000, avgPrice: 70000 },
      { id: "s2", name: "QQQ", ticker: "QQQ", shares: 20, currency: "USD", price: 360, avgPrice: 320 },
      { id: "s3", name: "엔비디아", ticker: "NVDA", shares: 8, currency: "USD", price: 180, avgPrice: 150 }
    ],
    performance: defaultPerformance(),
    targets: clone(DEFAULT_TARGETS),
    cashBand: clone(DEFAULT_CASH_BAND)
  };

  function defaultPerformance() {
    return {
      yearEndValue: null,
      ytdNetFlow: 0,
      yearAgoValue: null,
      yoyNetFlow: 0
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid() {
    return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function parseNum(value) {
    if (value == null || String(value).trim() === "") return null;
    var n = Number(String(value).replace(/,/g, ""));
    return isFinite(n) ? n : NaN;
  }

  function positiveOrZero(value) {
    var n = parseNum(value);
    return n > 0 ? n : 0;
  }

  function nullablePositive(value) {
    var n = parseNum(value);
    return n > 0 ? n : null;
  }

  function nullableNumber(value) {
    var n = parseNum(value);
    return isFinite(n) ? n : null;
  }

  function normalizeCurrency(value) {
    return String(value || "").toUpperCase() === "USD" ? "USD" : "KRW";
  }

  function normalizeHolding(raw, preserveOldKrw) {
    return {
      id: raw.id || uid(),
      name: String(raw.name || "").trim(),
      ticker: String(raw.ticker || "").trim().toUpperCase(),
      shares: positiveOrZero(raw.shares),
      currency: preserveOldKrw ? "KRW" : normalizeCurrency(raw.currency),
      price: positiveOrZero(raw.price),
      avgPrice: nullablePositive(raw.avgPrice),
      bucket: normalizeBucket(raw.bucket)
    };
  }

  function normalizePerformance(raw) {
    var p = raw || {};
    return {
      yearEndValue: nullablePositive(p.yearEndValue),
      ytdNetFlow: nullableNumber(p.ytdNetFlow) || 0,
      yearAgoValue: nullablePositive(p.yearAgoValue),
      yoyNetFlow: nullableNumber(p.yoyNetFlow) || 0
    };
  }

  function normalizeTargets(raw) {
    var source = raw || {};
    var out = {};
    BUCKETS.forEach(function (key) {
      var n = nullableNumber(source[key]);
      out[key] = n == null || n < 0 ? DEFAULT_TARGETS[key] : round1(n);
    });
    return out;
  }

  function normalizeCashBand(raw) {
    var source = raw || {};
    var min = nullableNumber(source.min);
    var max = nullableNumber(source.max);
    if (min == null || min < 0) min = DEFAULT_CASH_BAND.min;
    if (max == null || max <= min) max = Math.max(min + 1, DEFAULT_CASH_BAND.max);
    return { min: round1(min), max: round1(max) };
  }

  function normalizeState(raw, preserveOldKrw) {
    var source = raw || {};
    return {
      fx: positiveOrZero(source.fx) || 1400,
      cashKrw: positiveOrZero(source.cashKrw != null ? source.cashKrw : source.cash),
      cashUsd: positiveOrZero(source.cashUsd),
      holdings: Array.isArray(source.holdings)
        ? source.holdings.map(function (h) { return normalizeHolding(h, preserveOldKrw); })
        : [],
      performance: normalizePerformance(source.performance),
      targets: normalizeTargets(source.targets),
      cashBand: normalizeCashBand(source.cashBand)
    };
  }

  function loadState() {
    try {
      var current = localStorage.getItem(STORAGE_KEY);
      if (current) return normalizeState(JSON.parse(current), false);
      var old = localStorage.getItem(OLD_STORAGE_KEY);
      if (old) return normalizeState(JSON.parse(old), true);
    } catch (error) {
      // Corrupt browser state falls back to the sample.
    }
    return clone(SAMPLE);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function formatWon(value) {
    return Math.round(value).toLocaleString("ko-KR") + "원";
  }

  function formatEok(value) {
    if (!value) return "0원";
    if (value < 1e8) return formatWon(value);
    return (value / 1e8).toFixed(2) + "억";
  }

  function bucketLabel(key) {
    return key === "크립토" ? "크립토+금" : key;
  }

  function formatPct(value) {
    return value == null || !isFinite(value) ? "—" : round1(value).toFixed(1) + "%";
  }

  function formatSignedPct(value) {
    if (value == null || !isFinite(value)) return "—";
    var sign = value >= 0 ? "+" : "−";
    return sign + Math.abs(round1(value)).toFixed(1) + "%";
  }

  function formatSignedWon(value) {
    if (value == null || !isFinite(value)) return "—";
    var sign = value >= 0 ? "+" : "−";
    return sign + Math.round(Math.abs(value)).toLocaleString("ko-KR") + "원";
  }

  function pctClass(value) {
    if (value == null || !isFinite(value)) return "";
    return value >= 0 ? "up" : "down";
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeBucket(value) {
    var key = String(value == null ? "" : value).trim();
    return BUCKETS.indexOf(key) >= 0 ? key : null;
  }

  // 종목 성격 기준 분류. 계좌가 아니라 상품이 기준이며,
  // 섹터·테마 ETF와 레버리지는 지수가 아니라 개별종목으로 본다.
  function autoBucket(holding) {
    var ticker = String(holding.ticker || "").toUpperCase().replace(/\.(KS|KQ)$/, "");
    var name = String(holding.name || "");
    if (CRYPTO_TICKERS[ticker] || CRYPTO_NAME_RE.test(name)) return "크립토";
    if (LEVERAGE_RE.test(name) || LEVERAGE_RE.test(ticker)) return "개별종목";
    if (INDEX_TICKERS[ticker] || INDEX_NAME_RE.test(name)) return "인덱스";
    return "개별종목";
  }

  function bucketOf(holding) {
    return normalizeBucket(holding.bucket) || autoBucket(holding);
  }

  function regionOf(ticker, currency) {
    if (currency === "USD") return "us";
    if (currency === "KRW") return "kr";
    var t = String(ticker || "").trim().toUpperCase();
    var bare = t.replace(/\.(KS|KQ)$/, "");
    if (/^[0-9A-Z]{6}$/.test(bare) || /\.(KS|KQ)$/.test(t)) return "kr";
    return "us";
  }

  function isComplete(holding) {
    return !!(
      holding &&
      holding.ticker &&
      holding.shares > 0 &&
      holding.price > 0
    );
  }

  function isAiHolding(holding) {
    var ticker = String(holding.ticker || "").toUpperCase();
    var name = String(holding.name || "");
    return !!AI_TICKERS[ticker] ||
      /(^|[^A-Z])AI([^A-Z]|$)|인공지능|반도체|메모리|DRAM|엔비디아|하이닉스/.test(name);
  }

  function isSemiHolding(holding) {
    var ticker = String(holding.ticker || "").toUpperCase();
    var bare = ticker.replace(/\.(KS|KQ)$/, "");
    var name = String(holding.name || "");
    if (/^(005930|000660|INTC|NVDA|AMD|MU|AVGO|TSM|ASML|DRAM)$/.test(bare)) return true;
    return /반도체|메모리|DRAM|하이닉스|삼성전자/.test(name);
  }

  function aggregateHoldings(holdings, fx) {
    var groups = {};
    holdings.filter(isComplete).forEach(function (h) {
      var ticker = h.ticker.trim().toUpperCase();
      var currency = normalizeCurrency(h.currency);
      var key = ticker + "|" + currency;
      var rate = currency === "USD" ? fx : 1;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          name: h.name || ticker,
          ticker: ticker,
          currency: currency,
          shares: 0,
          value: 0,
          cost: 0,
          costShares: 0,
          priceTotal: 0,
          region: regionOf(ticker, currency),
          bucket: bucketOf(h),
          kind: "stock"
        };
      }
      var g = groups[key];
      g.shares += h.shares;
      g.value += h.shares * h.price * rate;
      g.priceTotal += h.shares * h.price;
      if (h.avgPrice > 0) {
        g.cost += h.shares * h.avgPrice * rate;
        g.costShares += h.shares;
      }
    });

    return Object.keys(groups).map(function (key) {
      var g = groups[key];
      g.price = g.shares ? g.priceTotal / g.shares : 0;
      g.avgPrice = g.costShares ? g.cost / g.costShares / (g.currency === "USD" ? fx : 1) : null;
      g.pnl = g.costShares === g.shares ? g.value - g.cost : null;
      g.pnlPct = g.cost > 0 && g.costShares === g.shares ? (g.pnl / g.cost) * 100 : null;
      delete g.cost;
      delete g.costShares;
      delete g.priceTotal;
      return g;
    });
  }

  function portfolioReturn(current, baseline, netFlow) {
    if (!(baseline > 0)) return null;
    return ((current - baseline - (netFlow || 0)) / baseline) * 100;
  }

  // 4버킷 배분 — 목표와의 차이(%p)와 목표까지 필요한 조정 금액을 함께 낸다.
  function bucketRows(items, total, targets) {
    return BUCKETS.map(function (key) {
      var value = items.reduce(function (sum, item) {
        return sum + ((item.bucket || "개별종목") === key ? item.value : 0);
      }, 0);
      var pct = total ? (value / total) * 100 : 0;
      var target = targets[key];
      var diff = target == null ? null : pct - target;
      return {
        key: key,
        color: BUCKET_COLORS[key],
        value: value,
        pct: pct,
        target: target,
        diff: diff,
        gapKrw: target == null ? null : (target / 100) * total - value,
        off: diff != null && Math.abs(diff) > BUCKET_TOLERANCE
      };
    });
  }

  // 평단이 입력된 종목만 손익 대상. 나머지는 분모에서 빼고 커버리지로 알린다.
  function pnlSummary(stocks, stockTotal) {
    var covered = stocks.filter(function (item) { return item.pnl != null; });
    var value = covered.reduce(function (sum, item) { return sum + item.value; }, 0);
    var amount = covered.reduce(function (sum, item) { return sum + item.pnl; }, 0);
    var cost = value - amount;
    return {
      amount: covered.length ? amount : null,
      pct: cost > 0 ? (amount / cost) * 100 : null,
      cost: cost,
      count: covered.length,
      missing: stocks.length - covered.length,
      coverage: stockTotal ? (value / stockTotal) * 100 : 0
    };
  }

  function compute(input) {
    var fx = input.fx > 0 ? input.fx : 0;
    var stocks = aggregateHoldings(input.holdings, fx);
    var items = stocks.slice();
    var cashKrw = input.cashKrw > 0 ? input.cashKrw : 0;
    var cashUsdKrw = input.cashUsd > 0 ? input.cashUsd * fx : 0;

    if (cashKrw > 0) {
      items.push({
        id: "cash-krw", name: "원화 현금", ticker: "KRW",
        currency: "KRW", shares: 1, value: cashKrw,
        region: "neutral", kind: "cash", bucket: "현금", pnl: null, pnlPct: null
      });
    }
    if (cashUsdKrw > 0) {
      items.push({
        id: "cash-usd", name: "달러 현금", ticker: "USD",
        currency: "USD", shares: input.cashUsd, value: cashUsdKrw,
        region: "neutral", kind: "cash", bucket: "현금", pnl: null, pnlPct: null
      });
    }

    var total = items.reduce(function (sum, item) { return sum + item.value; }, 0);
    items.forEach(function (item) {
      item.weight = total ? (item.value / total) * 100 : 0;
    });
    items.sort(function (a, b) { return b.value - a.value; });

    var kr = items.reduce(function (sum, item) {
      return sum + (item.region === "kr" ? item.value : 0);
    }, 0);
    var us = items.reduce(function (sum, item) {
      return sum + (item.region === "us" ? item.value : 0);
    }, 0);
    var cash = cashKrw + cashUsdKrw;
    var stockTotal = stocks.reduce(function (sum, item) { return sum + item.value; }, 0);
    var aiItems = stocks.filter(isAiHolding);
    var aiValue = aiItems.reduce(function (sum, item) { return sum + item.value; }, 0);
    var semiItems = stocks.filter(isSemiHolding);
    var semiValue = semiItems.reduce(function (sum, item) { return sum + item.value; }, 0);
    var regionTotal = kr + us;
    var performance = input.performance || defaultPerformance();
    var targets = normalizeTargets(input.targets);
    var buckets = bucketRows(items, total, targets);
    var pnl = pnlSummary(stocks, stockTotal);
    var top3 = items.filter(function (item) { return item.kind === "stock"; })
      .slice(0, 3).reduce(function (sum, item) { return sum + item.value; }, 0);

    return {
      buckets: buckets,
      targets: targets,
      cashBand: normalizeCashBand(input.cashBand),
      pnl: pnl,
      top3Pct: total ? (top3 / total) * 100 : 0,
      items: items,
      total: total,
      kr: kr,
      us: us,
      cash: cash,
      cashKrw: cashKrw,
      cashUsd: input.cashUsd || 0,
      stockTotal: stockTotal,
      aiValue: aiValue,
      aiCount: aiItems.length,
      aiPct: total ? (aiValue / total) * 100 : 0,
      semiValue: semiValue,
      semiCount: semiItems.length,
      semiPct: total ? (semiValue / total) * 100 : 0,
      regionKrPct: regionTotal ? (kr / regionTotal) * 100 : 0,
      regionUsPct: regionTotal ? (us / regionTotal) * 100 : 0,
      krPct: total ? (kr / total) * 100 : 0,
      usPct: total ? (us / total) * 100 : 0,
      cashPct: total ? (cash / total) * 100 : 0,
      returns: {
        ytd: portfolioReturn(total, performance.yearEndValue, performance.ytdNetFlow),
        yoy: portfolioReturn(total, performance.yearAgoValue, performance.yoyNetFlow)
      }
    };
  }

  function emptyHolding() {
    return normalizeHolding({
      id: uid(), name: "", ticker: "", shares: 0,
      currency: "KRW", price: 0, avgPrice: null
    });
  }

  function parseTsv(text) {
    var lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter(function (line) {
      return line.trim() !== "";
    });
    if (!lines.length) return [];
    var split = function (line) {
      return line.indexOf("\t") >= 0 ? line.split("\t") : line.split(",");
    };
    var first = split(lines[0]).map(function (cell) { return cell.trim().toLowerCase(); });
    var hasHeader = first.some(function (cell) {
      return /이름|name|티커|ticker|수량|shares|통화|currency/.test(cell);
    });
    var map = {};
    if (hasHeader) {
      first.forEach(function (cell, index) {
        if (/이름|name/.test(cell)) map.name = index;
        else if (/티커|ticker|symbol/.test(cell)) map.ticker = index;
        else if (/수량|shares|quantity/.test(cell)) map.shares = index;
        else if (/통화|currency/.test(cell)) map.currency = index;
        else if (/현재|price/.test(cell)) map.price = index;
        else if (/평단|avg/.test(cell)) map.avgPrice = index;
        else if (/분류|버킷|bucket|category/.test(cell)) map.bucket = index;
      });
    }

    return lines.slice(hasHeader ? 1 : 0).map(function (line) {
      var cols = split(line).map(function (cell) { return cell.trim(); });
      var raw = hasHeader
        ? {
            name: cols[map.name],
            ticker: cols[map.ticker],
            shares: cols[map.shares],
            currency: map.currency == null ? "KRW" : cols[map.currency],
            price: cols[map.price],
            avgPrice: cols[map.avgPrice],
            bucket: map.bucket == null ? null : cols[map.bucket]
          }
        : {
            name: cols[0], ticker: cols[1], shares: cols[2],
            currency: cols[3], price: cols[4], avgPrice: cols[5],
            bucket: cols[6]
          };
      return normalizeHolding(raw, false);
    }).filter(function (holding) {
      return holding.name || holding.ticker;
    });
  }

  function parseBulk(text) {
    var raw = String(text || "").trim();
    if (!raw) throw new Error("붙여넣을 내용이 없습니다.");
    if (raw.charAt(0) === "{" || raw.charAt(0) === "[") {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { holdings: parsed.map(function (h) { return normalizeHolding(h, false); }) };
      if (!Array.isArray(parsed.holdings)) throw new Error("JSON에 holdings 배열이 없습니다.");
      return normalizeState(parsed, false);
    }
    return { holdings: parseTsv(raw) };
  }

  function exportJson() {
    return JSON.stringify({
      holdings: state.holdings.map(function (h) {
        return {
          name: h.name, ticker: h.ticker, shares: h.shares,
          currency: h.currency, price: h.price, avgPrice: h.avgPrice,
          bucket: h.bucket
        };
      }),
      fx: state.fx,
      cashKrw: state.cashKrw,
      cashUsd: state.cashUsd,
      performance: state.performance,
      targets: state.targets,
      cashBand: state.cashBand
    }, null, 2);
  }

  var state = loadState();
  var currentTab = localStorage.getItem(TAB_KEY) === "analyze" ? "analyze" : "manage";

  function setTab(tab) {
    currentTab = tab === "analyze" ? "analyze" : "manage";
    localStorage.setItem(TAB_KEY, currentTab);
    var onManage = currentTab === "manage";
    var manageBtn = document.getElementById("tab-manage");
    var analyzeBtn = document.getElementById("tab-analyze");
    var managePanel = document.getElementById("panel-manage");
    var analyzePanel = document.getElementById("panel-analyze");
    manageBtn.classList.toggle("is-on", onManage);
    analyzeBtn.classList.toggle("is-on", !onManage);
    manageBtn.setAttribute("aria-selected", onManage ? "true" : "false");
    analyzeBtn.setAttribute("aria-selected", onManage ? "false" : "true");
    managePanel.hidden = !onManage;
    analyzePanel.hidden = onManage;
    managePanel.classList.toggle("is-hidden", !onManage);
    analyzePanel.classList.toggle("is-hidden", onManage);
    if (!onManage) renderAnalyze();
  }

  function cellInput(field, value, mode) {
    return '<input data-field="' + field + '"' +
      (mode ? ' inputmode="' + mode + '"' : "") +
      ' value="' + esc(value == null ? "" : value) + '" autocomplete="off" />';
  }

  function bucketSelect(holding) {
    var options = '<option value="">자동 · ' + autoBucket(holding) + "</option>" +
      BUCKETS.map(function (key) {
        return '<option value="' + key + '"' +
          (holding.bucket === key ? " selected" : "") + ">" + key + "</option>";
      }).join("");
    return '<select data-field="bucket" aria-label="분류">' + options + "</select>";
  }

  function renderSheet() {
    var body = document.getElementById("sheetBody");
    if (!state.holdings.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty">행을 추가하거나 JSON·엑셀을 붙여넣으세요</td></tr>';
    } else {
      body.innerHTML = state.holdings.map(function (h) {
        var currency =
          '<select data-field="currency" aria-label="통화">' +
          '<option value="KRW"' + (h.currency === "KRW" ? " selected" : "") + ">KRW</option>" +
          '<option value="USD"' + (h.currency === "USD" ? " selected" : "") + ">USD</option>" +
          "</select>";
        return '<tr data-id="' + esc(h.id) + '">' +
          "<td>" + cellInput("name", h.name) + "</td>" +
          "<td>" + cellInput("ticker", h.ticker) + "</td>" +
          "<td>" + cellInput("shares", h.shares || "", "decimal") + "</td>" +
          "<td>" + currency + "</td>" +
          "<td>" + cellInput("price", h.price || "", "decimal") + "</td>" +
          "<td>" + cellInput("avgPrice", h.avgPrice == null ? "" : h.avgPrice, "decimal") + "</td>" +
          "<td>" + bucketSelect(h) + "</td>" +
          '<td><button class="ghost" type="button" data-del="' + esc(h.id) + '">삭제</button></td>' +
          "</tr>";
      }).join("");
    }
    document.getElementById("fx").value = state.fx || "";
    document.getElementById("cashKrw").value = state.cashKrw || "";
    document.getElementById("cashUsd").value = state.cashUsd || "";
    renderPerformanceInputs();
    renderTargetInputs();
  }

  function renderTargetInputs() {
    document.querySelectorAll("[data-target]").forEach(function (input) {
      var key = input.getAttribute("data-target");
      input.value = state.targets[key] == null ? "" : state.targets[key];
    });
    document.querySelectorAll("[data-band]").forEach(function (input) {
      input.value = state.cashBand[input.getAttribute("data-band")];
    });
    var sum = BUCKETS.reduce(function (acc, key) { return acc + (state.targets[key] || 0); }, 0);
    var box = document.getElementById("targetSum");
    if (!box) return;
    box.textContent = "목표 합계 " + formatPct(sum) + (Math.abs(sum - 100) > 0.05 ? " · 100%로 맞추세요" : "");
    box.classList.toggle("is-off", Math.abs(sum - 100) > 0.05);
  }

  function renderPerformanceInputs() {
    ["yearEndValue", "ytdNetFlow", "yearAgoValue", "yoyNetFlow"].forEach(function (key) {
      var input = document.querySelector('[data-performance="' + key + '"]');
      input.value = state.performance[key] == null ? "" : state.performance[key];
    });
  }

  function foldCard(title, html, open) {
    if (!html) return "";
    return '<details class="card asset-more"' + (open ? " open" : "") + "><summary>" + title +
      '</summary><div class="asset-more-body">' + html + "</div></details>";
  }

  function stockGroupName(item) {
    var name = item.name || "";
    var ticker = String(item.ticker || "").toUpperCase();
    if (ticker === "SPY" || ticker === "SPLG" || ticker === "VOO" || /미국S&P500/.test(name)) return "S&P500";
    if (ticker === "QQQ" || ticker === "QQQM" || /나스닥100|NASDAQ\s?100/.test(name)) return "나스닥100";
    if (ticker === "SCHD" || /배당다우/.test(name)) return "미국배당다우존스";
    if (/코스피100/.test(name)) return "코스피 100";
    if (/코스피/.test(name) && !/100|150/.test(name)) return "코스피";
    if (/코스닥150/.test(name)) return "코스닥 150";
    return name || ticker;
  }

  function renderDonut(buckets, total) {
    var bks = buckets.filter(function (b) { return b.value > 0; });
    if (!bks.length || !total) return "";
    var angle = 0;
    var segs = bks.map(function (b) {
      var pct = b.value / total * 100;
      var from = angle;
      angle += pct;
      return b.color + " " + from.toFixed(2) + "% " + angle.toFixed(2) + "%";
    });
    var top = bks.slice().sort(function (a, b) { return b.value - a.value; })[0];
    return '<div class="donut" style="background:conic-gradient(' + segs.join(",") + ')">' +
      '<div class="center"><b>' + bucketLabel(top.key) + " " + formatPct(top.pct) + '</b><span>최대 비중</span></div></div>';
  }

  function renderPortfolioWeight(out) {
    if (!out.total) return "";
    var order = out.buckets.slice().sort(function (a, b) { return b.pct - a.pct; });
    var maxPct = Math.max.apply(null, order.map(function (b) { return b.pct; }));
    var rows = order.map(function (b) {
      var width = maxPct ? b.pct / maxPct * 100 : 0;
      return '<div class="pf-row" data-drill="bucket" data-key="' + b.key + '" title="' + esc(b.key) + ' 구성 보기">' +
        '<div class="pf-nm"><span class="sw" style="background:' + b.color + '"></span>' + bucketLabel(b.key) + "</div>" +
        '<div class="pf-track"><i style="width:' + width.toFixed(2) + "%;background:" + b.color + '"></i></div>' +
        '<div class="pf-meta"><b>' + formatPct(b.pct) + "</b> · " + formatEok(b.value) +
          ' <span class="tgt">목표 ' + round1(b.target || 0) + "%</span></div></div>";
    }).join("");
    return '<div class="pf-block">' +
      '<div class="pf-top"><div class="donut-wrap">' + renderDonut(out.buckets, out.total) + '</div><div class="pf-bars">' + rows + "</div></div>" +
      '<div class="pf-note">막대를 누르면 버킷 구성 종목을 확인할 수 있습니다. 버킷색=카테고리(등락색과 무관).</div>' +
    "</div>";
  }

  function bucketItems(out, key) {
    return out.items.filter(function (item) { return item.bucket === key; });
  }

  function axisItems(out, axis) {
    var stocks = out.items.filter(function (item) { return item.kind === "stock"; });
    if (axis === "region") return stocks;
    if (axis === "ai_umbrella") return stocks.filter(isAiHolding);
    if (axis === "semi") return stocks.filter(isSemiHolding);
    return [];
  }

  function vtableHTML(rows, total, options) {
    options = options || {};
    var sorted = rows.slice().sort(function (a, b) { return b.value - a.value; });
    var sum = sorted.reduce(function (acc, item) { return acc + item.value; }, 0);
    var body = sorted.map(function (item) {
      var pct = total ? item.value / total * 100 : 0;
      var pnl = item.pnlPct == null
        ? '<span class="vacc">—</span>'
        : '<span class="' + pctClass(item.pnlPct) + '">' + formatSignedPct(item.pnlPct) + "</span>";
      return "<tr><td>" + esc(item.name) + "</td>" +
        (options.showBucket ? "<td>" + esc(item.bucket || "—") + "</td>" : "") +
        "<td>" + formatEok(item.value) + "</td><td>" + formatPct(pct) + "</td>" +
        (options.showPnl ? "<td>" + pnl + "</td>" : "") +
        "</tr>";
    }).join("");
    var head = "<thead><tr><th>종목</th>" +
      (options.showBucket ? "<th>분류</th>" : "") +
      "<th>평가액</th><th>총액%</th>" +
      (options.showPnl ? "<th>수익률</th>" : "") +
      "</tr></thead>";
    var footPct = total ? sum / total * 100 : 0;
    var foot = "<tfoot><tr><td>합계</td>" +
      (options.showBucket ? "<td></td>" : "") +
      "<td>" + formatEok(sum) + "</td><td>" + formatPct(footPct) + "</td>" +
      (options.showPnl ? "<td></td>" : "") +
      "</tr></tfoot>";
    return '<table class="vtable">' + head + "<tbody>" + body + "</tbody>" + foot + "</table>";
  }

  function modalShell(titleHTML, sub, body, footnote) {
    return '<div class="vmodal-head">' +
        '<div><div class="vt" id="vmodalTitle">' + titleHTML + '</div><div class="vsub">' + sub + "</div></div>" +
        '<button class="vmodal-x" id="vmodalClose" type="button" aria-label="닫기">×</button></div>' +
      '<div class="vmodal-body">' + body + '<div class="vmodal-fn">' + footnote + "</div></div>";
  }

  function bucketModalHTML(key, out) {
    var bucket = out.buckets.find(function (b) { return b.key === key; }) || { color: "#8b95a1", pct: 0, value: 0 };
    var items = bucketItems(out, key);
    var sub = formatPct(bucket.pct) + " · " + formatEok(bucket.value);
    var body;
    if (!items.length) {
      body = key === "현금"
        ? '<div class="vmodal-empty">원화·달러 현금은 개별 종목 표 없이 합산됩니다.</div>'
        : '<div class="vmodal-empty">이 버킷에 해당하는 종목이 없습니다.</div>';
    } else {
      body = vtableHTML(items, out.total, { showPnl: true });
    }
    var title = '<span class="vsw" style="background:' + bucket.color + '"></span>' + bucketLabel(key);
    var note = "평가액은 입력한 현재가·환율 기준입니다. 분류는 상품 기준이며 계좌와 무관합니다.";
    return modalShell(title, sub, body, note);
  }

  function axisModalHTML(axis, out) {
    var items = axisItems(out, axis);
    var labels = {
      region: "국장 : 미장",
      ai_umbrella: "AI 익스포저 (반도체 포함)",
      semi: "반도체 노출 (AI 우산의 부분집합)"
    };
    var subMap = {
      region: "국장 " + formatPct(out.regionKrPct) + " · 미장 " + formatPct(out.regionUsPct),
      ai_umbrella: formatPct(out.aiPct) + " · " + formatEok(out.aiValue),
      semi: formatPct(out.semiPct) + " · " + formatEok(out.semiValue)
    };
    var body = items.length
      ? vtableHTML(items, out.total, { showBucket: axis === "region" })
      : '<div class="vmodal-empty">해당 축에 잡히는 종목이 없습니다.</div>';
    var note = axis === "semi"
      ? "반도체는 AI 우산의 부분집합입니다. 두 값을 더하지 마세요."
      : "종목명·티커 기반 추정치입니다. ETF 속성은 반영되지 않을 수 있습니다.";
    return modalShell("📊 " + (labels[axis] || axis), subMap[axis] || "", body, note);
  }

  function openVModal(html) {
    var modal = document.getElementById("vmodal");
    var box = document.getElementById("vmodalBox");
    if (!modal || !box) return;
    box.innerHTML = html;
    modal.hidden = false;
    modal.classList.add("on");
    var closeBtn = document.getElementById("vmodalClose");
    if (closeBtn) closeBtn.addEventListener("click", closeVModal);
  }

  function closeVModal() {
    var modal = document.getElementById("vmodal");
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove("on");
  }

  function regionColor(region) {
    return REGION_COLORS[region] || "#8b95a1";
  }

  function renderAnalyzeHome(out) {
    var growthPill = function (label, value, title) {
      var cls = value == null || !isFinite(value) ? " is-empty" : "";
      var valueHtml = value == null || !isFinite(value)
        ? "—"
        : '<b class="' + pctClass(value) + '">' + formatSignedPct(value) + "</b>";
      return '<div class="tx-growth-i' + cls + '"' +
        (title ? ' title="' + esc(title) + '"' : "") +
        "><span>" + label + "</span>" + valueHtml + "</div>";
    };
    var stockCount = out.items.filter(function (item) { return item.kind === "stock"; }).length;
    var pnl = out.pnl;
    var pnlLine = pnl.amount == null
      ? '<div class="tx-pnl is-empty">평단을 입력하면 평가손익이 보입니다</div>'
      : '<div class="tx-pnl"><span>평가손익</span><b class="' + pctClass(pnl.amount) + '">' +
        formatSignedWon(pnl.amount) + "</b><em class=\"" + pctClass(pnl.pct) + '">' +
        formatSignedPct(pnl.pct) + "</em>" +
        (pnl.missing ? '<i>평단 미입력 ' + pnl.missing + "종목 제외</i>" : "") +
        "</div>";
    var tick = out.buckets.map(function (b) {
      var scored = out.total > 0 && b.diff != null;
      var verdict = !scored ? "목표 " + round1(b.target || 0) + "%"
        : (b.off ? (b.diff > 0 ? "과다" : "부족") : "정상");
      var gap = !scored ? "" : " " + (b.diff > 0 ? "+" : "−") +
        Math.abs(round1(b.diff)).toFixed(1) + "%p";
      return '<button type="button" class="tx-tick-i' + (scored && b.off ? (b.diff > 0 ? " hi" : " lo") : "") +
        '" data-drill="bucket" data-key="' + b.key + '">' +
        '<div class="tx-tick-k"><span class="sw" style="background:' + b.color + '"></span>' +
          bucketLabel(b.key) + "</div>" +
        '<div class="tx-tick-v">' + (out.total ? formatPct(b.pct) : "—") + "</div>" +
        '<div class="tx-tick-s">' + verdict + gap + "</div>" +
      "</button>";
    }).join("");
    return '<div class="card tx-home">' +
      '<div class="tx-hero">' +
        '<div class="tx-hero-l">' +
          '<div class="tx-hero-k">총 평가액</div>' +
          '<div class="tx-hero-v">' + (out.total ? formatEok(out.total) : "0원") + "</div>" +
          '<div class="tx-hero-s">' + (out.total ? formatWon(out.total) + " · 주식 · 현금 포함" : "종목을 입력하세요") + "</div>" +
          pnlLine +
          '<div class="tx-growth">' +
            growthPill("YTD", out.returns.ytd, "전년도 말 평가액 기준") +
            growthPill("YOY", out.returns.yoy, "1년 전 평가액 기준") +
            '<span class="tx-growth-basis">기준금액 입력 시 표시</span>' +
          "</div>" +
        "</div>" +
        '<div class="tx-hero-r">' +
          '<div class="tx-hero-stat"><span>종목</span><b>' + stockCount + "</b></div>" +
          '<div class="tx-hero-stat"><span>버킷</span><b>4</b></div>' +
        "</div>" +
      "</div>" +
      '<div class="tx-tick tx-tick-4">' + tick + "</div>" +
      '<div class="tx-foot">분류는 상품 기준입니다. 섹터·테마 ETF와 레버리지는 개별종목으로 봅니다. 칸을 누르면 구성 종목을 볼 수 있습니다.</div>' +
    "</div>";
  }

  // 목표 배분 vs 현재 — 눈금이 목표, 막대가 현재. ±5%p를 넘으면 과다·부족.
  function renderAllocationCompare(out) {
    if (!out.total) return '<div class="empty">분석할 자산이 없습니다</div>';
    var scale = Math.ceil(Math.max.apply(null, out.buckets.map(function (b) {
      return Math.max(b.pct, b.target || 0);
    })) / 5) * 5 + 5;
    var rows = out.buckets.map(function (b) {
      var goal = b.target || 0;
      var cls = b.off ? (b.diff > 0 ? "hi" : "lo") : "ok";
      var verdict = b.off ? (b.diff > 0 ? "과다" : "부족") : "정상";
      return '<div class="ac-row">' +
        '<div class="ac-nm"><span class="sw" style="background:' + b.color + '"></span>' + bucketLabel(b.key) + "</div>" +
        '<div class="ac-track">' +
          '<i class="ac-fill" style="width:' + Math.min(b.pct / scale * 100, 100).toFixed(1) +
            "%;background:" + b.color + '"></i>' +
          '<span class="ac-goalmark" style="left:' + Math.min(goal / scale * 100, 100).toFixed(1) +
            '%"><em>' + round1(goal) + "</em></span>" +
        "</div>" +
        '<div class="ac-now">' + formatPct(b.pct) + "</div>" +
        '<div class="ac-diff ' + cls + '">' + (b.diff > 0 ? "+" : "−") +
          Math.abs(round1(b.diff)).toFixed(1) + "%p<span>" + verdict + "</span></div>" +
      "</div>";
    }).join("");
    var moves = out.buckets.filter(function (b) { return b.off; }).map(function (b) {
      var action = b.gapKrw >= 0 ? "매수" : "매도";
      return '<li><b>' + b.key + "</b> " + formatWon(Math.abs(b.gapKrw)) + " " + action + "</li>";
    }).join("");
    var sum = out.buckets.reduce(function (acc, b) { return acc + (b.target || 0); }, 0);
    var sumWarn = Math.abs(sum - 100) > 0.05
      ? '<div class="ac-warn">목표 합이 ' + formatPct(sum) + "입니다. 100%로 맞추세요.</div>"
      : "";
    var plan = moves
      ? '<div class="ac-plan"><div class="ac-plan-k">목표까지 조정 금액</div><ul>' + moves + "</ul></div>"
      : '<div class="ac-plan is-ok">네 버킷 모두 목표 ±' + BUCKET_TOLERANCE + "%p 안입니다.</div>";
    return '<div class="ac-block">' +
      '<div class="ac-legend"><span><i class="ac-leg-cur"></i>현재 비중</span>' +
        '<span><i class="ac-leg-goal"></i>목표 위치</span>' +
        '<span class="ac-scale">눈금 0~' + scale + "%</span></div>" +
      rows + sumWarn + plan +
      '<div class="ac-note">조정 금액은 현재 총 평가액을 기준으로 목표 비중에 맞추는 데 필요한 차액입니다. 매매 지시가 아닙니다.</div>' +
    "</div>";
  }

  // 현금 관찰선 — 밴드 안에 있는지만 본다. 매수·매도 방아쇠가 아니다.
  function renderCashMonitor(out) {
    if (!out.total) return "";
    var band = out.cashBand;
    var pct = out.cashPct;
    var scale = Math.max(40, Math.ceil((Math.max(pct, band.max) + 5) / 10) * 10);
    var left = Math.max(0, Math.min(100, band.min / scale * 100));
    var width = Math.max(0, Math.min(100 - left, (band.max - band.min) / scale * 100));
    var mark = Math.max(0, Math.min(100, pct / scale * 100));
    var status = pct < band.min ? "하단 아래" : pct > band.max ? "상단 위" : "범위 안";
    return '<section class="card cash-monitor">' +
      '<h2>현금 비중 · 관찰선</h2>' +
      '<div class="cash-monitor-grid">' +
        '<article class="cash-monitor-card">' +
          '<div class="cash-monitor-head"><span>전체 현금</span><em class="' +
            (status === "범위 안" ? "" : "off") + '">' + status + "</em></div>" +
          '<div class="cash-monitor-value"><strong>' + round1(pct).toFixed(1) + "<small>%</small></strong>" +
            "<span>" + formatEok(out.cash) + " / " + formatEok(out.total) + "</span></div>" +
          '<div class="cash-monitor-bar"><i style="left:' + left.toFixed(1) + "%;width:" + width.toFixed(1) +
            '%"></i><b style="left:' + mark.toFixed(1) + '%"></b></div>' +
          '<div class="cash-monitor-scale"><span>0</span><span>관찰 ' + round1(band.min) + "–" + round1(band.max) +
            "%</span><span>" + scale + "%</span></div>" +
          '<p>원화·달러 현금 합산 · 총 평가액 대비</p>' +
        "</article>" +
      "</div>" +
      '<div class="cm-note">두 구간은 상태를 보기 위한 관찰선입니다. 매수·매도 방아쇠는 아니며, 리밸런싱 판단은 4버킷 목표만 사용합니다.</div>' +
    "</section>";
  }

  function renderStockWeights(out) {
    var stocks = out.items.filter(function (item) {
      return item.kind === "stock" && item.bucket !== "현금" && item.bucket !== "크립토";
    });
    if (!stocks.length || !out.total) {
      return '<div class="empty">표시할 종목이 없습니다</div>';
    }
    var grouped = {};
    stocks.forEach(function (item) {
      var key = stockGroupName(item);
      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          bucket: item.bucket,
          value: 0,
          members: [],
          pnl: 0,
          cost: 0,
          hasPnl: true
        };
      }
      var g = grouped[key];
      g.value += item.value;
      if (g.members.indexOf(item.name) < 0) g.members.push(item.name);
      if (item.pnl == null) g.hasPnl = false;
      else {
        g.pnl += item.pnl;
        g.cost += item.value - item.pnl;
      }
    });
    var all = Object.keys(grouped).map(function (key) {
      var g = grouped[key];
      g.pnlPct = g.hasPnl && g.cost > 0 ? g.pnl / g.cost * 100 : null;
      return g;
    }).sort(function (a, b) { return b.value - a.value; });
    var shown = all.slice(0, 10);
    var rest = all.slice(10);
    var max = shown[0].value || 1;
    var rows = shown.map(function (item, index) {
      var pct = item.value / out.total * 100;
      var col = BUCKET_COLORS[item.bucket] || regionColor("kr");
      var memberTip = item.members.length > 1 ? ' title="' + esc("포함: " + item.members.join(" · ")) + '"' : "";
      var pnlChip = item.pnlPct == null
        ? '<span class="sw-pnl is-empty">평단 없음</span>'
        : '<span class="sw-pnl ' + pctClass(item.pnlPct) + '">' + formatSignedPct(item.pnlPct) + "</span>";
      return '<div class="sw-row"' + memberTip + ">" +
        '<div class="sw-rank">' + (index + 1) + "</div>" +
        '<div class="sw-main">' +
          '<div class="sw-top">' +
            '<div class="sw-name"><span class="sw-dot" style="background:' + col + '"></span>' +
              esc(item.name) + (item.members.length > 1 ? '<span class="sw-etf">합산</span>' : "") + "</div>" +
            '<div class="sw-value"><b>' + formatEok(item.value) + "</b><span>" + formatPct(pct) + "</span></div>" +
          "</div>" +
          '<div class="sw-track"><i style="width:' + (item.value / max * 100).toFixed(1) +
            "%;background:" + col + '"></i></div>' +
          '<div class="sw-sub"><span class="sw-bucket">' + bucketLabel(item.bucket) + "</span>" + pnlChip + "</div>" +
        "</div>" +
      "</div>";
    }).join("");
    var restValue = rest.reduce(function (sum, item) { return sum + item.value; }, 0);
    var restRow = rest.length
      ? '<div class="sw-rest"><span>그 외 ' + rest.length + "종목</span><span><b>" +
        formatEok(restValue) + "</b> · " + formatPct(restValue / out.total * 100) + "</span></div>"
      : "";
    return '<div class="sw-block">' +
      '<div class="sw-head"><span>상위 10종목</span><span>동일 종목·동일 지수 ETF 합산 · 순자산 비중</span></div>' +
      '<div class="sw-conc">상위 3종목 <b>' + formatPct(out.top3Pct) + "</b> · 최대 종목 <b>" +
        formatPct(all[0].value / out.total * 100) + "</b></div>" +
      '<div class="sw-grid">' + rows + "</div>" + restRow +
    "</div>";
  }

  function renderExposureBlock(out) {
    if (!out.total) return '<div class="empty">분석할 자산이 없습니다</div>';
    var region =
      '<button type="button" class="ex2-card" data-drill="axis" data-axis="region">' +
        '<div class="ex2-k">지역 노출<span>구성 ›</span></div>' +
        '<div class="ex2-region">' +
          '<div><span>국장</span><b>' + formatPct(out.regionKrPct) + "</b></div>" +
          '<div><span>미장</span><b>' + formatPct(out.regionUsPct) + "</b></div>" +
        "</div>" +
        '<div class="ex2-dual"><i style="width:' + out.regionKrPct +
          '%"></i><em style="width:' + out.regionUsPct + '%"></em></div>' +
      "</button>";
    var metric = function (label, pct, value, color, foot, axis) {
      return '<button type="button" class="ex2-card" data-drill="axis" data-axis="' + axis + '">' +
        '<div class="ex2-k">' + label + '<span>구성 ›</span></div>' +
        '<div class="ex2-v">' + formatPct(pct) + "</div>" +
        '<div class="ex2-sub">' + formatEok(value) + " · 총 평가액 기준</div>" +
        '<div class="ex2-track"><i style="width:' + Math.min(pct, 100) + "%;background:" + color + '"></i></div>' +
        (foot ? '<div class="ex2-foot">' + foot + "</div>" : "") +
      "</button>";
    };
    return '<div class="ex2-block">' +
      '<div class="ex2-grid">' +
        region +
        metric("AI 우산", out.aiPct, out.aiValue, "#6b5ce7", "반도체 포함 · 종목명·티커 추정", "ai_umbrella") +
        metric("반도체", out.semiPct, out.semiValue, "#0F8A92", "AI 우산에 이미 포함", "semi") +
      "</div>" +
      '<div class="ex2-note">AI 우산과 반도체는 더하지 않습니다. 카드를 누르면 종목별 근거를 확인할 수 있습니다.</div>' +
    "</div>";
  }

  function renderBenchmarkBlock(out) {
    var portfolioYtd = out.returns.ytd;
    var portfolioYoy = out.returns.yoy;
    var row = function (name, sub, ytd, yoy, home) {
      return '<div class="bm2-row' + (home ? " home" : "") + '">' +
        '<div class="bm2-name"><b>' + esc(name) + "</b><span>" + esc(sub) + "</span></div>" +
        '<b class="bm2-num ' + pctClass(ytd) + '">' + formatSignedPct(ytd) + "</b>" +
        '<b class="bm2-num ' + pctClass(yoy) + '">' + formatSignedPct(yoy) + "</b></div>";
    };
    var gap = "";
    if (portfolioYtd != null && BENCHMARKS.ytd.sp500 != null) {
      var diff = portfolioYtd - BENCHMARKS.ytd.sp500;
      gap = '<div class="bm2-gap">YTD 격차 <b class="' + pctClass(diff) + '">' +
        (diff >= 0 ? "+" : "−") + Math.abs(round1(diff)).toFixed(1) + "%p</b></div>";
    }
    return '<div class="card"><details class="perf-card" open>' +
      '<summary>벤치마크 — 내 포트폴리오 vs S&amp;P 500<span class="perf-sm-tag">' +
        esc(BENCHMARKS.asOf) + " 기준</span></summary>" +
      '<div class="perf-body bm2">' +
        '<div class="bm2-head"><span></span><b>YTD</b><b>YOY</b></div>' +
        '<div class="bm2-table">' +
          row("내 포트폴리오", "기준금액 · 순입금 반영", portfolioYtd, portfolioYoy, true) +
          row("S&P 500", "원화 환산 · 배당 제외", BENCHMARKS.ytd.sp500, BENCHMARKS.yoy.sp500, false) +
        "</div>" + gap +
        '<div class="bm2-note">둘 다 원화 기준입니다. 내 포트폴리오가 —이면 종목 관리에서 기간 시작 평가액을 입력하세요.</div>' +
      "</div></details></div>";
  }

  function bindAnalyzeEvents() {
    var root = document.getElementById("analyzeRoot");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";
    root.addEventListener("click", function (event) {
      var target = event.target.closest("[data-drill]");
      if (!target) return;
      var out = compute(state);
      var drill = target.getAttribute("data-drill");
      if (drill === "bucket") openVModal(bucketModalHTML(target.getAttribute("data-key"), out));
      else if (drill === "axis") openVModal(axisModalHTML(target.getAttribute("data-axis"), out));
    });
    var modal = document.getElementById("vmodal");
    if (modal) {
      modal.addEventListener("click", function (event) {
        if (event.target === modal) closeVModal();
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeVModal();
    });
  }

  function renderAnalyze() {
    var out = compute(state);
    document.getElementById("analyzeRoot").innerHTML =
      renderAnalyzeHome(out) +
      renderCashMonitor(out) +
      foldCard("포트폴리오 비중 — 4버킷 (큰그림)", renderPortfolioWeight(out), true) +
      foldCard("목표 배분 vs 현재", renderAllocationCompare(out), true) +
      foldCard("종목 비중", renderStockWeights(out), true) +
      foldCard("익스포저 — 국장·미장 · AI 우산", renderExposureBlock(out), true) +
      renderBenchmarkBlock(out);
    bindAnalyzeEvents();
  }

  function findHolding(id) {
    return state.holdings.find(function (h) { return h.id === id; });
  }

  function updateHolding(holding, field, raw) {
    if (field === "name") holding.name = String(raw);
    else if (field === "ticker") holding.ticker = String(raw).trim().toUpperCase();
    else if (field === "currency") holding.currency = normalizeCurrency(raw);
    else if (field === "bucket") holding.bucket = normalizeBucket(raw);
    else if (field === "avgPrice") holding.avgPrice = nullablePositive(raw);
    else holding[field] = positiveOrZero(raw);
  }

  function mergeImported(parsed) {
    state.holdings = parsed.holdings;
    if (parsed.fx != null) state.fx = parsed.fx;
    if (parsed.cashKrw != null) state.cashKrw = parsed.cashKrw;
    else if (parsed.cash != null) state.cashKrw = parsed.cash;
    if (parsed.cashUsd != null) state.cashUsd = parsed.cashUsd;
    if (parsed.performance) state.performance = normalizePerformance(parsed.performance);
    if (parsed.targets) state.targets = normalizeTargets(parsed.targets);
    if (parsed.cashBand) state.cashBand = normalizeCashBand(parsed.cashBand);
    saveState();
    renderSheet();
  }

  document.querySelector(".tabs").addEventListener("click", function (event) {
    var button = event.target.closest("[data-tab]");
    if (button) setTab(button.getAttribute("data-tab"));
  });

  document.getElementById("sheetBody").addEventListener("input", function (event) {
    var field = event.target.closest("[data-field]");
    var row = event.target.closest("tr[data-id]");
    if (!field || !row) return;
    var holding = findHolding(row.getAttribute("data-id"));
    if (!holding) return;
    updateHolding(holding, field.getAttribute("data-field"), field.value);
    saveState();
  });

  document.getElementById("sheetBody").addEventListener("change", function (event) {
    var field = event.target.closest("select[data-field]");
    var row = event.target.closest("tr[data-id]");
    if (!field || !row) return;
    var holding = findHolding(row.getAttribute("data-id"));
    if (!holding) return;
    updateHolding(holding, field.getAttribute("data-field"), field.value);
    saveState();
  });

  document.getElementById("sheetBody").addEventListener("click", function (event) {
    var button = event.target.closest("[data-del]");
    if (!button) return;
    state.holdings = state.holdings.filter(function (h) {
      return h.id !== button.getAttribute("data-del");
    });
    saveState();
    renderSheet();
  });

  document.getElementById("sheetBody").addEventListener("paste", function (event) {
    var text = event.clipboardData ? event.clipboardData.getData("text") : "";
    if (!text || (text.indexOf("\t") < 0 && text.indexOf("\n") < 0)) return;
    event.preventDefault();
    try {
      mergeImported(parseBulk(text));
      document.getElementById("bulkErr").textContent = "";
    } catch (error) {
      document.getElementById("bulkErr").textContent = error.message;
    }
  });

  document.getElementById("addRow").addEventListener("click", function () {
    state.holdings.push(emptyHolding());
    saveState();
    renderSheet();
    var last = document.querySelector("#sheetBody tr:last-child input");
    if (last) last.focus();
  });

  ["fx", "cashKrw", "cashUsd"].forEach(function (key) {
    document.getElementById(key).addEventListener("input", function (event) {
      state[key] = positiveOrZero(event.target.value);
      saveState();
    });
  });

  document.querySelectorAll("[data-performance]").forEach(function (input) {
    input.addEventListener("input", function (event) {
      var key = event.target.getAttribute("data-performance");
      state.performance[key] = key.indexOf("Value") >= 0
        ? nullablePositive(event.target.value)
        : nullableNumber(event.target.value) || 0;
      saveState();
    });
  });

  document.querySelectorAll("[data-target]").forEach(function (input) {
    input.addEventListener("input", function (event) {
      var key = event.target.getAttribute("data-target");
      var value = nullableNumber(event.target.value);
      state.targets[key] = value == null || value < 0 ? 0 : round1(value);
      saveState();
      renderTargetInputs();
    });
  });

  document.querySelectorAll("[data-band]").forEach(function (input) {
    input.addEventListener("change", function () {
      var next = {};
      document.querySelectorAll("[data-band]").forEach(function (field) {
        next[field.getAttribute("data-band")] = field.value;
      });
      state.cashBand = normalizeCashBand(next);
      saveState();
      renderTargetInputs();
    });
  });

  document.getElementById("applyBulk").addEventListener("click", function () {
    var errorBox = document.getElementById("bulkErr");
    errorBox.textContent = "";
    try {
      var parsed = parseBulk(document.getElementById("bulk").value);
      if (!parsed.holdings.length) throw new Error("종목 행을 읽지 못했습니다.");
      mergeImported(parsed);
    } catch (error) {
      errorBox.textContent = error.message || "형식을 확인하세요.";
    }
  });

  document.getElementById("copyJson").addEventListener("click", function () {
    var text = exportJson();
    document.getElementById("bulk").value = text;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
  });

  renderSheet();
  setTab(currentTab);
  bindAnalyzeEvents();

  window.__portfolioLens = {
    compute: compute,
    parseBulk: parseBulk,
    aggregateHoldings: aggregateHoldings,
    portfolioReturn: portfolioReturn,
    regionOf: regionOf,
    autoBucket: autoBucket,
    bucketOf: bucketOf
  };
})();
