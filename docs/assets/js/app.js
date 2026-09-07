(function () {
  "use strict";

  var CACHE_KEY = "namibia2026:site-data";
  var DATA_URL = "assets/data/site-data.json";

  var euro = function (v) {
    return (v < 0 ? "-" : "") + Math.abs(v).toLocaleString("de-DE", {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }) + " €";
  };

  var parseISO = function (s) { return new Date(s + "T00:00:00"); };
  var todayISO = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  // Blatt-1-Buchungen tragen ihr Check-in-Datum, nicht das Zahldatum. Damit
  // kuenftige (laengst vorausbezahlte) Unterkuenfte nicht als "neueste
  // Ausgabe" erscheinen, wird gegen das Geraetedatum getrennt.
  var bisherigeAusgaben = function (data) {
    var t = todayISO();
    return data.ausgaben.filter(function (a) { return a.datum <= t; });
  };
  var kommendeAusgaben = function (data) {
    var t = todayISO();
    return data.ausgaben.filter(function (a) { return a.datum > t; });
  };

  function zahlerPill(z) {
    var name = z == null || z === "" ? "TBD" : String(z);
    return '<span class="pill zahler-' + esc(name.toLowerCase()) + '">' + esc(name) + "</span>";
  }

  // Alte site-data.json aus dem localStorage-Cache kennt die Saldo-Felder
  // noch nicht - dann lieber keinen Hinweis als "NaN €".
  var hatSaldoFelder = function (s) { return s && typeof s.saldo_basis === "number"; };

  function saldoHint(s) {
    if (!hatSaldoFelder(s)) return "";
    var txt = "50/50 auf Basis der bisher bezahlten " + euro(s.saldo_basis) + ". ";
    if (s.offen > 0) txt += "Noch offen: " + euro(s.offen) + " – zählt erst, wenn jemand sie bezahlt (dann beim Zahler). ";
    if (s.tbd_gezahlt > 0.005) txt += "Achtung: " + euro(s.tbd_gezahlt) + " bezahlt ohne bekannten Zahler (TBD) – nicht im Saldo. ";
    return txt.trim();
  }

  // ---------------- Daten laden (mit Offline-Fallback) ----------------
  function loadData() {
    return fetch(DATA_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
        return data;
      })
      .catch(function (err) {
        var cached = null;
        try { cached = localStorage.getItem(CACHE_KEY); } catch (e) {}
        if (cached) {
          document.getElementById("offline-banner").classList.add("show");
          return JSON.parse(cached);
        }
        throw err;
      });
  }

  // ---------------- Navigation ----------------
  function initNav() {
    var buttons = document.querySelectorAll(".nav-btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () { showView(btn.dataset.view); });
    });
    var initial = (location.hash || "#home").replace("#", "");
    showView(initial);
    initSubNav();
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    document.querySelectorAll(".nav-btn").forEach(function (b) { b.classList.remove("active"); });
    var view = document.getElementById("view-" + name);
    var btn = document.querySelector('.nav-btn[data-view="' + name + '"]');
    if (view) view.classList.add("active");
    if (btn) btn.classList.add("active");
    // Kopfzeile nur auf Home - auf den anderen Tabs gehoert der Platz dem Inhalt.
    document.querySelector(".app-header").classList.toggle("hidden", name !== "home");
    history.replaceState(null, "", "#" + name);
  }

  // ---------------- Sub-Navigation (innerhalb "Kosten") ----------------
  function initSubNav() {
    var buttons = document.querySelectorAll(".subnav-btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () { showSubView(btn.dataset.subview); });
    });
  }

  function showSubView(name) {
    document.querySelectorAll(".subview").forEach(function (v) { v.classList.remove("active"); });
    document.querySelectorAll(".subnav-btn").forEach(function (b) { b.classList.remove("active"); });
    var view = document.getElementById("subview-" + name);
    var btn = document.querySelector('.subnav-btn[data-subview="' + name + '"]');
    if (view) view.classList.add("active");
    if (btn) btn.classList.add("active");
  }

  // ---------------- Heute ----------------
  function renderHeute(data) {
    var start = parseISO(data.trip.start);
    var end = parseISO(data.trip.end);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var totalDays = Math.round((end - start) / 86400000) + 1;
    var dayNum = Math.round((today - start) / 86400000) + 1;

    var badge = document.getElementById("day-badge");
    if (dayNum < 1) {
      badge.textContent = "Reise startet am " + fmtDate(data.trip.start);
    } else if (dayNum > totalDays) {
      badge.textContent = "Reise beendet – " + totalDays + " Tage";
    } else {
      badge.textContent = "Tag " + dayNum + " von " + totalDays;
    }

    var s = data.summary;
    document.getElementById("t-gesamt").textContent = euro(s.gesamt);
    document.getElementById("t-bezahlt").textContent = euro(s.bezahlt);
    document.getElementById("t-offen").textContent = euro(s.offen);
    document.getElementById("t-kasse-abgehoben").textContent = euro(s.kasse_abgehoben);
    document.getElementById("t-kasse-ausgegeben").textContent = euro(s.kasse_bar_ausgegeben);
    document.getElementById("t-kasse-bestand").textContent = euro(s.kasse_bestand);

    var saldoEl = document.getElementById("t-saldo");
    var labelEl = document.getElementById("saldo-label");
    if (s.saldo_patrick > 0.005) {
      labelEl.textContent = "Nora schuldet Patrick";
      saldoEl.textContent = euro(s.saldo_patrick);
      saldoEl.className = "value debt";
    } else if (s.saldo_patrick < -0.005) {
      labelEl.textContent = "Patrick schuldet Nora";
      saldoEl.textContent = euro(-s.saldo_patrick);
      saldoEl.className = "value debt";
    } else {
      labelEl.textContent = "Ausgeglichen";
      saldoEl.textContent = euro(0);
      saldoEl.className = "value ok";
    }
    document.getElementById("saldo-hint").textContent = saldoHint(s);
  }

  function fmtDate(iso) {
    var d = parseISO(iso);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }

  // ---------------- Reise-Status (aktuelle/naechste Unterkunft) ----------------
  function renderReiseStatus(data) {
    var today = todayISO();
    var unterkuenfte = data.plan.filter(function (p) { return p.kategorie === "Unterkunft"; });

    var aktuell = unterkuenfte.find(function (p) { return p.start <= today && today < p.ende; });
    if (!aktuell) aktuell = unterkuenfte.find(function (p) { return p.start === today; });
    var naechstes = unterkuenfte
      .filter(function (p) { return p.start > today; })
      .sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];

    document.getElementById("status-aktuell").textContent = aktuell ? aktuell.beschreibung : "–";
    var naechstesEl = document.getElementById("status-naechstes");
    if (naechstes) {
      var zusatz = "ab " + fmtDate(naechstes.start);
      if (naechstes.fahrzeit) zusatz += " · 🚗 " + naechstes.fahrzeit;
      naechstesEl.textContent = naechstes.beschreibung + " (" + zusatz + ")";
    } else {
      naechstesEl.textContent = "Reise beendet";
    }

    var list = document.getElementById("unterkuenfte-list");
    list.innerHTML = unterkuenfte.map(function (u) {
      var range = u.naechte > 1 ? fmtDate(u.start) + "–" + fmtDate(u.ende) : fmtDate(u.start);
      if (u.fahrzeit) range += " · 🚗 " + u.fahrzeit;
      var link = u.info_link
        ? '<a href="' + esc(u.info_link) + '" target="_blank" rel="noopener">Google Maps ↗</a>'
        : "";
      return '<div class="unterkuenfte-row">' +
        '<div><div class="uk-name">' + esc(u.beschreibung) + '</div><div class="uk-dates">' + esc(range) + "</div></div>" +
        link +
      "</div>";
    }).join("");
  }

  // ---------------- Letzte Ausgaben ----------------
  function renderLetzteAusgaben(data) {
    var letzte = bisherigeAusgaben(data).slice(-5).reverse();
    var list = document.getElementById("letzte-ausgaben-list");
    if (!letzte.length) {
      list.innerHTML = '<div class="empty-state">Noch keine Ausgaben erfasst.</div>';
      return;
    }
    list.innerHTML = letzte.map(function (a) {
      var zahlungsPill = a.status === "offen"
        ? '<span class="pill status-offen">offen</span>'
        : '<span class="pill">' + esc(mapZahlmittel(a.zahlmittel)) + "</span>";
      return '<div class="card">' +
        '<div class="card-row">' +
          '<span class="card-title">' + esc(a.beschreibung) + "</span>" +
          '<span class="card-amount">' + euro(a.betrag) + "</span>" +
        "</div>" +
        '<div class="card-meta">' +
          zahlerPill(a.zahler) +
          zahlungsPill +
          "<span>" + fmtDate(a.datum) + "</span>" +
        "</div>" +
      "</div>";
    }).join("");

    // Ausgabenliste liegt seit 06.09.2026 im eigenen Kosten-Tab, nicht mehr
    // als Sub-View von Home - deshalb Tab UND Sub-View umschalten.
    document.getElementById("alle-ausgaben-btn").onclick = function () {
      showView("kosten");
      showSubView("ausgaben");
    };
  }

  // ---------------- Ausgaben ----------------
  var activeKat = "Alle", activeZahler = "Alle";

  function renderAusgaben(data) {
    var kats = ["Alle"].concat(uniq(data.ausgaben.map(function (a) { return a.kategorie; })));
    var zahler = ["Alle"].concat(uniq(data.ausgaben.map(function (a) { return a.zahler; })));

    renderChips("filter-kategorie", kats, activeKat, function (v) { activeKat = v; renderAusgaben(data); });
    renderChips("filter-zahler", zahler, activeZahler, function (v) { activeZahler = v; renderAusgaben(data); });

    var match = function (a) {
      return (activeKat === "Alle" || a.kategorie === activeKat) &&
             (activeZahler === "Alle" || a.zahler === activeZahler);
    };
    var bisher = bisherigeAusgaben(data).filter(match).reverse();
    var kommend = kommendeAusgaben(data).filter(match);

    var html = bisher.length
      ? bisher.map(ausgabeCard).join("")
      : '<div class="empty-state">Keine Ausgaben in dieser Ansicht.</div>';
    if (kommend.length) {
      var summe = kommend.reduce(function (acc, a) { return acc + a.betrag; }, 0);
      html += '<details class="collapse-block">' +
        "<summary>Kommende Buchungen (" + kommend.length + " · " + euro(summe) + ")</summary>" +
        '<div class="collapse-body card-list">' + kommend.map(ausgabeCard).join("") + "</div>" +
        "</details>";
    }
    document.getElementById("ausgaben-list").innerHTML = html;
  }

  function ausgabeCard(a) {
    var zahlungsPill = a.status === "offen"
      ? '<span class="pill status-offen">offen</span>'
      : '<span class="pill">' + esc(mapZahlmittel(a.zahlmittel)) + "</span>";
    var fw = a.betrag_fw && a.waehrung && a.waehrung !== "EUR"
      ? "<span>" + a.betrag_fw.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        " " + esc(a.waehrung) + "</span>"
      : "";
    return '<div class="card">' +
      '<div class="card-row">' +
        '<span class="card-title">' + esc(a.beschreibung) + "</span>" +
        '<span class="card-amount">' + euro(a.betrag) + "</span>" +
      "</div>" +
      '<div class="card-meta">' +
        '<span class="pill">' + esc(a.kategorie) + "</span>" +
        zahlerPill(a.zahler) +
        zahlungsPill + fw +
        "<span>" + fmtDate(a.datum) + "</span>" +
      "</div>" +
    "</div>";
  }

  function renderChips(containerId, options, active, onPick) {
    var el = document.getElementById(containerId);
    el.innerHTML = "";
    options.forEach(function (opt) {
      var chip = document.createElement("button");
      chip.className = "chip" + (opt === active ? " active" : "");
      chip.textContent = opt;
      chip.addEventListener("click", function () { onPick(opt); });
      el.appendChild(chip);
    });
  }

  function uniq(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; }).sort();
  }

  function esc(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : s;
    return div.innerHTML;
  }

  // Rohes Zahlmittel aus den CSVs (z.B. "Oberbank Debit", "N26 Debit",
  // "Bargeld") auf die vier Kurzformen abbilden, die der Nutzer sehen will.
  // Reihenfolge wichtig: N26 zuerst pruefen, sonst faellt "N26 Debit"
  // unter das generische "Debit".
  function mapZahlmittel(raw) {
    var v = (raw || "").trim();
    if (!v || v === "TBD") return "TBD";
    var low = v.toLowerCase();
    if (low.indexOf("bargeld") !== -1 || low === "bar") return "Bar";
    if (low.indexOf("n26") !== -1) return "N26";
    if (low.indexOf("kredit") !== -1 || low.indexOf("card complete") !== -1) return "Kredit";
    if (low.indexOf("debit") !== -1) return "Debit";
    return v;
  }

  // ---------------- Reiseplan ----------------
  function renderPlan(data) {
    var today = todayISO();
    var el = document.getElementById("plan-timeline");
    el.innerHTML = "";

    data.plan.forEach(function (p) {
      var state = "future";
      if (p.ende <= today) state = "past";
      else if (p.start <= today && today < p.ende) state = "today";
      else if (p.start === today) state = "today";

      var item = document.createElement("div");
      item.className = "timeline-item " + state;
      var range = p.naechte > 1
        ? fmtDate(p.start) + " – " + fmtDate(p.ende) + " · " + p.naechte + " Nächte"
        : fmtDate(p.start);
      item.innerHTML =
        '<div class="timeline-date">' + range + "</div>" +
        '<div class="card">' +
          '<div class="card-row">' +
            '<span class="card-title">' + esc(p.beschreibung) + "</span>" +
          "</div>" +
          '<div class="card-meta">' +
            '<span class="pill">' + esc(p.kategorie) + "</span>" +
            (p.fahrzeit ? '<span class="pill fahrzeit">🚗 ' + esc(p.fahrzeit) + "</span>" : "") +
            (p.status === "offen" ? '<span class="pill status-offen">offen</span>' : "") +
          "</div>" +
        "</div>";
      el.appendChild(item);
    });
  }

  // ---------------- Kategorien-Donut ----------------
  // Feste Zuordnung Kategorie -> Farbe (nie nach Rang/Betrag, sonst wechselt
  // die Bedeutung einer Farbe von Update zu Update). Alles ausserhalb dieser
  // Liste faellt in "Weitere" - siehe dataviz-Skill: >6 Segmente verschwimmen,
  // eine 9. Farbe wird nie generiert, sondern gefaltet.
  var CATEGORY_COLORS = [
    ["Mietwagen", "--series-mietwagen"],
    ["Flug", "--series-flug"],
    ["Unterkunft", "--series-unterkunft"],
    ["Tanken", "--series-tanken"],
    ["Lebensmittel", "--series-lebensmittel"],
    ["Restaurant", "--series-restaurant"]
  ];

  function buildWedges(kategorien) {
    var byName = {};
    kategorien.forEach(function (k) { byName[k.name] = k.betrag; });
    var wedges = [];
    var used = {};
    CATEGORY_COLORS.forEach(function (pair) {
      var name = pair[0], cssVar = pair[1];
      if (byName[name] > 0) {
        wedges.push({ name: name, betrag: byName[name], colorVar: cssVar });
        used[name] = true;
      }
    });
    var rest = 0;
    kategorien.forEach(function (k) {
      if (!used[k.name]) rest += k.betrag;
    });
    if (rest > 0) wedges.push({ name: "Weitere", betrag: rest, colorVar: "--series-other" });
    return wedges;
  }

  function renderDonut(wedges, total) {
    var svg = document.getElementById("kategorien-donut");
    var r = 62, cx = 80, cy = 80;
    var circumference = 2 * Math.PI * r;
    var gap = 3; // sichtbarer Trenner zwischen Segmenten (Surface-Gap-Prinzip)
    var offset = 0;
    var ns = "http://www.w3.org/2000/svg";
    svg.innerHTML = "";

    wedges.forEach(function (w, i) {
      var share = w.betrag / total;
      var len = Math.max(share * circumference - gap, 0);
      var circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", r);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", "var(" + w.colorVar + ")");
      circle.setAttribute("stroke-width", "24");
      circle.setAttribute("stroke-dasharray", len + " " + (circumference - len));
      circle.setAttribute("stroke-dashoffset", (-offset).toFixed(2));
      circle.setAttribute("transform", "rotate(-90 " + cx + " " + cy + ")");
      circle.classList.add("donut-segment");
      circle.dataset.name = w.name;
      var title = document.createElementNS(ns, "title");
      title.textContent = w.name + ": " + euro(w.betrag) + " (" + Math.round(share * 100) + " %)";
      circle.appendChild(title);
      svg.appendChild(circle);
      offset += share * circumference;
    });

    var valueText = document.createElementNS(ns, "text");
    valueText.setAttribute("x", cx);
    valueText.setAttribute("y", cy - 3);
    valueText.setAttribute("class", "donut-center-value");
    valueText.textContent = euro(total);
    svg.appendChild(valueText);

    var labelText = document.createElementNS(ns, "text");
    labelText.setAttribute("x", cx);
    labelText.setAttribute("y", cy + 11);
    labelText.setAttribute("class", "donut-center-label");
    labelText.textContent = "Gesamt";
    svg.appendChild(labelText);
  }

  function renderLegend(wedges, total) {
    var el = document.getElementById("kategorien-legend");
    el.innerHTML = "";
    wedges.forEach(function (w) {
      var pct = Math.round((w.betrag / total) * 100);
      var row = document.createElement("button");
      row.type = "button";
      row.className = "legend-row";
      row.dataset.name = w.name;
      row.innerHTML =
        '<span class="legend-swatch" style="background:var(' + w.colorVar + ')"></span>' +
        '<span class="legend-name">' + esc(w.name) + "</span>" +
        '<span class="legend-pct">' + pct + " %</span>" +
        '<span class="legend-amount">' + euro(w.betrag) + "</span>";
      el.appendChild(row);
    });
  }

  function initDonutInteraction() {
    var svg = document.getElementById("kategorien-donut");
    var legend = document.getElementById("kategorien-legend");

    function select(name) {
      var isSame = svg.dataset.selected === name;
      if (isSame) {
        svg.dataset.selected = "";
        svg.classList.remove("has-selection");
        legend.classList.remove("has-selection");
        svg.querySelectorAll(".donut-segment").forEach(function (s) { s.classList.remove("selected"); });
        legend.querySelectorAll(".legend-row").forEach(function (r) { r.classList.remove("selected"); });
        return;
      }
      svg.dataset.selected = name;
      svg.classList.add("has-selection");
      legend.classList.add("has-selection");
      svg.querySelectorAll(".donut-segment").forEach(function (s) {
        s.classList.toggle("selected", s.dataset.name === name);
      });
      legend.querySelectorAll(".legend-row").forEach(function (r) {
        r.classList.toggle("selected", r.dataset.name === name);
      });
    }

    svg.addEventListener("click", function (e) {
      var seg = e.target.closest(".donut-segment");
      if (seg) select(seg.dataset.name);
    });
    legend.addEventListener("click", function (e) {
      var row = e.target.closest(".legend-row");
      if (row) select(row.dataset.name);
    });
  }

  // ---------------- Tanken ----------------
  function renderTankplanung(planung) {
    var card = document.getElementById("tankplanung-card");
    if (!planung) {
      card.innerHTML = '<div class="empty-state">Keine Tankplanung hinterlegt.</div>';
      return;
    }
    var rows =
      row("Letzter Volltank", planung.letzter_volltank.ort + " (" + fmtDate(planung.letzter_volltank.datum) + ")") +
      row("Aktueller Standort", planung.aktueller_standort.ort + " (" + fmtDate(planung.aktueller_standort.datum) + ")") +
      (planung.kilometerstand
        ? row("Kilometerstand", planung.kilometerstand.wert.toLocaleString("de-DE") + " km · " +
              planung.kilometerstand.ort + ", " + fmtDate(planung.kilometerstand.datum))
        : "") +
      row("Geschätzt gefahren seit Volltank", "~" + planung.strecke_seit_volltank_km + " km") +
      (planung.geschaetzte_restreichweite_km != null
        ? row("Geschätzte Restreichweite", "~" + planung.geschaetzte_restreichweite_km + " km (~" + planung.geschaetzte_rest_liter + " L)")
        : "") +
      row("Nächster Pflichtstopp", planung.naechster_pflicht_stopp.ort + " (~" + planung.strecke_bis_naechster_stopp_km + " km)");

    card.innerHTML = rows +
      '<div class="tankplanung-empfehlung"><span class="icon">💡</span>' + esc(planung.empfehlung) + "</div>" +
      '<div class="tankplanung-anmerkung">' + esc(planung.anmerkung) + "</div>";

    function row(label, value) {
      return '<div class="tankplanung-row"><span class="tp-label">' + esc(label) + '</span><span class="tp-value">' + esc(value) + "</span></div>";
    }
  }

  function renderTanken(data) {
    var t = data.tanken || { fillups: [], summary: {}, tankstellen_hinweise: [], planung: null };
    var s = t.summary || {};
    renderTankplanung(t.planung);

    var quelleLabel = { fillups: "gemessen", bordcomputer: "Bordcomputer", hersteller: "Hersteller" }[s.verbrauch_quelle];
    var verbrauchLabel = "⌀ Verbrauch" + (quelleLabel ? " (" + quelleLabel + ")" : "");

    var tiles = document.getElementById("tanken-tiles");
    tiles.innerHTML =
      tile("Gesamt getankt", s.gesamt_liter != null ? s.gesamt_liter.toLocaleString("de-DE") + " L" : "noch offen") +
      tile("⌀ Preis / Liter", s.avg_preis_liter_eur != null ? euro(s.avg_preis_liter_eur) : "noch offen") +
      tile(verbrauchLabel, s.avg_verbrauch_l_100km != null ? s.avg_verbrauch_l_100km.toLocaleString("de-DE") + " L/100km" : "noch offen") +
      tile("Reichweite (voll)", s.reichweite_km != null ? "~" + s.reichweite_km + " km" : "Tankgröße fehlt noch", true);

    var list = document.getElementById("tanken-list");
    if (!t.fillups.length) {
      list.innerHTML = '<div class="empty-state">Noch keine Tankvorgänge erfasst.</div>';
    } else {
      list.innerHTML = t.fillups.slice().reverse().map(function (f) {
        var details = [];
        if (f.liter != null) details.push(f.liter.toLocaleString("de-DE") + " L");
        if (f.preis_pro_liter_nad != null) details.push(f.preis_pro_liter_nad.toLocaleString("de-DE") + " NAD/L");
        if (f.verbrauch_l_100km != null) details.push(f.verbrauch_l_100km.toLocaleString("de-DE") + " L/100km");
        if (f.kilometerstand != null) details.push(Math.round(f.kilometerstand).toLocaleString("de-DE") + " km-Stand");
        return '<div class="card">' +
          '<div class="card-row">' +
            '<span class="card-title">' + esc(f.ort) + "</span>" +
            '<span class="card-amount">' + euro(f.betrag_eur) + "</span>" +
          "</div>" +
          '<div class="card-meta">' +
            (details.length ? details.map(function (d) { return '<span class="pill">' + esc(d) + "</span>"; }).join("") : '<span class="pill">Details fehlen noch</span>') +
            zahlerPill(f.zahler) +
            "<span>" + fmtDate(f.datum) + "</span>" +
          "</div>" +
        "</div>";
      }).join("");
    }

    var hint = document.getElementById("tanken-hint");
    var fehlend = [];
    if (s.tankgroesse_liter == null) fehlend.push("Tankgröße");
    if (s.avg_verbrauch_l_100km == null) fehlend.push("Verbrauch (Fill-ups mit km-Stand oder Herstellerangabe)");
    if (fehlend.length) {
      hint.textContent = fehlend.join(" und ") + " fehlen noch – sobald bekannt, rechnet die Seite die Reichweite automatisch aus.";
    } else {
      hint.textContent = "";
    }

    var tsList = document.getElementById("tankstellen-list");
    tsList.innerHTML = (t.tankstellen_hinweise || []).map(function (h) {
      return '<div class="tankstellen-item">' +
        '<div class="abschnitt">' + esc(h.abschnitt) + "</div>" +
        '<div class="hinweis">' + esc(h.hinweis) + "</div>" +
      "</div>";
    }).join("");
  }

  function tile(label, value, wide) {
    return '<div class="tile' + (wide ? " wide" : "") + '">' +
      '<div class="label">' + esc(label) + "</div>" +
      '<div class="value">' + esc(value) + "</div>" +
    "</div>";
  }

  // ---------------- Mehr: Kategorien, Verrechnung, offene Punkte ----------------
  function renderMehr(data) {
    var wedges = buildWedges(data.kategorien);
    var total = wedges.reduce(function (sum, w) { return sum + w.betrag; }, 0);
    renderDonut(wedges, total);
    renderLegend(wedges, total);
    initDonutInteraction();
    renderTanken(data);

    var s = data.summary;
    var vc = document.getElementById("verrechnung-cards");
    if (!hatSaldoFelder(s)) {
      vc.innerHTML = '<div class="empty-state">Verrechnung braucht aktuelle Daten – bitte online neu laden.</div>';
      document.getElementById("verrechnung-hint").textContent = "";
      return;
    }
    vc.innerHTML =
      cardRow("Patrick gezahlt (Karte + Bargeld)", s.patrick_gezahlt) +
      cardRow("Nora gezahlt (Karte)", s.nora_gezahlt) +
      cardRow("Überweisung Patrick → Nora", s.transfer_patrick_nora) +
      cardRow("Anteil je Person (50 %)", s.anteil_pro_person) +
      cardRow("Patrick effektiv getragen", s.beitrag_patrick) +
      cardRow("Nora effektiv getragen", s.beitrag_nora);
    document.getElementById("verrechnung-hint").textContent =
      "Effektiv = eigene Zahlungen plus/minus Überweisung. " +
      (s.beitrag_nora < 0 ? "Negativ bei Nora heißt: von den 2.000 € ist noch mehr übrig, als sie selbst beigesteuert hat. " : "") +
      saldoHint(s);

    var op = document.getElementById("offene-punkte-list");
    if (!data.offene_punkte.length) {
      op.innerHTML = '<div class="empty-state">Keine offenen Punkte 🎉</div>';
    } else {
      op.innerHTML = data.offene_punkte.map(function (o) {
        return '<div class="open-item"><div>' + esc(o.punkt) + '</div>' +
               '<div class="warum">' + esc(o.warum) + "</div></div>";
      }).join("");
    }

    document.getElementById("update-note").textContent =
      "Stand: " + new Date(data.generated_at).toLocaleString("de-DE");
  }

  function cardRow(label, value) {
    return '<div class="card"><div class="card-row">' +
      '<span class="card-title">' + esc(label) + "</span>" +
      '<span class="card-amount">' + euro(value) + "</span>" +
      "</div></div>";
  }

  // ---------------- Start ----------------
  initNav();
  loadData().then(function (data) {
    document.getElementById("header-subline").textContent =
      "02.09. – 21.09.2026 · Patrick & Nora";
    renderHeute(data);
    renderReiseStatus(data);
    renderLetzteAusgaben(data);
    renderAusgaben(data);
    renderPlan(data);
    renderMehr(data);
  }).catch(function () {
    document.getElementById("header-subline").textContent = "Daten konnten nicht geladen werden.";
  });

  window.addEventListener("hashchange", function () {
    showView(location.hash.replace("#", "") || "home");
  });
})();
