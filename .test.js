module.exports.run = async (page, base, shot) => {
  const out = [];
  await page.waitForFunction(() => document.querySelector('#st-model').textContent === '3 nets ready', {timeout: 120000});
  out.push(['3 models loaded (detector+landmarks+expressions)', true]);
  await page.waitForFunction(() => document.querySelector('#st-ms').textContent !== '-', {timeout: 90000});
  const faces = await page.$eval('#st-faces', e => +e.textContent);
  out.push(['lena sample faces detected: ' + faces, faces >= 1]);
  const rows = await page.$$eval('.frow', r => r.length);
  out.push(['face rows rendered: ' + rows, rows >= 1]);
  const dom = await page.$eval('.frow .meta b', e => e.textContent);
  out.push(['dominant expression label: "' + dom + '"', /(neutral|happy|sad|angry|fearful|disgusted|surprised)\s+\d/.test(dom)]);
  const bars = await page.$$eval('.frow .bar-row', r => r.length);
  out.push(['per-face top-3 bars: ' + bars, bars === 3]);
  const mixRows = await page.$$eval('#mix .bar-row', r => r.length);
  out.push(['mood mix rows (7 emotions): ' + mixRows, mixRows === 7]);
  const domStat = await page.$eval('#st-dom', e => e.textContent);
  out.push(['dominant-now stat: ' + domStat, ['neutral','happy','sad','angry','fearful','disgusted','surprised'].includes(domStat)]);
  // second sample
  await page.click('#sample2');
  await page.waitForFunction(() => document.querySelector('#st-ms').textContent !== '-', {timeout: 60000});
  await new Promise(r=>setTimeout(r,3000));
  const f2 = await page.$eval('#st-faces', e => +e.textContent);
  out.push(['two-people sample faces: ' + f2, f2 >= 2]);
  const rows2 = await page.$$eval('.frow', r => r.length);
  out.push(['two face rows with bars: ' + rows2, rows2 >= 2]);
  if (shot) await page.screenshot({path: shot});
  return out;
};
