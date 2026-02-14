// ---- Data source ----
// Option A (default): local CSV file in this repo
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKXn9XNnhSp0aj8M0cjleJxy8CoLFUvlU3SJxDMvGWa9rcH1r38_YQE9a86twDKJqU0lu-iaeELYYZ/pub?gid=416213007&single=true&output=csv";

// Option B: Google Sheets published CSV (recommended for always-up-to-date)
// 1) In Google Sheets: File -> Share -> Publish to web -> choose your LONG tab -> CSV
// 2) Paste the published CSV URL here and comment out Option A above.
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKXn9XNnhSp0aj8M0cjleJxy8CoLFUvlU3SJxDMvGWa9rcH1r38_YQE9a86twDKJqU0lu-iaeELYYZ/pub?gid=416213007&single=true&output=csv";

let table = null;

function uniqSorted(arr) {
  return [...new Set(arr.filter(v => v !== null && v !== undefined && String(v).trim() !== ""))]
    .map(v => String(v))
    .sort((a,b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
}

function setSelectOptions(selectEl, options, placeholder="All") {
  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    selectEl.appendChild(opt);
  }
}

function renderStatus(msg, isError=false) {
  const el = document.getElementById("status");
  el.className = isError ? "note error" : "note";
  el.textContent = msg || "";
}

function loadCsvAndRender() {
  renderStatus("Loading CSV…");

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
      if (results.errors && results.errors.length) {
        console.error(results.errors);
        renderStatus("CSV parsed with errors. Check console.", true);
      } else {
        renderStatus("");
      }

      const rows = results.data
        .filter(r => r.Player && r.Game);

      // Determine columns from header
      const allCols = results.meta.fields || Object.keys(rows[0] || {});
      const cols = allCols.filter(c => c && !String(c).startsWith("Unnamed"));

      // Build filters
      const players = uniqSorted(rows.map(r => r.Player));
      const games = uniqSorted(rows.map(r => r.Game));

      setSelectOptions(document.getElementById("playerFilter"), players, "All players");
      setSelectOptions(document.getElementById("gameFilter"), games, "All games");

      // Stat focus: everything except Player/Game (keep those always visible)
      const statCols = cols.filter(c => !["Player","Game"].includes(c));
      setSelectOptions(document.getElementById("statFocus"), ["All (show every stat)", ...statCols], "All (show every stat)");

      // Build table columns for DataTables
      const dtCols = cols.map(c => ({
        title: c,
        data: c,
        defaultContent: ""
      }));

      // Destroy existing table
      if (table) {
        table.destroy();
        document.querySelector("#statsTable").innerHTML = "";
      }

      // Create header dynamically
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      for (const c of cols) {
        const th = document.createElement("th");
        th.textContent = c;
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      document.querySelector("#statsTable").appendChild(thead);

      table = $("#statsTable").DataTable({
        data: rows,
        columns: dtCols,
        pageLength: 25,
        order: [[0, "asc"], [1, "asc"]],
        dom: "Bfrtip",
        buttons: [
          { extend: "csvHtml5", title: "player_game_stats" }
        ]
      });

      // Wire filters
      const playerFilter = document.getElementById("playerFilter");
      const gameFilter = document.getElementById("gameFilter");
      const quickSearch = document.getElementById("quickSearch");
      const statFocus = document.getElementById("statFocus");

      function applyFilters() {
        // column 0 = Player, column 1 = Game
        const p = playerFilter.value;
        const g = gameFilter.value;

        table.column(0).search(p ? `^${escapeRegex(p)}$` : "", true, false);
        table.column(1).search(g ? `^${escapeRegex(g)}$` : "", true, false);
        table.draw();
      }

      playerFilter.onchange = applyFilters;
      gameFilter.onchange = applyFilters;

      quickSearch.oninput = () => table.search(quickSearch.value || "").draw();

      statFocus.onchange = () => {
        const choice = statFocus.value;

        // Always show Player/Game
        const playerIdx = cols.indexOf("Player");
        const gameIdx = cols.indexOf("Game");

        // If "All (show every stat)" or blank -> show all columns
        if (!choice || choice.startsWith("All")) {
          for (let i = 0; i < cols.length; i++) table.column(i).visible(true);
        } else {
          for (let i = 0; i < cols.length; i++) {
            const colName = cols[i];
            const keep = (i === playerIdx) || (i === gameIdx) || (colName === choice);
            table.column(i).visible(keep);
          }
        }
        table.columns.adjust().draw(false);
      };

      // Last loaded pill
      const d = new Date();
      document.getElementById("lastLoaded").textContent = "Loaded " + d.toLocaleString();

    },
    error: (err) => {
      console.error(err);
      renderStatus("Failed to load CSV. If hosting on GitHub Pages, make sure the CSV is in /data and spelled correctly.", true);
    }
  });
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

loadCsvAndRender();
