/* Lake Wallenpaupack map — the fishing sheet. Everything shown comes from fishing.json, which is kept by hand from official sources.
   © 2026 DeWitt Hutchins. All rights reserved. */
export async function initFishing({D, M, openSheet, openPlace, flyTo, esc, panel, chips}){
  let F; try { F = await (await fetch('fishing.json', {cache: 'no-cache'})).json(); } catch(e){ return; }
  const btn = document.getElementById('bFish'); if (!btn || !F.sections) return;
  const css = document.createElement('style');
  css.textContent = `#panel .fi{padding:8px 0;border-bottom:1px solid rgba(141,154,151,.55)}
#panel .fi h3{margin:0;font:600 18px var(--serif)}#panel .fi h3 button{all:unset;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(122,59,46,.5);text-underline-offset:3px}
#panel .fi h3 button:hover{color:#7a3b2e}#panel .fi p{margin:2px 0 0;font-size:15.5px;line-height:1.32}#panel .fi a{color:#7a3b2e}
.chip.fish{display:none}@media(max-width:760px){#bFish{display:none}.chip.fish{display:inline-block}}`;
  document.head.appendChild(css);
  const items = [];
  function sheet(){
    items.length = 0;
    const html = (F.intro ? `<p>${esc(F.intro)}</p>` : '') + F.sections.map(s => `<div class="sec">${esc(s.title)}</div>${s.text ? `<p>${esc(s.text)}</p>` : ''}` +
      (s.items || []).map(it => { const go = it.poi || it.lat != null; if (go) items.push(it);
        return `<div class="fi"><h3>${go ? `<button data-i="${items.length - 1}">${esc(it.n)}</button>` : esc(it.n)}</h3>${it.note ? `<p>${esc(it.note)}</p>` : ''}${it.url ? `<p><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.link || 'More')}</a></p>` : ''}</div>`; }).join('')).join('') +
      `<p class="fine">${esc(F.fine || '')} Checked ${esc(F.updated || '')}.</p>` +
      (F.sources ? `<p class="fine">Sources: ${F.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.n)}</a>`).join(' · ')}</p>` : '');
    openSheet('On the water', 'Fishing', html);
    panel.querySelectorAll('.fi button').forEach(b => b.onclick = () => { const it = items[+b.dataset.i], p = it.poi && D.pois.find(p => p.id === it.poi);
      if (p) return openPlace(p);
      flyTo((it.lon - M.lon0) * M.kx, -(it.lat - M.lat0) * M.kz, it.d || 1800); });
  }
  btn.hidden = false; btn.onclick = sheet;
  const chip = document.createElement('button'); chip.className = 'chip sky fish'; chip.textContent = 'Fishing'; chip.onclick = sheet;   // on a phone the header is full, so it lives with the chips
  chips.insertBefore(chip, chips.querySelector('.chip:not(.sky)'));
  if (new URLSearchParams(location.search).has('fishing')) setTimeout(sheet, 700);
}
