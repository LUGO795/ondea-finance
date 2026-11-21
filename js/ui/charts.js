/* ==========================================================================
   Ondea Finance — Graphiques SVG natifs (barres, courbes, anneau, sparkline)
   Animés, thémables (variables CSS), avec infobulles et tableau alternatif
   pour les lecteurs d'écran.
   ========================================================================== */
(function (O) {
  'use strict';
  const U = O.U;
  const C = {};

  const niceMax = (v) => {
    if (v <= 0) return 0;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  };
  /** Échelle « ronde » : 4 intervalles de pas régulier incluant 0 */
  const scale = (vals) => {
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    if (hi === lo) hi = lo + 100000;
    const step = niceMax((hi - lo) / 4);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    if (hi === lo) hi = lo + step;
    return { min: lo, max: hi, step };
  };
  const srTable = (caption, head, rows) =>
    '<table class="sr-only"><caption>' + U.esc(caption) + '</caption><thead><tr>' + head.map((h) => '<th scope="col">' + U.esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((c, i) => (i ? '<td>' : '<th scope="row">') + U.esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</tbody></table>';

  /** Barres groupées + courbe optionnelle (axe commun) */
  C.bars = (o) => {
    const W = 760, H = o.height || 290, pl = 64, pr = 14, pt = 16, pb = 34;
    const iw = W - pl - pr, ih = H - pt - pb;
    const all = [];
    o.series.forEach((s) => all.push(...s.values));
    if (o.line) all.push(...o.line.values);
    const sc = scale(all), min = sc.min, max = sc.max, ticks = Math.round((max - min) / sc.step);
    const y = (v) => pt + ih - ((v - min) / (max - min)) * ih;
    const n = o.labels.length, gw = iw / n, bw = Math.min(26, (gw * 0.72) / o.series.length);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(o.title || 'Graphique') + '">';
    for (let i = 0; i <= ticks; i++) {
      const v = min + sc.step * i, yy = y(v);
      svg += '<line class="grid-line" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '"/>';
      svg += '<text class="axis-label" x="' + (pl - 10) + '" y="' + (yy + 4) + '" text-anchor="end">' + U.esc(U.moneyShort(v)) + '</text>';
    }
    if (min < 0) svg += '<line class="zero-line" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    o.labels.forEach((lab, i) => {
      const gx = pl + gw * i + (gw - bw * o.series.length) / 2;
      o.series.forEach((s, si) => {
        const v = s.values[i], y0 = y(0), yv = y(v);
        const top = Math.min(y0, yv), h = Math.max(1, Math.abs(y0 - yv));
        svg += '<rect class="bar" x="' + (gx + si * bw + 1) + '" y="' + top + '" width="' + (bw - 2) + '" height="' + h + '" rx="5" style="fill:' + s.color + ';animation-delay:' + (i * 0.035) + 's" data-tip="' + U.esc('<span class="muted">' + U.esc(lab) + '</span><br>' + U.esc(s.name) + ' : <b>' + U.esc(U.money(v)) + '</b>') + '"/>';
      });
      if (n <= 14 || i % 2 === 0) svg += '<text class="axis-label" x="' + (pl + gw * i + gw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + U.esc(lab) + '</text>';
    });
    if (o.line) {
      const pts = o.line.values.map((v, i) => [pl + gw * i + gw / 2, y(v)]);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      svg += '<path class="line-path" d="' + d + '" pathLength="1000" style="--len:1000;stroke:' + o.line.color + '"/>';
      pts.forEach((p, i) => { svg += '<circle class="pt" cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" style="fill:var(--surface);stroke:' + o.line.color + ';stroke-width:2.5" data-tip="' + U.esc('<span class="muted">' + U.esc(o.labels[i]) + '</span><br>' + U.esc(o.line.name) + ' : <b>' + U.esc(U.money(o.line.values[i])) + '</b>') + '"/>'; });
    }
    svg += '</svg>';
    const legend = '<div class="legend">' + o.series.map((s) => '<span><i style="background:' + s.color + '"></i>' + U.esc(s.name) + '</span>').join('') + (o.line ? '<span><i style="background:' + o.line.color + ';height:4px"></i>' + U.esc(o.line.name) + '</span>' : '') + '</div>';
    const head = ['Période'].concat(o.series.map((s) => s.name), o.line ? [o.line.name] : []);
    const rows = o.labels.map((l, i) => [l].concat(o.series.map((s) => U.money(s.values[i])), o.line ? [U.money(o.line.values[i])] : []));
    return '<div class="chart">' + svg + legend + srTable(o.title || 'Données du graphique', head, rows) + '</div>';
  };

  /** Courbe avec aire (prévisions) */
  C.line = (o) => {
    const W = 760, H = o.height || 260, pl = 64, pr = 14, pt = 16, pb = 34;
    const iw = W - pl - pr, ih = H - pt - pb, vals = o.points.map((p) => p.value);
    const sc = scale(vals), min = sc.min, max = sc.max, ticks = Math.round((max - min) / sc.step);
    const x = (i) => pl + (iw * i) / Math.max(1, o.points.length - 1);
    const y = (v) => pt + ih - ((v - min) / (max - min)) * ih;
    const gid = U.uid('g');
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + U.esc(o.title || 'Courbe') + '"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:' + o.color + ';stop-opacity:.35"/><stop offset="1" style="stop-color:' + o.color + ';stop-opacity:0"/></linearGradient></defs>';
    for (let i = 0; i <= ticks; i++) {
      const v = min + sc.step * i, yy = y(v);
      svg += '<line class="grid-line" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '"/><text class="axis-label" x="' + (pl - 10) + '" y="' + (yy + 4) + '" text-anchor="end">' + U.esc(U.moneyShort(v)) + '</text>';
    }
    if (min < 0) svg += '<line class="zero-line" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    const d = o.points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ');
    svg += '<path class="area-path" d="' + d + ' L' + x(o.points.length - 1) + ' ' + y(Math.max(min, 0)) + ' L' + x(0) + ' ' + y(Math.max(min, 0)) + ' Z" fill="url(#' + gid + ')"/>';
    svg += '<path class="line-path" d="' + d + '" pathLength="1000" style="--len:1000;stroke:' + o.color + '"/>';
    const every = Math.max(1, Math.ceil(o.points.length / 8));
    o.points.forEach((p, i) => {
      if (i % every === 0 || i === o.points.length - 1) {
        svg += '<text class="axis-label" x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + U.esc(U.fmtDate(p.date).slice(0, 5)) + '</text>';
      }
      if (i % Math.max(1, Math.ceil(o.points.length / 30)) === 0 || i === o.points.length - 1) {
        svg += '<circle class="pt" cx="' + x(i) + '" cy="' + y(p.value) + '" r="3.5" style="fill:var(--surface);stroke:' + (p.value < 0 ? 'var(--danger)' : o.color) + ';stroke-width:2" data-tip="' + U.esc('<span class="muted">' + U.esc(U.fmtDateLong(p.date)) + '</span><br>Solde prévu : <b>' + U.esc(U.money(p.value)) + '</b>') + '"/>';
      }
    });
    svg += '</svg>';
    const rows = o.points.filter((p, i) => i % 7 === 0).map((p) => [U.fmtDate(p.date), U.money(p.value)]);
    return '<div class="chart">' + svg + srTable(o.title || 'Prévision', ['Date', 'Solde'], rows) + '</div>';
  };

  /** Anneau + légende */
  C.donut = (o) => {
    const items = o.items.filter((i) => i.value > 0);
    const total = U.sum(items, (i) => i.value);
    const R = 80, SW = 26, CIRC = 2 * Math.PI * R;
    let acc = 0;
    let svg = '<svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="' + U.esc(o.title || 'Répartition') + '"><circle cx="100" cy="100" r="' + R + '" fill="none" style="stroke:var(--surface-3)" stroke-width="' + SW + '"/><g transform="rotate(-90 100 100)">';
    items.forEach((it, i) => {
      const frac = total ? it.value / total : 0, len = Math.max(0, frac * CIRC - 2);
      svg += '<circle class="donut-seg" cx="100" cy="100" r="' + R + '" fill="none" stroke="' + it.color + '" stroke-width="' + SW + '" stroke-dasharray="' + len.toFixed(2) + ' ' + CIRC.toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '" style="animation-delay:' + i * 0.06 + 's" data-tip="' + U.esc(U.esc(it.label) + '<br><b>' + U.esc(U.money(it.value)) + '</b> · ' + U.esc(U.pct(frac * 100))) + '"/>';
      acc += frac * CIRC;
    });
    svg += '</g><text x="100" y="94" text-anchor="middle" style="fill:var(--text-2);font-size:12px;font-family:var(--font-body)">' + U.esc(o.centerLabel || 'Total') + '</text>';
    svg += '<text class="donut-center" x="100" y="116" text-anchor="middle" style="fill:var(--text);font-size:17px;font-weight:700">' + U.esc(U.moneyShort(total)) + '</text></svg>';
    const list = '<ul class="donut-list">' + items.slice(0, o.max || 8).map((it) => '<li><i style="background:' + it.color + '"></i><span>' + U.esc(it.label) + '</span><span class="num">' + U.esc(U.money(it.value)) + ' <span class="pct">' + U.esc(U.pct(total ? (it.value / total) * 100 : 0)) + '</span></span></li>').join('') + '</ul>';
    if (!items.length) return '<p class="muted">Aucune donnée sur la période.</p>';
    return '<div class="chart donut-wrap">' + svg + list + '</div>';
  };

  C.spark = (values, color) => {
    if (!values.length) return '';
    const W = 96, H = 30, max = Math.max(...values), min = Math.min(...values), r = max - min || 1;
    const d = values.map((v, i) => (i ? 'L' : 'M') + ((W * i) / Math.max(1, values.length - 1)).toFixed(1) + ' ' + (H - 3 - ((v - min) / r) * (H - 6)).toFixed(1)).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + d + '" fill="none" style="stroke:' + color + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };

  /** Barres horizontales HTML (classements) */
  C.hbars = (items, color) => {
    const max = Math.max(1, ...items.map((i) => i.value));
    return '<ul class="list">' + items.map((it) => '<li style="display:block"><div class="flex between" style="margin-bottom:.35rem"><span class="title">' + U.esc(it.label) + '</span><span class="num">' + U.esc(U.money(it.value)) + '</span></div><div class="progress"><span data-w="' + ((it.value / max) * 100).toFixed(1) + '" style="background:' + (it.color || color || 'var(--gold-2)') + '"></span></div></li>').join('') + '</ul>';
  };

  O.Charts = C;
})(window.Ondea);
