import { chromium } from 'playwright';

const TARGET_URL = 'https://iesco.com.pk/tariff-guide';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== IESCO TARIFF PAGE — DOM INSPECTION REPORT ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 2000 } });
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${TARGET_URL} ...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Page loaded.\n');

    // 1. Confirm the page contains the residential tariff heading
    const pageText = await page.locator('body').innerText();
    const hasResidential = /A-1 GENERAL SUPPLY TARIFF\s*[-–]\s*RESIDENTIAL/i.test(pageText);
    console.log(`1) CONFIRMED: "A-1 GENERAL SUPPLY TARIFF - RESIDENTIAL" present: ${hasResidential}\n`);

    // 2. Locate the residential heading element
    const residentialHeading = page.locator('h1, h2, h3, h4, h5, h6, .custom-header, strong', { hasText: /A-1 GENERAL SUPPLY TARIFF/i }).first();
    const resHeadingTag = await residentialHeading.evaluate(el => ({
      tagName: el.tagName,
      classes: Array.from(el.classList).join(' '),
      id: el.id,
      text: el.textContent.trim().replace(/\s+/g, ' '),
      outerHTML: el.outerHTML.substring(0, 500)
    }));
    console.log('2) RESIDENTIAL HEADING:');
    console.log(JSON.stringify(resHeadingTag, null, 2));
    console.log();

    // 3 & 4. Find Protected and Un-Protected headings
    const protectedHeading = page.locator('h1, h2, h3, h4, h5, h6, th, td, div, strong, span', { hasText: /^Protected$/i }).first();
    const unProtectedHeading = page.locator('h1, h2, h3, h4, h5, h6, th, td, div, strong, span', { hasText: /^Un-?Protected$/i }).first();

    for (const [label, loc] of [['Protected', protectedHeading], ['Un-Protected', unProtectedHeading]]) {
      const exists = await loc.count();
      if (exists === 0) {
        console.log(`${label}: NOT FOUND via direct text match`);
        // Try broader search
        const broader = page.locator(':is(h1,h2,h3,h4,h5,h6,th,td,div,strong,span):has-text("Protected")');
        const count = await broader.count();
        console.log(`  Broader "Protected" elements found: ${count}`);
        for (let i = 0; i < count; i++) {
          const t = await broader.nth(i).textContent();
          console.log(`  [${i}] "${t.trim().substring(0, 100)}"`);
        }
      } else {
        const el = await loc.evaluate(el => ({
          tagName: el.tagName,
          classes: Array.from(el.classList).join(' '),
          id: el.id,
          text: el.textContent.trim().replace(/\s+/g, ' '),
          parentTag: el.parentElement?.tagName || null,
          outerHTML: el.outerHTML.substring(0, 500)
        }));
        console.log(`3/4) "${label}" HEADING:`);
        console.log(JSON.stringify(el, null, 2));
        console.log();
      }
    }

    // 5. Locate the tables associated with Protected and Un-Protected
    // First let's find ALL tables on the page and their context
    const allTables = page.locator('table');
    const numTables = await allTables.count();
    console.log(`\nTotal tables found: ${numTables}`);
    console.log();

    // For each table, find its heading/preceding text context
    for (let t = 0; t < numTables; t++) {
      const table = allTables.nth(t);
      const tableInfo = await table.evaluate(el => {
        const prev = el.previousElementSibling;
        const prevText = prev ? (prev.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 120) : '(none)';
        const prevTag = prev ? prev.tagName : 'none';
        const classes = Array.from(el.classList).join(' ');
        const id = el.id;
        // Check for caption
        const caption = el.querySelector('caption');
        const captionText = caption ? caption.textContent.trim().replace(/\s+/g, ' ').substring(0, 120) : '(none)';
        return { index: t, classes, id, previousSibling: { tag: prevTag, text: prevText }, caption: captionText };
      });
      console.log(`Table #${tableInfo.index}: class="${tableInfo.classes}", id="${tableInfo.id}"`);
      console.log(`  Previous sibling: <${tableInfo.prevTag}> "${tableInfo.previousSibling.text}"`);
      console.log(`  Caption: "${tableInfo.caption}"`);
      console.log();
    }

    // Find the Residential Protected table
    // Strategy: find "Protected" text, then walk up to the containing section,
    // then find the table within that section
    const findProtectedTable = async () => {
      // Find all elements containing "Protected" text
      const protectedElements = page.locator(':is(h1,h2,h3,h4,h5,h6,th,td,div,strong,span):has-text("Protected")');
      const count = await protectedElements.count();
      console.log(`\n=== Elements containing "Protected" text (${count} found) ===`);
      for (let i = 0; i < count; i++) {
        const el = protectedElements.nth(i);
        const info = await el.evaluate(el => {
          const text = el.textContent.trim().replace(/\s+/g, ' ').substring(0, 80);
          const tag = el.tagName;
          const cls = Array.from(el.classList).join(' ');
          // Try to find the nearest preceding table
          let walk = el.parentElement;
          let depth = 0;
          let nearbyTable = null;
          while (walk && depth < 10) {
            const tableAbove = walk.querySelector('table');
            if (tableAbove) {
              const tableText = tableAbove.textContent.trim().replace(/\s+/g, ' ').substring(0, 60);
              const tableClass = Array.from(tableAbove.classList).join(' ');
              const tableId = tableAbove.id;
              const caption = tableAbove.querySelector('caption');
              nearbyTable = { tag: tableAbove.tagName, classes: tableClass, id: tableId, caption: caption?.textContent?.trim()?.substring(0, 80) || '(none)', textPreview: tableText };
              break;
            }
            // Also check if this element itself is a th/td inside a table
            if (['TD', 'TH'].includes(tag) && el.closest('table')) {
              const tbl = el.closest('table');
              nearbyTable = { tag: tbl.tagName, classes: Array.from(tbl.classList).join(' '), id: tbl.id, caption: tbl.querySelector('caption')?.textContent?.trim()?.substring(0, 80) || '(none)', textPreview: tbl.textContent.trim().replace(/\s+/g, ' ').substring(0, 60), insideTable: true };
              break;
            }
            walk = walk.parentElement;
            depth++;
          }
          return { i, tag, classes: cls, text, nearbyTable };
        });
        console.log(`  [${info.i}] <${info.tag}> class="${info.classes}" text="${info.text}"`);
        if (info.nearbyTable) {
          console.log(`        → Nearby table: <${info.nearbyTable.tag}> class="${info.nearbyTable.classes}" id="${info.nearbyTable.id}"`);
          console.log(`          caption="${info.nearbyTable.caption}"`);
          console.log(`          preview="${info.nearbyTable.textPreview}"`);
          console.log(`          insideTable=${info.nearbyTable.insideTable}`);
        }
      }
    };
    await findProtectedTable();

    // Now let's do the full table inspection for the residential tariff tables
    // Based on what we find above, inspect each table in detail
    console.log('\n\n=== DETAILED TABLE INSPECTION ===\n');

    for (let t = 0; t < numTables; t++) {
      const table = allTables.nth(t);

      // Get table container context
      const contextInfo = await table.evaluate(el => {
        // Walk up to find section/div container
        let walk = el;
        let sectionHeader = null;
        while (walk) {
          const prev = walk.previousElementSibling;
          if (prev) {
            const text = prev.textContent.trim().replace(/\s+/g, ' ').substring(0, 200);
            const tag = prev.tagName;
            if (text && text.length > 3) {
              sectionHeader = { tag, text };
              break;
            }
          }
          walk = walk.parentElement;
          if (walk && ['SECTION', 'DIV', 'BODY'].includes(walk.tagName)) {
            // Also check if this parent has a preceding header sibling
            const ps = walk.previousElementSibling;
            if (ps) {
              const ptext = ps.textContent.trim().replace(/\s+/g, ' ').substring(0, 200);
              if (ptext && ptext.length > 3) {
                sectionHeader = { tag: ps.tagName, text: ptext };
                break;
              }
            }
          }
        }
        return { sectionHeader };
      });

      console.log(`\n----- Table #${t} -----`);
      console.log(`Classes: ${await table.getAttribute('class') || '(none)'}`);
      console.log(`Section context: ${JSON.stringify(contextInfo.sectionHeader)}`);

      // Get table structure
      const tableStruct = await table.evaluate(el => {
        // Get all header cells (th)
        const headers = Array.from(el.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td'));
        // Get all data rows (tbody tr, or all tr except header if no thead)
        let rows;
        const tbody = el.querySelector('tbody');
        if (tbody) {
          rows = Array.from(tbody.querySelectorAll('tr'));
        } else {
          // No tbody — skip first row (header) and get rest
          const allRows = Array.from(el.querySelectorAll('tr'));
          rows = allRows.slice(1);
        }

        // If no rows at all, try the whole table as data rows
        if (rows.length === 0) {
          rows = Array.from(el.querySelectorAll('tr'));
        }

        return {
          hasThead: !!el.querySelector('thead'),
          hasTbody: !!el.querySelector('tbody'),
          numCols: headers.length || (rows[0] ? rows[0].cells.length : 0),
          headers: headers.map(h => ({
            tag: h.tagName,
            text: h.textContent.trim().replace(/\s+/g, ' '),
            colspan: h.colSpan || 1,
            rowspan: h.rowSpan || 1,
            classes: Array.from(h.classList).join(' '),
            nestedHTML: h.innerHTML.substring(0, 300)
          })),
          numRows: rows.length,
          sampleRows: rows.slice(0, 6).map((r, ri) => ({
            rowIndex: ri,
            cells: Array.from(r.cells).map(c => ({
              tag: c.tagName,
              text: c.textContent.trim().replace(/\s+/g, ' '),
              colspan: c.colSpan || 1,
              rowspan: c.rowSpan || 1,
              classes: Array.from(c.classList).join(' '),
              nested: c.children.length > 0 ? Array.from(c.children).map(ch => ch.tagName).join(', ') : '(none)'
            }))
          }))
        };
      });

      console.log(`Has thead: ${tableStruct.hasThead}, Has tbody: ${tableStruct.hasTbody}`);
      console.log(`Headers (${tableStruct.headers.length}):`);
      tableStruct.headers.forEach((h, i) => {
        console.log(`  [${i}] <${h.tag}> colspan=${h.colspan} rowspan=${h.rowspan} class="${h.classes}"`);
        console.log(`       text: "${h.text}"`);
        if (h.nestedHTML.length > 50) {
          console.log(`       nested: ${h.nestedHTML.substring(0, 200)}`);
        }
      });

      console.log(`\nSample rows (${Math.min(tableStruct.sampleRows.length, tableStruct.numRows)} of ${tableStruct.numRows}):`);
      for (const row of tableStruct.sampleRows) {
        console.log(`  Row #${row.rowIndex} (${row.cells.length} cells):`);
        row.cells.forEach((c, ci) => {
          console.log(`    [${ci}] <${c.tag}> cs=${c.colspan} rs=${c.rowspan} class="${c.classes}" nested:${c.nested}`);
          console.log(`           text: "${c.text}"`);
        });
        console.log();
      }
    }

    console.log('\n=== INSPECTION COMPLETE ===\n');

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
  } finally {
    await browser.close();
  }
}

main();