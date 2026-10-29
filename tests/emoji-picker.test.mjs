// DailyWizard's emoji picker: every Unicode emoji (no skin-tone variants), in Unicode's groups, with search by name and
// keywords (grow words too: "clone" finds 🌱), and the ones this device's font can't draw left out. GeneralEvent (＋ More…
// by its quick picks) and CropLabourWizard's recipe editor (▾ by each task's emoji box) have the same picker (EmojiKit).
import { fixtureDb, withFloorManager, makeChecker, fresh, openSitka, loadSingle, openTool, dwBuilding, dwUnlock, leave } from './lib/helpers.mjs';

export const title = 'The emoji picker has every emoji (DailyWizard, GeneralEvent, recipe editor)';

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
        probe: EmojiKit.probe() !== null };`);
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
    const kept = await b.run(main, `return EmojiKit.ok.size;`);
    check('the answers stay with SitkaTools when DailyWizard closes', kept >= 1923, kept);
    const dw2 = await openTool(b, main, 'DailyWizard');
    const again = await b.run(dw2, `const t0 = performance.now(); for (const c of EMOJI_CATEGORIES) for (const [ch] of c.items) emojiDrawable(ch);
        return { size: EmojiKit.ok.size, ms: Math.round(performance.now() - t0) };`);
    check('opened again, no emoji is checked twice', again.size === kept, JSON.stringify(again));

    // ---- GeneralEvent: ＋ More… next to the twelve quick picks ----
    await b.run(main, `Tools.close();`);
    const ge = await openTool(b, main, 'GeneralEvent');
    const gePanel = () => b.run(ge, `return { open: document.getElementById('emojiPanel').style.display !== 'none', tabs: document.querySelectorAll('#emojiTabs .emoji-tab').length,
        cells: document.querySelectorAll('#emojiGrid .emoji-cell').length, picked: document.querySelector('#emojiRow .emoji-btn.selected')?.dataset.emoji || null,
        quick: document.querySelectorAll('#emojiRow .emoji-btn[data-emoji]:not(.custom)').length };`);
    let gp = await gePanel();
    check('GeneralEvent keeps its twelve quick picks, 📌 picked', gp.quick === 12 && gp.picked === '📌' && !gp.open, JSON.stringify(gp));
    await b.run(ge, `document.getElementById('emojiMoreBtn').click();`, { user: true });
    gp = await gePanel();
    check('…＋ More… opens every emoji, in the nine groups', gp.open && gp.tabs === 9 && gp.cells > 50, JSON.stringify(gp));
    await b.run(ge, `document.getElementById('eventText').click();`, { user: true });
    check('…a click outside closes it', !(await gePanel()).open);
    await b.run(ge, `document.getElementById('emojiMoreBtn').click();`, { user: true });
    await b.run(ge, `const s = document.getElementById('emojiSearch'); s.value = 'canada'; s.dispatchEvent(new Event('input'));
        [...document.querySelectorAll('#emojiGrid .emoji-cell')].find(c => c.textContent === '🇨🇦').click();`, { user: true });
    gp = await gePanel();
    check('…picking 🇨🇦 closes it and picks it, on a button of its own', !gp.open && gp.picked === '🇨🇦', JSON.stringify(gp));
    await b.run(ge, `document.getElementById('eventText').value = 'Canada Day prep'; document.getElementById('eventDate').value = localTodayForTest();
        document.getElementById('eventForm').requestSubmit();`.replace('localTodayForTest()', 'todayStr()'), { user: true });
    const made = await b.run(ge, `const ev = DB.data.calendarEvents.filter(e => e.sourceTool === 'GeneralEvent').pop(); return { title: ev.title, split: EmojiKit.split(ev.title) };`);
    check('…the event is titled with it, and splits back into 🇨🇦 and its text', made.title === '🇨🇦 Canada Day prep' && made.split?.emoji === '🇨🇦' && made.split.text === 'Canada Day prep', JSON.stringify(made));
    gp = await gePanel();
    check('…then the form goes back to 📌 and the extra button goes', gp.picked === '📌' && !(await b.run(ge, `return !!document.querySelector('#emojiRow .emoji-btn.custom');`)), JSON.stringify(gp));
    check('a whole emoji is split off a title: people joined with ZWJ, a keycap, a skin tone',
        await b.run(ge, `return [['🧑‍🌾 Harvest crew', '🧑‍🌾'], ['#️⃣ Count', '#️⃣'], ['👍🏽 Done', '👍🏽'], ['📌 Plain', '📌']].every(([t, e]) => EmojiKit.split(t)?.emoji === e) && EmojiKit.split('2 plants') === null;`));

    // ---- CropLabourWizard's recipe editor: ▾ by each task's emoji box ----
    await b.run(main, `Tools.close();`);
    const clw = await openTool(b, main, 'CropLabourWizard');
    await b.run(clw, `openRecipeManager(); document.getElementById('recipeNewBtn').click();`, { user: true });
    const rp = () => b.run(clw, `const p = document.getElementById('recipeEmojiPanel'), r = p.getBoundingClientRect();
        return { open: p.style.display !== 'none', tabs: document.querySelectorAll('#recipeEmojiTabs .emoji-tab').length, inside: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0,
            first: document.querySelector('#recipeTaskBody tr input.t-emoji')?.value };`);
    await b.run(clw, `document.querySelector('#recipeTaskBody tr .t-emoji-pick').click();`, { user: true });
    let r = await rp();
    check('recipe editor: ▾ by a task\'s emoji opens every emoji next to it, in the window', r.open && r.tabs === 9 && r.inside, JSON.stringify(r));
    await b.run(clw, `const s = document.getElementById('recipeEmojiSearch'); s.value = 'clone'; s.dispatchEvent(new Event('input'));
        [...document.querySelectorAll('#recipeEmojiGrid .emoji-cell')].find(c => c.textContent === '🌱').click();`, { user: true });
    r = await rp();
    check('…picking 🌱 fills that task\'s emoji and closes it', !r.open && r.first === '🌱' && (await b.run(clw, `return readTaskTable()[0].emoji;`)) === '🌱', JSON.stringify(r));
    await b.run(clw, `document.querySelectorAll('#recipeTaskBody tr .t-emoji-pick')[1].click();`, { user: true });
    await b.run(clw, `document.querySelectorAll('#recipeTaskBody tr .t-emoji-pick')[1].click();`, { user: true });
    check('…▾ again closes it', !(await rp()).open);
    await b.run(clw, `const box = document.querySelectorAll('#recipeTaskBody tr input.t-emoji')[1]; box.value = '🧪'; box.dispatchEvent(new Event('input', { bubbles: true }));`);
    check('…and an emoji can still be typed in the box', (await b.run(clw, `return readTaskTable()[1].emoji;`)) === '🧪');
    await b.run(main, `Tools.close();`);

    await leave(b, main);
    return results;
}
