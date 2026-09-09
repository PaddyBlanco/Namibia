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
    return ausgabenAktuell(data).filter(function (a) { return a.datum <= t; });
  };
  var kommendeAusgaben = function (data) {
    var t = todayISO();
    return ausgabenAktuell(data).filter(function (a) { return a.datum > t; });
  };

  function zahlerPill(z) {
    var name = z == null || z === "" ? "TBD" : String(z);
    var cls = name.indexOf("+") !== -1 ? "beide" : name.toLowerCase().replace(/[^a-z]/g, "");
    return '<span class="pill zahler-' + esc(cls) + '">' + esc(name) + "</span>";
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

  // ---------------- Lokale Aenderungen: Create / Update / Delete ----------------
  // Alle Aenderungen (neu, geaendert, geloescht) werden nur auf diesem Handy
  // gespeichert (localStorage) und in den Listen sofort als Overlay gezeigt.
  // Kein Schreibzugriff aufs Repo: "An Claude uebergeben" kopiert die
  // Aenderungen als Klartext, Claude schreibt sie in die CSVs - mit denselben
  // Pruefungen wie bei jedem Beleg (siehe CLAUDE.md). Die Kacheln im
  // Kosten-Tab zeigen weiterhin den Repo-Stand, nur die Liste das Overlay.
  var PENDING_KEY = "namibia2026:pending-entries";
  var KATEGORIEN = ["Lebensmittel", "Restaurant", "Tanken", "Eintritt", "Aktivitäten", "Unterkunft",
                    "Shopping", "Ausrüstung", "Gebühren", "Sonstiges", "Flug", "Mietwagen"];
  var ZAHLMITTEL_DEFAULT = { Nora: "N26 Debit", Patrick: "Bargeld" };
  var FELD_LABEL = { datum: "Datum", kategorie: "Kategorie", beschreibung: "Beschreibung", betrag: "Betrag",
                     zahler: "Zahler", zahlmittel: "Zahlmittel", anmerkung: "Anmerkung" };
  var currentData = null;

  var fmtBetrag = function (n) {
    return Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function loadPending() {
    try {
      var list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
      // Altes Schema (reine Eintragsobjekte) -> als "create" behandeln.
      return list.map(function (p) { return p && p.op ? p : { op: "create", entry: p, ts: 0 }; });
    } catch (e) { return []; }
  }
  function savePending(list) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function refText(a) {
    return (a.id ? a.id + " · " : "") + a.beschreibung + " · " + fmtDate(a.datum) + " · " +
      (a.betrag != null ? euro(a.betrag) : fmtBetrag(a.betrag_fw) + " NAD");
  }
  function entryLine(e) {
    return fmtDate(e.datum) + " · " + e.kategorie + " · " + e.beschreibung + " · " +
      fmtBetrag(e.betrag) + " " + e.waehrung + " · Zahler: " + e.zahler + " (" + e.zahlmittel + ")" +
      (e.anmerkung ? " · " + e.anmerkung : "");
  }
  function diffText(p) {
    var parts = [];
    Object.keys(FELD_LABEL).forEach(function (k) {
      var alt = p.original[k], neu = p.entry[k];
      if (k === "betrag") {
        alt = fmtBetrag(p.original.betrag) + " " + p.original.waehrung;
        neu = fmtBetrag(p.entry.betrag) + " " + p.entry.waehrung;
      }
      if ((alt || "") === (neu || "")) return;
      parts.push(FELD_LABEL[k] + " " + (alt || "–") + " → " + (neu || "–"));
    });
    return parts.join("; ");
  }
  function formatPending(p) {
    if (p.op === "create") return "NEU: " + entryLine(p.entry);
    if (p.op === "delete") return "LÖSCHEN [" + p.ref + "]";
    return "ÄNDERN [" + p.ref + "]: " + (diffText(p) || "keine Feldänderung");
  }

  // Overlay: Repo-Daten + lokale Aenderungen, wie die Liste sie zeigen soll.
  function ausgabenAktuell(data) {
    var pend = loadPending();
    var byId = {};
    pend.forEach(function (p) { if (p.id) byId[p.id] = p; });
    var out = [];
    (data.ausgaben || []).forEach(function (a) {
      var p = a.id ? byId[a.id] : null;
      if (p && p.op === "delete") return;
      out.push(p && p.op === "update" ? mitAenderung(a, p.entry) : a);
    });
    pend.forEach(function (p, i) {
      if (p.op !== "create") return;
      var e = p.entry;
      out.push({
        id: null, pending: "create", pendingIndex: i,
        datum: e.datum, zeit: "", kategorie: e.kategorie, beschreibung: e.beschreibung,
        betrag: e.waehrung === "EUR" ? e.betrag : null,
        betrag_fw: e.waehrung === "NAD" ? e.betrag : null,
        waehrung: e.waehrung, zahler: e.zahler, zahlmittel: e.zahlmittel, status: "bezahlt"
      });
    });
    out.sort(function (x, y) {
      var kx = x.datum + (x.zeit || ""), ky = y.datum + (y.zeit || "");
      return kx < ky ? -1 : kx > ky ? 1 : 0;
    });
    return out;
  }
  function mitAenderung(a, e) {
    var n = Object.assign({}, a, {
      pending: "update", datum: e.datum, kategorie: e.kategorie, beschreibung: e.beschreibung,
      zahler: e.zahler, zahlmittel: e.zahlmittel
    });
    if (e.waehrung === "EUR") {
      n.betrag = e.betrag;
      if (a.waehrung !== "NAD") n.betrag_fw = null;
    } else {
      n.betrag_fw = e.betrag;
      n.waehrung = "NAD";
      // EUR nur ueber den eigenen Kurs der Zeile umrechnen - sonst unbekannt lassen.
      n.betrag = (a.betrag_fw && a.betrag) ? Math.round(e.betrag / (a.betrag_fw / a.betrag) * 100) / 100 : null;
    }
    return n;
  }
  function formWerte(a) {
    var nad = a.betrag_fw != null && a.waehrung === "NAD";
    return {
      datum: a.datum, kategorie: a.kategorie, beschreibung: a.beschreibung,
      betrag: nad ? a.betrag_fw : a.betrag, waehrung: nad ? "NAD" : "EUR",
      zahler: (a.zahler === "Patrick" || a.zahler === "Nora") ? a.zahler : "",
      zahlmittel: a.zahlmittel === "TBD" ? "" : (a.zahlmittel || ""),
      anmerkung: a.anmerkung || ""
    };
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.hidden = true; }, 250);
    }, 2600);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { document.body.removeChild(ta); }
    return Promise.resolve();
  }

  function rerenderLokal() {
    renderPendingBlock();
    if (currentData) {
      renderAusgaben(currentData);
      renderLetzteAusgaben(currentData);
    }
  }

  function renderPendingBlock() {
    var list = loadPending();
    var el = document.getElementById("pending-block");
    var homeNote = document.getElementById("home-pending-note");
    var OP = { create: "Neu", update: "Geändert", delete: "Gelöscht" };

    if (!list.length) {
      el.innerHTML = "";
      homeNote.hidden = true;
      return;
    }
    homeNote.hidden = false;
    homeNote.textContent = (list.length === 1 ? "1 lokale Änderung wartet" : list.length + " lokale Änderungen warten") + " auf Übergabe an Claude →";

    el.innerHTML =
      '<div class="pending-card">' +
        '<div class="pending-head"><span>Noch nicht übergeben</span><span class="badge">' + list.length + "</span></div>" +
        list.map(function (p, i) {
          var titel, meta, betrag = "";
          if (p.op === "create") {
            titel = p.entry.beschreibung;
            meta = fmtDate(p.entry.datum) + " · " + p.entry.kategorie + " · " + p.entry.zahler + " · " + mapZahlmittel(p.entry.zahlmittel);
            betrag = fmtBetrag(p.entry.betrag) + " " + p.entry.waehrung;
          } else if (p.op === "update") {
            titel = p.entry.beschreibung;
            meta = diffText(p) || "keine Feldänderung";
          } else {
            titel = p.ref.split(" · ").slice(1, 2).join("") || p.ref;
            meta = p.ref;
          }
          return '<div class="pending-row op-' + p.op + '">' +
            '<div class="pending-main">' +
              '<div class="pending-title"><span class="pending-op">' + OP[p.op] + "</span>" + esc(titel) + "</div>" +
              '<div class="pending-meta">' + esc(meta) + "</div>" +
            "</div>" +
            (betrag ? '<div class="pending-amount">' + esc(betrag) + "</div>" : "") +
            '<button type="button" class="icon-button small pending-remove" data-index="' + i + '" aria-label="Lokale Änderung verwerfen">×</button>' +
          "</div>";
        }).join("") +
        '<div class="pending-actions">' +
          '<button type="button" class="primary-button" id="pending-copy">An Claude übergeben</button>' +
          '<button type="button" class="ghost-button" id="pending-clear">Leeren</button>' +
        "</div>" +
        '<div class="field-note">Kopiert alle Änderungen als Text – im Chat einfügen, danach hier leeren. × verwirft eine lokale Änderung.</div>' +
      "</div>";

    document.getElementById("pending-copy").addEventListener("click", function (ev) {
      var b = ev.currentTarget;
      var text = "Offline erfasste Änderungen:\n" + loadPending().map(formatPending).join("\n");
      copyText(text).then(function () {
        b.textContent = "✓ Kopiert – im Chat einfügen";
        toast("In die Zwischenablage kopiert");
        setTimeout(function () { b.textContent = "An Claude übergeben"; }, 3000);
      }).catch(function () { toast("Kopieren nicht möglich – bitte Einträge abtippen"); });
    });
    document.getElementById("pending-clear").addEventListener("click", function () {
      var n = loadPending().length;
      if (!confirm("Alle " + n + " lokalen Änderungen verwerfen? Nur, wenn sie im Chat angekommen sind.")) return;
      savePending([]);
      rerenderLokal();
      toast("Liste geleert");
    });
  }

  // --- Sheets ---
  var sheetState = { mode: "create", waehrung: "NAD", zahler: "", zahlmittel: "", kategorie: "" };
  var aktionZiel = null;

  function setSegmented(groupId, value) {
    document.querySelectorAll("#" + groupId + " .seg").forEach(function (b) {
      var on = b.dataset.value === value;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }

  function openSheet(id) {
    document.getElementById("sheet-backdrop").hidden = false;
    var sheet = document.getElementById(id);
    sheet.hidden = false;
    document.body.classList.add("sheet-open");
    requestAnimationFrame(function () { sheet.classList.add("open"); });
    if (id === "sheet-erfassen") setTimeout(function () { document.getElementById("ef-betrag").focus(); }, 250);
  }

  function closeSheets() {
    var offen = Array.prototype.slice.call(document.querySelectorAll(".sheet.open"));
    offen.forEach(function (s) { s.classList.remove("open"); });
    document.body.classList.remove("sheet-open");
    setTimeout(function () {
      offen.forEach(function (s) { s.hidden = true; });
      document.getElementById("sheet-backdrop").hidden = true;
    }, 220);
  }

  function resetSheet() {
    document.getElementById("erfassen-form").reset();
    document.getElementById("ef-datum").value = todayISO();
    sheetState = { mode: "create", waehrung: "NAD", zahler: "", zahlmittel: "", kategorie: "" };
    setSegmented("ef-waehrung", "NAD");
    setSegmented("ef-zahler", "");
    setSegmented("ef-zahlmittel", "");
    setSegmented("ef-kategorie", "");
    document.getElementById("ef-zahler").classList.remove("locked");
    document.getElementById("ef-bargeld-hint").hidden = true;
    document.getElementById("ef-error").hidden = true;
    document.getElementById("sheet-title").textContent = "Ausgabe erfassen";
    document.getElementById("ef-submit").textContent = "Speichern";
  }

  function fillSheet(w) {
    document.getElementById("ef-betrag").value = w.betrag != null ? String(w.betrag).replace(".", ",") : "";
    document.getElementById("ef-beschreibung").value = w.beschreibung || "";
    document.getElementById("ef-datum").value = w.datum || todayISO();
    document.getElementById("ef-anmerkung").value = w.anmerkung || "";
    sheetState.waehrung = w.waehrung || "NAD";
    sheetState.zahler = w.zahler || "";
    sheetState.zahlmittel = w.zahlmittel || "";
    sheetState.kategorie = w.kategorie || "";
    setSegmented("ef-waehrung", sheetState.waehrung);
    setSegmented("ef-zahler", sheetState.zahler);
    setSegmented("ef-zahlmittel", sheetState.zahlmittel);
    setSegmented("ef-kategorie", sheetState.kategorie);
    var bar = sheetState.zahlmittel === "Bargeld";
    document.getElementById("ef-zahler").classList.toggle("locked", bar);
    document.getElementById("ef-bargeld-hint").hidden = !bar;
    document.getElementById("sheet-title").textContent = "Ausgabe bearbeiten";
    document.getElementById("ef-submit").textContent = "Änderung speichern";
  }

  function parseBetrag(s) {
    var t = String(s).replace(/\s/g, "");
    if (t.indexOf(",") !== -1) t = t.replace(/\./g, "").replace(",", ".");   // 1.250,00 -> 1250.00
    else if ((t.match(/\./g) || []).length > 1) return NaN;                 // 1.250.00 ist mehrdeutig
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    var n = parseFloat(t);
    return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  // Aktions-Sheet fuer eine Karte (Repo-Zeile per id oder lokaler Eintrag per pendingIndex)
  function openAktion(ziel) {
    aktionZiel = ziel;
    document.getElementById("aktion-title").textContent = ziel.row.beschreibung;
    document.getElementById("aktion-sub").textContent = fmtDate(ziel.row.datum) + " · " +
      (ziel.row.betrag != null ? euro(ziel.row.betrag) : fmtBetrag(ziel.row.betrag_fw) + " NAD") +
      (ziel.row.pending ? " · lokale Änderung" : "");
    openSheet("sheet-aktion");
  }

  function starteBearbeiten() {
    var z = aktionZiel; if (!z) return;
    resetSheet();
    var list = loadPending();
    if (z.pendingIndex != null) {
      sheetState.mode = "edit-pending";
      sheetState.pendingIndex = z.pendingIndex;
      fillSheet(list[z.pendingIndex].entry);
    } else {
      var vorhanden = list.find(function (p) { return p.id === z.id; });
      var serverRow = (currentData.ausgaben || []).find(function (a) { return a.id === z.id; });
      sheetState.mode = "edit";
      sheetState.editId = z.id;
      sheetState.editRef = refText(serverRow || z.row);
      sheetState.original = vorhanden && vorhanden.original ? vorhanden.original : formWerte(serverRow || z.row);
      fillSheet(vorhanden && vorhanden.op === "update" ? vorhanden.entry : sheetState.original);
    }
    closeSheets();
    setTimeout(function () { openSheet("sheet-erfassen"); }, 230);
  }

  function starteLoeschen() {
    var z = aktionZiel; if (!z) return;
    if (!confirm('"' + z.row.beschreibung + '" löschen? Wird beim nächsten Übergeben an Claude entfernt.')) return;
    var list = loadPending();
    if (z.pendingIndex != null) {
      list.splice(z.pendingIndex, 1);
    } else {
      var serverRow = (currentData.ausgaben || []).find(function (a) { return a.id === z.id; });
      var item = { op: "delete", id: z.id, ref: refText(serverRow || z.row), ts: Date.now() };
      var idx = list.findIndex(function (p) { return p.id === z.id; });
      if (idx >= 0) list[idx] = item; else list.push(item);
    }
    savePending(list);
    closeSheets();
    rerenderLokal();
    toast("Löschung vorgemerkt");
  }

  function initErfassen() {
    var katEl = document.getElementById("ef-kategorie");
    katEl.innerHTML = KATEGORIEN.map(function (k) {
      return '<button type="button" class="seg" data-value="' + esc(k) + '" role="radio" aria-checked="false">' + esc(k) + "</button>";
    }).join("");

    document.getElementById("ef-waehrung").addEventListener("click", function (ev) {
      var b = ev.target.closest(".seg"); if (!b) return;
      sheetState.waehrung = b.dataset.value;
      setSegmented("ef-waehrung", sheetState.waehrung);
    });

    var zahlerEl = document.getElementById("ef-zahler");
    var bargeldHint = document.getElementById("ef-bargeld-hint");

    function applyBargeldRule() {
      var bar = sheetState.zahlmittel === "Bargeld";
      bargeldHint.hidden = !bar;
      zahlerEl.classList.toggle("locked", bar);
      if (bar) {
        sheetState.zahler = "Patrick";
        setSegmented("ef-zahler", "Patrick");
      }
    }

    zahlerEl.addEventListener("click", function (ev) {
      var b = ev.target.closest(".seg"); if (!b) return;
      if (zahlerEl.classList.contains("locked")) {
        toast("Bei Bargeld ist der Zahler immer Patrick");
        return;
      }
      sheetState.zahler = b.dataset.value;
      setSegmented("ef-zahler", sheetState.zahler);
      if (!sheetState.zahlmittel) {
        // Vorschlag laut Kartenregel, bleibt aenderbar.
        sheetState.zahlmittel = ZAHLMITTEL_DEFAULT[sheetState.zahler] || "";
        setSegmented("ef-zahlmittel", sheetState.zahlmittel);
        applyBargeldRule();
      }
    });

    document.getElementById("ef-zahlmittel").addEventListener("click", function (ev) {
      var b = ev.target.closest(".seg"); if (!b) return;
      sheetState.zahlmittel = b.dataset.value;
      setSegmented("ef-zahlmittel", sheetState.zahlmittel);
      applyBargeldRule();
    });

    katEl.addEventListener("click", function (ev) {
      var b = ev.target.closest(".seg"); if (!b) return;
      sheetState.kategorie = b.dataset.value;
      setSegmented("ef-kategorie", sheetState.kategorie);
    });

    document.getElementById("erfassen-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var entry = {
        datum: document.getElementById("ef-datum").value || todayISO(),
        kategorie: sheetState.kategorie,
        beschreibung: document.getElementById("ef-beschreibung").value.trim(),
        betrag: parseBetrag(document.getElementById("ef-betrag").value),
        waehrung: sheetState.waehrung,
        zahlmittel: sheetState.zahlmittel,
        zahler: sheetState.zahler,
        anmerkung: document.getElementById("ef-anmerkung").value.trim(),
      };
      var fehlt = [];
      if (!(entry.betrag > 0)) fehlt.push("Betrag");
      if (!entry.beschreibung) fehlt.push("Ort/Beschreibung");
      if (!entry.zahler) fehlt.push("Zahler");
      if (!entry.zahlmittel) fehlt.push("Zahlmittel");
      if (!entry.kategorie) fehlt.push("Kategorie");
      var err = document.getElementById("ef-error");
      if (fehlt.length) {
        err.textContent = "Bitte noch ausfüllen: " + fehlt.join(", ");
        err.hidden = false;
        return;
      }
      var list = loadPending();
      var msg;
      if (sheetState.mode === "edit-pending") {
        list[sheetState.pendingIndex].entry = entry;
        msg = "Lokalen Eintrag aktualisiert";
      } else if (sheetState.mode === "edit") {
        var item = { op: "update", id: sheetState.editId, ref: sheetState.editRef, original: sheetState.original, entry: entry, ts: Date.now() };
        var idx = list.findIndex(function (p) { return p.id === sheetState.editId; });
        if (!diffText(item)) {
          if (idx >= 0) { list.splice(idx, 1); }
          msg = "Keine Änderung";
        } else {
          if (idx >= 0) list[idx] = item; else list.push(item);
          msg = "Änderung vorgemerkt";
        }
      } else {
        list.push({ op: "create", entry: entry, ts: Date.now() });
        msg = "Gespeichert";
      }
      savePending(list);
      resetSheet();
      closeSheets();
      rerenderLokal();
      var n = loadPending().length;
      toast(msg + (n ? " · " + n + (n === 1 ? " Änderung wartet" : " Änderungen warten") + " auf Übergabe" : ""));
    });

    ["home-add-btn", "add-ausgabe-btn"].forEach(function (id) {
      document.getElementById(id).addEventListener("click", function () { resetSheet(); openSheet("sheet-erfassen"); });
    });
    document.getElementById("sheet-close").addEventListener("click", closeSheets);
    document.getElementById("sheet-backdrop").addEventListener("click", closeSheets);
    document.getElementById("aktion-cancel").addEventListener("click", closeSheets);
    document.getElementById("aktion-edit").addEventListener("click", starteBearbeiten);
    document.getElementById("aktion-delete").addEventListener("click", starteLoeschen);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && document.querySelector(".sheet.open")) closeSheets();
    });
    document.getElementById("home-pending-note").addEventListener("click", function () {
      showView("kosten");
      showSubView("ausgaben");
    });
    document.getElementById("pending-block").addEventListener("click", function (ev) {
      var b = ev.target.closest(".pending-remove"); if (!b) return;
      var l = loadPending();
      l.splice(Number(b.dataset.index), 1);
      savePending(l);
      rerenderLokal();
    });
    // Tipp auf eine Ausgabenkarte -> Aktions-Sheet (Bearbeiten / Loeschen)
    ["ausgaben-list", "letzte-ausgaben-list"].forEach(function (id) {
      document.getElementById(id).addEventListener("click", function (ev) {
        var card = ev.target.closest(".card.ausgabe"); if (!card || !currentData) return;
        var pendingIndex = card.dataset.pendingIndex !== undefined ? Number(card.dataset.pendingIndex) : null;
        var rowId = card.dataset.id || null;
        if (pendingIndex == null && !rowId) return;
        var row = ausgabenAktuell(currentData).find(function (a) {
          return pendingIndex != null ? a.pendingIndex === pendingIndex : a.id === rowId;
        });
        if (row) openAktion({ id: rowId, pendingIndex: pendingIndex, row: row });
      });
    });

    document.getElementById("ef-datum").value = todayISO();
    renderPendingBlock();
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

    var tagText;
    if (dayNum < 1) tagText = "Reise startet am " + fmtDate(data.trip.start);
    else if (dayNum > totalDays) tagText = "Reise beendet · " + totalDays + " Tage";
    else tagText = "Tag " + dayNum + " von " + totalDays;
    document.getElementById("header-subline").textContent =
      tagText + " · " + fmtDate(data.trip.start) + " – " + fmtDate(data.trip.end) + parseISO(data.trip.end).getFullYear();

    var s = data.summary;
    document.getElementById("t-gesamt").textContent = euro(s.gesamt);
    document.getElementById("t-bezahlt").textContent = euro(s.bezahlt);
    document.getElementById("t-offen").textContent = euro(s.offen);
    document.getElementById("t-kasse-abgehoben").textContent = euro(s.kasse_abgehoben);
    document.getElementById("t-kasse-ausgegeben").textContent = euro(s.kasse_bar_ausgegeben);
    document.getElementById("t-kasse-bestand").textContent = euro(s.kasse_bestand);
    var kasseHint = document.getElementById("kasse-hint");
    if (s.kasse && Object.keys(s.kasse).length > 1) {
      kasseHint.textContent = "Zwei Bargeld-Töpfe: " + Object.keys(s.kasse).map(function (p) {
        var t = s.kasse[p];
        return p + " " + Math.round(t.bestand_nad).toLocaleString("de-DE") + " NAD (≈ " + euro(t.bestand_eur) + ")";
      }).join(" · ") + ". Barzahlungen zählen beim älteren Topf, bis er leer ist.";
    } else {
      kasseHint.textContent = "";
    }

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

    // Name als Google-Maps-Link (Suchlink aus info_link, siehe CLAUDE.md) -
    // damit man direkt aus dem Reise-Status navigieren kann.
    var mapsLink = function (u) {
      return u.info_link
        ? '<a class="reise-link" href="' + esc(u.info_link) + '" target="_blank" rel="noopener">' + esc(u.beschreibung) + ' <span class="reise-link-icon">↗</span></a>'
        : esc(u.beschreibung);
    };
    document.getElementById("status-aktuell").innerHTML = aktuell ? mapsLink(aktuell) : "–";
    var naechstesEl = document.getElementById("status-naechstes");
    if (naechstes) {
      var zusatz = "ab " + fmtDate(naechstes.start);
      if (naechstes.fahrzeit) zusatz += " · Anfahrt " + naechstes.fahrzeit;
      naechstesEl.innerHTML = mapsLink(naechstes) + '<div class="reise-status-sub">' + esc(zusatz) + "</div>";
    } else {
      naechstesEl.textContent = "Reise beendet";
    }

    var list = document.getElementById("unterkuenfte-list");
    list.innerHTML = unterkuenfte.map(function (u) {
      var range = u.naechte > 1 ? fmtDate(u.start) + "–" + fmtDate(u.ende) : fmtDate(u.start);
      if (u.fahrzeit) range += " · Anfahrt " + u.fahrzeit;
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
    list.innerHTML = letzte.map(function (a) { return ausgabeCard(a, true); }).join("");

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
    currentData = data;
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

    var html = "";
    if (!bisher.length) {
      html = '<div class="empty-state">Keine Ausgaben in dieser Ansicht.</div>';
    } else {
      var gesamt = bisher.reduce(function (acc, a) { return acc + (a.betrag || 0); }, 0);
      var ohneEur = bisher.filter(function (a) { return a.betrag == null; }).length;
      var lokal = loadPending().length;
      html += '<div class="list-summary"><span>' + bisher.length + " Posten" +
        (activeKat !== "Alle" || activeZahler !== "Alle" ? " (gefiltert)" : "") +
        (lokal ? " · " + lokal + " lokal" : "") + "</span><span>" + euro(gesamt) +
        (ohneEur ? " + " + ohneEur + " in NAD" : "") + "</span></div>";
      var tag = null, tagSumme = 0, tagItems = [];
      var flush = function () {
        if (!tagItems.length) return;
        html += '<div class="day-group">' +
          '<div class="day-head"><span>' + fmtDayHead(tag) + "</span><span>" +
            tagItems.length + (tagItems.length === 1 ? " Posten · " : " Posten · ") + euro(tagSumme) + "</span></div>" +
          '<div class="card-list">' + tagItems.join("") + "</div>" +
        "</div>";
        tagItems = []; tagSumme = 0;
      };
      bisher.forEach(function (a) {
        if (a.datum !== tag) { flush(); tag = a.datum; }
        tagItems.push(ausgabeCard(a, false));
        tagSumme += a.betrag || 0;
      });
      flush();
    }
    if (kommend.length) {
      var summe = kommend.reduce(function (acc, a) { return acc + a.betrag; }, 0);
      html += '<details class="collapse-block">' +
        "<summary>Kommende Buchungen (" + kommend.length + " · " + euro(summe) + ")</summary>" +
        '<div class="collapse-body card-list">' + kommend.map(function (a) { return ausgabeCard(a, true); }).join("") + "</div>" +
        "</details>";
    }
    document.getElementById("ausgaben-list").innerHTML = html;
  }

  function katColorVar(name) {
    for (var i = 0; i < CATEGORY_COLORS.length; i++) {
      if (CATEGORY_COLORS[i][0] === name) return CATEGORY_COLORS[i][1];
    }
    return "--series-other";
  }

  // Einheitliche Ausgabenkarte fuer Home und Ausgabenliste: links Kategorie
  // (Farbpunkt wie im Donut) + Titel, darunter WER (farbige Person) und
  // WOMIT; rechts Betrag, darunter der NAD-Originalbetrag. Nur "offen"/TBD
  // bleiben Warnpillen - alles andere ist ruhiger Text.
  function ausgabeCard(a, showDate) {
    var fw = a.betrag != null && a.betrag_fw && a.waehrung && a.waehrung !== "EUR"
      ? '<div class="card-fw">' + esc(fmtBetrag(a.betrag_fw)) + " " + esc(a.waehrung) + "</div>"
      : "";
    var betrag = a.betrag != null ? euro(a.betrag) : fmtBetrag(a.betrag_fw) + " NAD";
    var womit = a.status === "offen"
      ? '<span class="pill status-offen">offen</span>'
      : (mapZahlmittel(a.zahlmittel) === "TBD"
          ? '<span class="pill">Karte TBD</span>'
          : '<span class="card-womit">' + esc(mapZahlmittel(a.zahlmittel)) + "</span>");
    var pend = a.pending === "create" ? '<span class="pill status-pending">neu · wartet</span>'
      : a.pending === "update" ? '<span class="pill status-pending">geändert · wartet</span>' : "";
    var attrs = a.pendingIndex != null ? ' data-pending-index="' + a.pendingIndex + '"' : (a.id ? ' data-id="' + esc(a.id) + '"' : "");
    var tappable = a.pendingIndex != null || a.id;
    return '<div class="card ausgabe' + (tappable ? " tappable" : "") + '"' + attrs + (tappable ? ' role="button" tabindex="0"' : "") + ">" +
      '<div class="card-row">' +
        '<div class="card-main">' +
          '<div class="card-title">' + esc(a.beschreibung) + "</div>" +
          '<div class="card-sub">' +
            '<span class="kat-dot" style="background: var(' + katColorVar(a.kategorie) + ')"></span>' +
            '<span class="card-kat">' + esc(a.kategorie) + "</span>" +
            '<span class="card-sep">·</span>' +
            zahlerPill(a.zahler) + womit + pend +
            (showDate ? '<span class="card-sep">·</span><span>' + fmtDate(a.datum) + "</span>" : "") +
          "</div>" +
        "</div>" +
        '<div class="card-right">' +
          '<div class="card-amount">' + esc(betrag) + "</div>" + fw +
        "</div>" +
      "</div>" +
    "</div>";
  }

  var WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  function fmtDayHead(iso) {
    return WOCHENTAGE[parseISO(iso).getDay()] + ", " + fmtDate(iso);
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
      var hatBetrag = typeof p.betrag === "number";
      var bezahltVon = p.status !== "offen" && hatBetrag && p.betrag > 0 && p.zahler && p.zahler !== "TBD"
        ? zahlerPill(p.zahler) + '<span class="pill">' + esc(mapZahlmittel(p.zahlmittel)) + "</span>"
        : "";
      item.innerHTML =
        '<div class="timeline-date">' + range + "</div>" +
        '<div class="card">' +
          '<div class="card-row">' +
            '<span class="card-title">' + esc(p.beschreibung) + "</span>" +
            (hatBetrag && p.betrag > 0 ? '<span class="card-amount">' + euro(p.betrag) + "</span>" : "") +
          "</div>" +
          '<div class="card-meta">' +
            '<span class="pill">' + esc(p.kategorie) + "</span>" +
            (p.fahrzeit ? '<span class="pill">Anfahrt ' + esc(p.fahrzeit) + "</span>" : "") +
            (p.status === "offen" ? '<span class="pill status-offen">offen</span>' : bezahltVon) +
            (p.status !== "offen" && hatBetrag && p.betrag <= 0 ? '<span class="pill">vor Ort bezahlt</span>' : "") +
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
    var volltankKm = planung.letzter_volltank.kilometerstand;
    var seitKm = planung.strecke_seit_volltank_km;
    var bisStopp = planung.strecke_bis_naechster_stopp_km;
    var rows =
      row("Letzter Volltank", planung.letzter_volltank.ort +
          (volltankKm != null ? " · " + volltankKm.toLocaleString("de-DE") + " km" : "") +
          " (" + fmtDate(planung.letzter_volltank.datum) + ")") +
      row("Aktueller Standort", planung.aktueller_standort.ort + " (" + fmtDate(planung.aktueller_standort.datum) + ")") +
      (planung.kilometerstand
        ? row("Kilometerstand", planung.kilometerstand.wert.toLocaleString("de-DE") + " km · " +
              planung.kilometerstand.ort + ", " + fmtDate(planung.kilometerstand.datum))
        : "") +
      row("Gefahren seit Volltank", typeof seitKm === "number" ? "~" + seitKm + " km" : "TBD") +
      (planung.geschaetzte_restreichweite_km != null
        ? row("Geschätzte Restreichweite", "~" + planung.geschaetzte_restreichweite_km + " km (~" + planung.geschaetzte_rest_liter + " L)")
        : "") +
      row("Nächster Pflichtstopp", planung.naechster_pflicht_stopp.ort +
          (typeof bisStopp === "number" ? " (~" + bisStopp + " km)" : " (Strecke noch offen)"));

    card.innerHTML = rows +
      '<div class="tankplanung-empfehlung"><span class="icon">💡</span>' + esc(planung.empfehlung) + "</div>" +
      '<details class="tp-details"><summary>Hintergrund zur Schätzung</summary>' +
        '<div class="tankplanung-anmerkung">' + esc(planung.anmerkung) + "</div></details>";

    function row(label, value) {
      return '<div class="tankplanung-row"><span class="tp-label">' + esc(label) + '</span><span class="tp-value">' + esc(value) + "</span></div>";
    }
  }

  function renderTanken(data) {
    var t = data.tanken || { fillups: [], summary: {}, tankstellen_hinweise: [], planung: null };
    var s = t.summary || {};
    renderTankplanung(t.planung);

    var quelleLabel = { fillups: "aus Tankvorgängen gemessen", bordcomputer: "laut Bordcomputer", hersteller: "Herstellerangabe" }[s.verbrauch_quelle];

    var tiles = document.getElementById("tanken-tiles");
    tiles.innerHTML =
      tile("Getankt gesamt", s.gesamt_liter != null ? s.gesamt_liter.toLocaleString("de-DE") + " L" : "–") +
      tile("⌀ Preis je Liter", s.avg_preis_liter_eur != null ? euro(s.avg_preis_liter_eur) : "–") +
      tile("⌀ Verbrauch", s.avg_verbrauch_l_100km != null ? s.avg_verbrauch_l_100km.toLocaleString("de-DE") + " L" : "–", false,
           "je 100 km" + (quelleLabel ? " · " + quelleLabel : "")) +
      tile("Reichweite voll", s.reichweite_km != null ? "~" + s.reichweite_km.toLocaleString("de-DE") + " km" : "–", false,
           s.tankgroesse_liter ? s.tankgroesse_liter + " L Tank" : "Tankgröße fehlt");

    var list = document.getElementById("tanken-list");
    if (!t.fillups.length) {
      list.innerHTML = '<div class="empty-state">Noch keine Tankvorgänge erfasst.</div>';
    } else {
      list.innerHTML = t.fillups.slice().reverse().map(function (f) {
        var details = [];
        if (f.liter != null) details.push(f.liter.toLocaleString("de-DE") + " L");
        if (f.preis_pro_liter_nad != null) details.push(f.preis_pro_liter_nad.toLocaleString("de-DE") + " NAD/L");
        if (f.verbrauch_l_100km != null) details.push(f.verbrauch_l_100km.toLocaleString("de-DE") + " L/100km");
        if (f.kilometerstand != null) details.push("km " + Math.round(f.kilometerstand).toLocaleString("de-DE"));
        return '<div class="card">' +
          '<div class="card-row">' +
            '<div class="card-main">' +
              '<div class="card-title">' + esc(f.ort) + "</div>" +
              '<div class="card-sub">' + zahlerPill(f.zahler) + '<span class="card-sep">·</span><span>' + fmtDate(f.datum) + "</span>" +
                (details.length ? '<span class="card-sep">·</span><span>' + esc(details.join(" · ")) + "</span>" : "") +
              "</div>" +
            "</div>" +
            '<div class="card-right"><div class="card-amount">' + euro(f.betrag_eur) + "</div></div>" +
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

  function tile(label, value, wide, note) {
    return '<div class="tile' + (wide ? " wide" : "") + '">' +
      '<div class="label">' + esc(label) + "</div>" +
      '<div class="value">' + esc(value) + "</div>" +
      (note ? '<div class="tile-note">' + esc(note) + "</div>" : "") +
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
    } else {
    var saldoText = s.saldo_patrick > 0.005 ? "Nora schuldet Patrick " + euro(s.saldo_patrick)
      : s.saldo_patrick < -0.005 ? "Patrick schuldet Nora " + euro(-s.saldo_patrick) : "Ausgeglichen";
    var cell = function (v, cls) { return '<div class="verr-num' + (cls ? " " + cls : "") + '">' + euro(v) + "</div>"; };
    vc.innerHTML =
      '<div class="card verr">' +
        '<div class="verr-grid">' +
          '<div class="verr-h"></div><div class="verr-h person-p">Patrick</div><div class="verr-h person-n">Nora</div>' +
          "<div>Selbst gezahlt</div>" + cell(s.patrick_gezahlt) + cell(s.nora_gezahlt) +
          "<div>Überweisung</div>" + cell(s.transfer_patrick_nora, "plus") + cell(-s.transfer_patrick_nora, "minus") +
          "<div>Effektiv getragen</div>" + cell(s.beitrag_patrick, "strong") + cell(s.beitrag_nora, "strong") +
          "<div>Fairer Anteil (50 %)</div>" + cell(s.anteil_pro_person) + cell(s.anteil_pro_person) +
        "</div>" +
        '<div class="verr-result' + (Math.abs(s.saldo_patrick) > 0.005 ? " debt" : " ok") + '">' + esc(saldoText) + "</div>" +
      "</div>";
    document.getElementById("verrechnung-hint").textContent =
      (s.beitrag_nora < 0 ? "Negativ bei Nora: von der Überweisung ist noch mehr übrig, als sie selbst beigesteuert hat. " : "") +
      saldoHint(s);
    }

    var op = document.getElementById("offene-punkte-list");
    if (!data.offene_punkte.length) {
      op.innerHTML = '<div class="empty-state">Keine offenen Punkte 🎉</div>';
    } else {
      op.innerHTML = data.offene_punkte.map(function (o) {
        // Erster Satz/Halbsatz als Titel, der Rest aufklappbar - die Texte
        // stammen aus docs/offene-punkte.md und sind dort bewusst ausfuehrlich.
        var m = /^(.{12,120}?)(?:\s+[—–]\s+|:\s+)([\s\S]+)$/.exec(o.punkt);
        var titel = m ? m[1] : o.punkt;
        var rest = m ? m[2] : "";
        if (!m && o.punkt.length > 90) {
          var cut = o.punkt.lastIndexOf(" ", 84);
          titel = o.punkt.slice(0, cut > 40 ? cut : 84) + " …";
          rest = o.punkt;
        }
        return '<div class="open-item">' +
          '<div class="open-title">' + esc(titel) + "</div>" +
          '<div class="warum">' + esc(o.warum) + "</div>" +
          (rest ? '<details class="open-more"><summary>Details</summary><div>' + esc(rest) + "</div></details>" : "") +
        "</div>";
      }).join("");
    }

    var gen = new Date(data.generated_at);
    document.getElementById("update-note").textContent =
      "Datenstand " + gen.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      ", " + gen.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
  }

  function cardRow(label, value) {
    return '<div class="card"><div class="card-row">' +
      '<span class="card-title">' + esc(label) + "</span>" +
      '<span class="card-amount">' + euro(value) + "</span>" +
      "</div></div>";
  }

  // ---------------- Offline-Faehigkeit ----------------
  // Ohne Service Worker laedt die Seite bei komplett fehlendem Netz oft gar
  // nicht erst (GitHub Pages cached Assets nur 10 Min. im Browser-HTTP-Cache).
  // Der Worker haelt HTML/CSS/JS/Daten dauerhaft im Cache Storage.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  // ---------------- Start ----------------
  initNav();
  initErfassen();
  loadData().then(function (data) {
    renderHeute(data);
    renderReiseStatus(data);
    renderLetzteAusgaben(data);
    renderAusgaben(data);
    renderPlan(data);
    renderMehr(data);
  }).catch(function () {
    document.getElementById("header-subline").textContent = "Daten konnten nicht geladen werden.";
    var banner = document.getElementById("offline-banner");
    banner.textContent = "Daten konnten nicht geladen werden – bitte mit Netz einmal neu laden.";
    banner.classList.add("show");
  });

  window.addEventListener("hashchange", function () {
    showView(location.hash.replace("#", "") || "home");
  });
})();
