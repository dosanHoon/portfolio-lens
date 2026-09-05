(function () {
  var STORAGE_KEY = "portfolio-lens-v3";
  var OLD_STORAGE_KEY = "portfolio-lens-v1";
  var TAB_KEY = "portfolio-lens-tab";
  var COLORS = [
    "#3182f6", "#6b5ce7", "#00a8a8", "#f59f00", "#f04452",
    "#00a661", "#8b5cf6", "#ff7a00", "#4c6ef5", "#e64980",
    "#12b886", "#868e96"
  ];
  var BENCHMARKS = {
    asOf: "2026-09-04",
    ytd: { sp500: 5.9, kospi: 58.7 },
    yoy: { sp500: 15.1, kospi: 108.9 }
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
    performance: defaultPerformance()
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
      avgPrice: nullablePositive(raw.avgPrice)
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

  function normalizeState(raw, preserveOldKrw) {
    var source = raw || {};
    return {
      fx: positiveOrZero(source.fx) || 1400,
      cashKrw: positiveOrZero(source.cashKrw != null ? source.cashKrw : source.cash),
      cashUsd: positiveOrZero(source.cashUsd),
      holdings: Array.isArray(source.holdings)
        ? source.holdings.map(function (h) { return normalizeHolding(h, preserveOldKrw); })
        : [],
      performance: normalizePerformance(source.performance)
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

  function formatPct(value) {
    return value == null || !isFinite(value) ? "—" : round1(value).toFixed(1) + "%";
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function regionOf(ticker) {
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
          region: regionOf(ticker),
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
        region: "neutral", kind: "cash", pnl: null, pnlPct: null
      });
    }
    if (cashUsdKrw > 0) {
      items.push({
        id: "cash-usd", name: "달러 현금", ticker: "USD",
        currency: "USD", shares: input.cashUsd, value: cashUsdKrw,
        region: "neutral", kind: "cash", pnl: null, pnlPct: null
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
    var performance = input.performance || defaultPerformance();

    return {
      items: items,
      total: total,
      kr: kr,
      us: us,
      cash: cash,
      cashKrw: cashKrw,
      cashUsd: input.cashUsd || 0,
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
            avgPrice: cols[map.avgPrice]
          }
        : {
            name: cols[0], ticker: cols[1], shares: cols[2],
            currency: cols[3], price: cols[4], avgPrice: cols[5]
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
          currency: h.currency, price: h.price, avgPrice: h.avgPrice
        };
      }),
      fx: state.fx,
      cashKrw: state.cashKrw,
      cashUsd: state.cashUsd,
      performance: state.performance
    }, null, 2);
  }

  var state = loadState();
  var currentTab = localStorage.getItem(TAB_KEY) === "analyze" ? "analyze" : "manage";
  var allocationChart = null;

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

  function renderSheet() {
    var body = document.getElementById("sheetBody");
    if (!state.holdings.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty">행을 추가하거나 JSON·엑셀을 붙여넣으세요</td></tr>';
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
          '<td><button class="ghost" type="button" data-del="' + esc(h.id) + '">삭제</button></td>' +
          "</tr>";
      }).join("");
    }
    document.getElementById("fx").value = state.fx || "";
    document.getElementById("cashKrw").value = state.cashKrw || "";
    document.getElementById("cashUsd").value = state.cashUsd || "";
    renderPerformanceInputs();
  }

  function renderPerformanceInputs() {
    ["yearEndValue", "ytdNetFlow", "yearAgoValue", "yoyNetFlow"].forEach(function (key) {
      var input = document.querySelector('[data-performance="' + key + '"]');
      input.value = state.performance[key] == null ? "" : state.performance[key];
    });
  }

  function chartItems(items) {
    if (items.length <= 10) return items.map(function (item) {
      return { name: item.name, value: item.value, weight: item.weight };
    });
    var top = items.slice(0, 9).map(function (item) {
      return { name: item.name, value: item.value, weight: item.weight };
    });
    var rest = items.slice(9).reduce(function (sum, item) { return sum + item.value; }, 0);
    var total = items.reduce(function (sum, item) { return sum + item.value; }, 0);
    top.push({
      name: "기타",
      value: rest,
      weight: total ? rest / total * 100 : 0,
      details: items.slice(9).map(function (item) {
        return { name: item.name, weight: item.weight };
      })
    });
    return top;
  }

  function renderPie(items) {
    var pie = document.getElementById("pie");
    var canvas = document.getElementById("allocationChart");
    var legend = document.getElementById("pieLegend");
    if (allocationChart) {
      allocationChart.destroy();
      allocationChart = null;
    }
    if (!items.length) {
      pie.classList.add("is-empty");
      canvas.hidden = true;
      legend.innerHTML = '<div class="empty">표시할 종목이 없습니다</div>';
      return;
    }
    pie.classList.remove("is-empty");
    canvas.hidden = false;
    var shown = chartItems(items);
    canvas.setAttribute("aria-label", shown.map(function (item) {
      return item.name + " " + formatPct(item.weight);
    }).join(", "));
    if (typeof Chart === "undefined") {
      legend.innerHTML = '<div class="empty">차트 라이브러리를 불러오지 못했습니다</div>';
      return;
    }
    allocationChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: shown.map(function (item) { return item.name; }),
        datasets: [{
          data: shown.map(function (item) { return item.value; }),
          backgroundColor: shown.map(function (_, index) {
            return COLORS[index % COLORS.length];
          }),
          borderColor: "#ffffff",
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.label + " " + formatPct(shown[context.dataIndex].weight);
              },
              afterBody: function (contexts) {
                if (!contexts.length) return [];
                var details = shown[contexts[0].dataIndex].details;
                if (!details || !details.length) return [];
                return ["", "포함 종목"].concat(details.map(function (item) {
                  return item.name + " " + formatPct(item.weight);
                }));
              }
            }
          }
        }
      }
    });
    legend.innerHTML = shown.map(function (item, index) {
      return '<div class="legend-row"><span class="legend-dot" style="background:' +
        COLORS[index % COLORS.length] + '"></span><span class="legend-name">' +
        esc(item.name) + '</span><b>' + formatPct(item.weight) + "</b></div>";
    }).join("");
  }

  function renderPerformanceCard(period, portfolioValue, benchmarks) {
    var values = [
      { key: "portfolio", label: "내 포트폴리오", value: portfolioValue },
      { key: "sp500", label: "S&P 500", value: benchmarks.sp500 },
      { key: "kospi", label: "코스피", value: benchmarks.kospi }
    ];
    var available = values.filter(function (item) { return item.value != null && isFinite(item.value); });
    if (!available.length) {
      return '<article class="perf-card"><div class="perf-title">' + period +
        '</div><div class="perf-empty">종목 관리에서 기준금액과 벤치마크를 입력하세요.</div></article>';
    }
    var maxAbs = Math.max.apply(null, available.map(function (item) {
      return Math.abs(item.value);
    }).concat([1]));
    var rows = values.map(function (item) {
      var hasValue = item.value != null && isFinite(item.value);
      var width = hasValue ? Math.min(50, Math.abs(item.value) / maxAbs * 50) : 0;
      var left = !hasValue ? 50 : item.value >= 0 ? 50 : 50 - width;
      var cls = item.key === "portfolio" ? " portfolio" : "";
      if (hasValue && item.value < 0) cls += " negative";
      return '<div class="perf-row"><div class="perf-label"><span>' + item.label +
        '</span><b>' + formatPct(item.value) + '</b></div><div class="perf-track">' +
        '<span class="perf-mid"></span><span class="perf-bar' + cls +
        '" style="left:' + left + "%;width:" + width + '%"></span></div></div>';
    }).join("");
    return '<article class="perf-card"><div class="perf-title">' + period + "</div>" + rows + "</article>";
  }

  function renderAnalyze() {
    var out = compute(state);
    document.getElementById("total").textContent = formatWon(out.total);
    document.getElementById("krPct").textContent = out.total ? formatPct(out.krPct) : "—";
    document.getElementById("usPct").textContent = out.total ? formatPct(out.usPct) : "—";
    document.getElementById("cashPct").textContent = out.total ? formatPct(out.cashPct) : "—";
    document.getElementById("krSub").textContent = out.total ? formatWon(out.kr) : "";
    document.getElementById("usSub").textContent = out.total ? formatWon(out.us) : "";
    document.getElementById("cashSub").textContent = out.total
      ? formatWon(out.cashKrw) + " · $" + round1(out.cashUsd).toLocaleString("ko-KR")
      : "";

    document.getElementById("performance").innerHTML =
      renderPerformanceCard("YTD", out.returns.ytd, BENCHMARKS.ytd) +
      renderPerformanceCard("YOY", out.returns.yoy, BENCHMARKS.yoy);

    renderPie(out.items);
    var box = document.getElementById("weights");
    if (!out.items.length) {
      box.innerHTML = '<div class="empty">완성된 종목이 없습니다.</div>';
      return;
    }
    box.innerHTML = out.items.map(function (item) {
      var pnl = "";
      if (item.pnl != null) {
        var sign = item.pnl > 0 ? "+" : "";
        var cls = item.pnl > 0 ? "up" : item.pnl < 0 ? "down" : "";
        pnl = ' · <span class="pnl ' + cls + '">' + sign +
          formatWon(item.pnl) + " · " + sign + formatPct(item.pnlPct) + "</span>";
      }
      var detail = item.kind === "stock"
        ? round1(item.shares).toLocaleString("ko-KR") + "주 · " + item.currency
        : item.ticker;
      return '<div class="row"><div class="row-top"><div><span class="row-name">' +
        esc(item.name) + '</span><span class="row-ticker">' + esc(detail) +
        '</span></div><div class="row-weight">' + formatPct(item.weight) +
        '</div></div><div class="bar"><span style="width:' +
        Math.min(100, item.weight) + '%"></span></div><div class="row-meta">' +
        formatWon(item.value) + pnl + "</div></div>";
    }).join("");
  }

  function findHolding(id) {
    return state.holdings.find(function (h) { return h.id === id; });
  }

  function updateHolding(holding, field, raw) {
    if (field === "name") holding.name = String(raw);
    else if (field === "ticker") holding.ticker = String(raw).trim().toUpperCase();
    else if (field === "currency") holding.currency = normalizeCurrency(raw);
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

  window.__portfolioLens = {
    compute: compute,
    parseBulk: parseBulk,
    aggregateHoldings: aggregateHoldings,
    portfolioReturn: portfolioReturn,
    regionOf: regionOf
  };
})();
