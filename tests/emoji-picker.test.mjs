// DailyWizard's emoji picker: every Unicode emoji (no skin-tone variants), in Unicode's groups, with search by name and
// keywords (grow words too: "clone" finds 🌱), and the ones this device's font can't draw left out.
import { fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, dwUnlock, leave } from './lib/helpers.mjs';

export const title = 'DailyWizard: the emoji picker has every emoji';

export async function run(b, BASE) {
    const { results, check } = makeChecker();
    const main = await fresh(b);
    await openSitka(b, main, BASE);
    await loadSingle(b, main, withFloorManager(fixtureDb()));
    const dw = await openTool(b, main, 'DailyWizard');
    await dwBuilding(b, dw, 'B1');
    check('a floor manager unlocks ✏️ edit mode', await dwUnlock(b, dw));
    await b.run(dw, `openTaskEditor('B1'); document.getElementById('emojiCurrentBtn').click();`, { user: true });

    const data = await b.run(dw, `return { cats: EMOJI_CATEGORIES.map(c => c.label), total: EMOJI_CATEGORIES.reduce((n, c) => n + c.items.length, 0),
        tones: EMOJI_CATEGORIES.some(c => c.items.some(([ch]) => /[\\u{1F3FB}-\\u{1F3FF}]/u.test(ch))),
        dupes: (() => { const all = EMOJI_CATEGORIES.flatMap(c => c.items.map(i => i[0])); return all.length - new Set(all).size; })() };`);
    check('nine tabs, in Unicode\'s order', data.cats.join() === 'Smileys,People,Animals & Nature,Food & Drink,Travel & Places,Activities,Objects,Symbols,Flags', data.cats.join());
    check('every emoji, once each, without the skin-tone variants', data.total > 1900 && !data.tones && data.dupes === 0, JSON.stringify(data));

    const grid = () => b.run(dw, `return { open: document.getElementById('emojiPanel').style.display !== 'none',
        tabs: [...document.querySelectorAll('#emojiTabs .emoji-tab')].map(t => t.textContent),
        cells: [...document.querySelectorAll('#emojiGrid .emoji-cell')].map(c => c.textContent + '=' + c.title),
        probe: emojiProbe !== null };`);
    let g = await grid();
    check('the picker opens on Smileys, with the nine tabs', g.open && g.tabs.length === 9 && g.cells[0] === '😀=grinning face', JSON.stringify(g.cells.slice(0, 2)));
    check('this browser can be checked for the emoji it draws (😀 passes)', g.probe);

    // The emoji this device can't draw are left out: a made-up one (a sequence no font has) is never drawable
    check('a sequence no font knows is left out', await b.run(dw, `return emojiDrawable('😀') && !emojiDrawable('🌱\\u200D🍕');`));
    // Old symbols a browser draws plain (Firefox on a Mac: ♀️ ♂️ ⚕️ in the text colour) still show
    check('old symbols drawn plain still show (♀️ ♂️ ⚕️ ☺️ ✂️)', await b.run(dw, `return ['♀️', '♂️', '⚕️', '☺️', '✂️'].every(emojiDrawable);`));
    const checked = await b.run(dw, `const t0 = performance.now(); let shown = 0;
        for (const c of EMOJI_CATEGORIES) for (const [ch] of c.items) if (emojiDrawable(ch)) shown++;
        return { shown, ms: Math.round(performance.now() - t0) };`);
    check('almost every emoji shows in this browser', checked.shown > 1850, JSON.stringify(checked));

    await b.run(dw, `document.querySelectorAll('#emojiTabs .emoji-tab')[2].click();`, { user: true });
    g = await grid();
    check('Animals & Nature has 🌱 seedling and 🪴 potted plant', g.cells.includes('🌱=seedling') && g.cells.includes('🪴=potted plant'), g.cells.length);

    // Search across every tab: "clone" finds the seedling (grow words), "gloves" still finds 🧤, "canada" its flag
    const search = async q => {
        await b.run(dw, `const s = document.getElementById('emojiSearch'); s.value = ${JSON.stringify(q)}; s.dispatchEvent(new Event('input'));`);
        return (await grid()).cells.map(c => c.split('=')[0]);
    };
    check('"clone" finds 🌱', (await search('clone')).includes('🌱'));
    check('"veg" finds 🪴 and "bloom" 🌸', (await search('veg')).includes('🪴') && (await search('bloom')).includes('🌸'));
    check('the old keywords still work: "gloves" finds 🧤', (await search('gloves')).includes('🧤'));
    check('"canada" finds 🇨🇦', (await search('canada')).includes('🇨🇦'));
    check('nothing matches "zzqx": it says so', (await search('zzqx')).length === 0 &&
        (await b.run(dw, `return document.getElementById('emojiGrid').textContent.includes('No matching emoji');`)));

    await search('clone');
    await b.run(dw, `[...document.querySelectorAll('#emojiGrid .emoji-cell')].find(c => c.textContent === '🌱').click();`, { user: true });
    g = await grid();
    check('picking 🌱 fills the field and closes the panel', !g.open && (await b.run(dw, `return document.getElementById('emojiCurrentBtn').textContent;`)) === '🌱');

    // SitkaTools keeps the answers while it's open: DailyWizard opened again doesn't check again
    await b.run(main, `Tools.close();`);
    const kept = await b.run(main, `return DailyWizardKept.emoji.size;`);
    check('the answers stay with SitkaTools when DailyWizard closes', kept >= 1923, kept);
    const dw2 = await openTool(b, main, 'DailyWizard');
    const again = await b.run(dw2, `const t0 = performance.now(); for (const c of EMOJI_CATEGORIES) for (const [ch] of c.items) emojiDrawable(ch);
        return { size: DailyWizardKept.emoji.size, ms: Math.round(performance.now() - t0) };`);
    check('opened again, no emoji is checked twice', again.size === kept, JSON.stringify(again));

    await leave(b, main);
    return results;
}
