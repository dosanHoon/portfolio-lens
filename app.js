(function () {
  var STORAGE_KEY = "portfolio-lens-v1";

  var SAMPLE = {
    holdings: [
      { id: "s1", name: "삼성전자", ticker: "005930", shares: 100, price: 80000, avgPrice: 70000 },
      { id: "s2", name: "QQQ", ticker: "QQQ", shares: 20, price: 500000, avgPrice: 450000 },
      { id: "s3", name: "NVDA", ticker: "NVDA", shares: 8, price: 1500000, avgPrice: 1200000 },
    ],
    cash: 0,
  };

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function regionOf(ticker) {
    var t = String(ticker || "").trim().toUpperCase();
    var bare = t.replace(/\.(KS|KQ)$/, "");
    if (/^\d{6}$/.test(bare) || /\.(KS|KQ)$/.test(t)) return "kr";
    return "us";
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(SAMPLE));
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.holdings)) return JSON.parse(JSON.stringify(SAMPLE));
      return {
        holdings: parsed.holdings,
        cash: typeof parsed.cash === "number" && isFinite(parsed.cash) ? parsed.cash : 0,
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(SAMPLE));
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function parseNum(v) {
    if (v == null || String(v).trim() === "") return null;
    var n = Number(String(v).replace(/,/g, ""));
    return isFinite(n) ? n : NaN;
  }

  function formatWon(n) {
    return Math.round(n).toLocaleString("ko-KR") + "원";
  }

  function formatPct(n) {
    return round1(n).toFixed(1) + "%";
  }

  function holdingValue(h) {
    return h.shares * h.price;
  }

  function compute(state) {
    var items = state.holdings.map(function (h) {
      return {
        id: h.id,
        name: h.name,
        ticker: h.ticker,
        shares: h.shares,
        price: h.price,
        avgPrice: h.avgPrice,
        value: holdingValue(h),
        region: regionOf(h.ticker),
        kind: "stock",
      };
    });
    if (state.cash > 0) {
      items.push({
        id: "cash",
        name: "현금",
        ticker: "",
        shares: 1,
        price: state.cash,
        avgPrice: null,
        value: state.cash,
        region: "neutral",
        kind: "cash",
      });
    }
    var total = items.reduce(function (a, it) {
      return a + it.value;
    }, 0);
    items.forEach(function (it) {
      it.weight = total ? (it.value / total) * 100 : 0;
    });
    var kr = items.reduce(function (a, it) {
      return a + (it.region === "kr" ? it.value : 0);
    }, 0);
    var us = items.reduce(function (a, it) {
      return a + (it.region === "us" ? it.value : 0);
    }, 0);
    var neu = items.reduce(function (a, it) {
      return a + (it.region === "neutral" ? it.value : 0);
    }, 0);
    return {
      items: items,
      total: total,
      kr: kr,
      us: us,
      neu: neu,
      krPct: total ? (kr / total) * 100 : 0,
      usPct: total ? (us / total) * 100 : 0,
      neuPct: total ? (neu / total) * 100 : 0,
    };
  }

  function pnlOf(it) {
    if (it.kind === "cash") return null;
    if (it.avgPrice == null || !(it.avgPrice > 0)) return null;
    var pnl = (it.price - it.avgPrice) * it.shares;
    var pct = ((it.price - it.avgPrice) / it.avgPrice) * 100;
    return { pnl: pnl, pct: pct };
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var state = loadState();

  function render() {
    var out = compute(state);
    document.getElementById("total").textContent = formatWon(out.total);
    document.getElementById("krPct").textContent = out.total ? formatPct(out.krPct) : "—";
    document.getElementById("usPct").textContent = out.total ? formatPct(out.usPct) : "—";
    document.getElementById("krSub").textContent = out.total ? formatWon(out.kr) : "";
    document.getElementById("usSub").textContent = out.total ? formatWon(out.us) : "";

    var box = document.getElementById("weights");
    if (!out.items.length) {
      box.innerHTML = '<div class="empty">종목을 추가하면 비중이 표시됩니다</div>';
    } else {
      box.innerHTML = out.items
        .map(function (it) {
          var ticker = it.ticker ? '<span class="row-ticker">' + esc(it.ticker) + "</span>" : "";
          var pnl = pnlOf(it);
          var pnlHtml = "";
          if (pnl) {
            var sign = pnl.pnl > 0 ? "+" : "";
            var cls = pnl.pnl > 0 ? "up" : pnl.pnl < 0 ? "down" : "";
            pnlHtml =
              '<span class="pnl ' +
              cls +
              '">' +
              sign +
              formatWon(pnl.pnl) +
              " · " +
              sign +
              formatPct(pnl.pct) +
              "</span>";
          }
          var del =
            it.kind === "cash"
              ? ""
              : '<button class="ghost" type="button" data-del="' + esc(it.id) + '">삭제</button>';
          return (
            '<div class="row">' +
            '<div class="row-top">' +
            '<div><span class="row-name">' +
            esc(it.name) +
            "</span>" +
            ticker +
            "</div>" +
            '<div class="row-weight">' +
            formatPct(it.weight) +
            "</div>" +
            "</div>" +
            '<div class="bar"><span style="width:' +
            Math.min(100, it.weight) +
            '%"></span></div>' +
            '<div class="row-meta"><span>' +
            formatWon(it.value) +
            (pnlHtml ? " · " + pnlHtml : "") +
            "</span>" +
            del +
            "</div>" +
            "</div>"
          );
        })
        .join("");
    }

    document.getElementById("cash").value = state.cash ? String(state.cash) : "";
  }

  document.getElementById("weights").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-del]");
    if (!btn) return;
    var id = btn.getAttribute("data-del");
    state.holdings = state.holdings.filter(function (h) {
      return h.id !== id;
    });
    saveState(state);
    render();
  });

  document.getElementById("addForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("addErr");
    err.textContent = "";
    var name = document.getElementById("name").value.trim();
    var ticker = document.getElementById("ticker").value.trim();
    var shares = parseNum(document.getElementById("shares").value);
    var price = parseNum(document.getElementById("price").value);
    var avgRaw = document.getElementById("avg").value;
    var avg = String(avgRaw).trim() === "" ? null : parseNum(avgRaw);
    if (!name || !ticker) {
      err.textContent = "이름과 티커를 입력해 주세요.";
      return;
    }
    if (!(shares > 0) || !(price > 0)) {
      err.textContent = "수량과 현재가는 0보다 커야 합니다.";
      return;
    }
    if (avg != null && !(avg > 0)) {
      err.textContent = "평단은 비우거나 0보다 큰 숫자여야 합니다.";
      return;
    }
    state.holdings.push({
      id: uid(),
      name: name,
      ticker: ticker,
      shares: shares,
      price: price,
      avgPrice: avg,
    });
    saveState(state);
    e.target.reset();
    render();
  });

  document.getElementById("cashForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = document.getElementById("cashErr");
    err.textContent = "";
    var raw = document.getElementById("cash").value;
    var cash = String(raw).trim() === "" ? 0 : parseNum(raw);
    if (cash !== 0 && !(cash > 0)) {
      err.textContent = "현금은 0 이상이거나 비워 주세요.";
      return;
    }
    state.cash = cash;
    saveState(state);
    render();
  });

  render();

  window.__portfolioLens = { SAMPLE: SAMPLE, compute: compute, regionOf: regionOf, round1: round1 };
})();
