// Run against a local server only. Supply Playwright's installed module path.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require(process.env.RAVO_PLAYWRIGHT_PATH || 'playwright');
const { io } = require('socket.io-client');
const assert = require('node:assert/strict');
const base = process.env.RAVO_TEST_URL || 'http://localhost:3101';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Local test server required');
const widths = [{width:360,height:800},{width:390,height:844},{width:430,height:932},{width:844,height:390}];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const sockets = [];
  let layouts = 0;
  try {
    const context = await browser.newContext({viewport:widths[0],isMobile:true,hasTouch:true});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function layout() {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page horizontal overflow');
      layouts++;
    }
    for (const path of ['/', '/create', '/join']) {
      await page.goto(base + path);
      for (const viewport of widths) { await page.setViewportSize(viewport); await layout(); }
    }
    for (const count of [2,8]) {
      await page.goto(base + '/create');
      await page.locator('input').fill('Mobile Host');
      await page.locator('form button[type=submit]').click();
      const codeLocator = page.locator('header strong');
      await codeLocator.waitFor();
      const roomCode = (await codeLocator.innerText()).trim();
      let state;
      const hands = new Map();
      const bots = [];
      for (let index=1; index<count; index++) {
        const socket = io(base); sockets.push(socket); bots.push(socket);
        socket.on('game:state', data => { state = data.room; hands.set(socket.id, data.hand); });
        socket.on('game:started', data => { state = data.room; hands.set(socket.id, data.hand); });
        await new Promise(resolve => socket.on('connect',resolve));
        const joined = await socket.emitWithAck('room:join',{roomCode, playerName:'Test '+index});
        assert(joined.ok, JSON.stringify(joined));
      }
      for (const viewport of widths) { await page.setViewportSize(viewport); await layout(); }
      await page.getByRole('button',{name:/^(Spiel starten|Start Game)$/}).click();
      await page.locator('.mobile-game').waitFor();
      await pause(200);
      const hostId = state.hostId;
      async function hostTurn() {
        while (state.currentTurnPlayerId !== hostId) {
          const bot = bots.find(socket => socket.id === state.currentTurnPlayerId);
          assert(bot, 'current bot');
          const result = await bot.emitWithAck('game:draw-card');
          assert(result.ok, JSON.stringify(result));
          await pause(30);
        }
      }
      for (const large of [false,true]) {
        if (large) {
          for (let n=0;n<(count===2?12:2);n++) {
            await hostTurn();
            await page.locator('.mobile-actions').getByRole('button',{name:/^(Karte ziehen|Draw card)$/i}).click();
            await pause(720);
          }
        }
        for (const viewport of widths) {
          await page.setViewportSize(viewport);
          for (const language of ['de','en']) {
            await page.locator('.mobile-game header button').click();
            await page.getByRole('dialog').getByRole('button',{name:language==='de'?/Deutsch|German/:/English|Englisch/}).click();
            for (const size of ['auto','compact','large']) {
              const position = ['auto','compact','large'].indexOf(size);
              await page.locator('[role=dialog] .view-size-picker button').nth(position).click();
              await page.waitForFunction(size => document.documentElement.dataset.viewSize===size,size);
              await layout();
            }
            await page.getByRole('dialog').getByRole('button',{name:/^(Schließen|Close)$/}).click();
            await layout();
          }
        }
        await page.setViewportSize(widths[0]);
        const strip = page.locator('.mobile-hand-scroll');
        await strip.scrollIntoViewIfNeeded();
        const rect = await strip.boundingBox();
        const cdp = await context.newCDPSession(page);
        const before = await strip.locator('button').count();
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width-15,y:rect.y+40}]});
        for(let n=1;n<=8;n++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+rect.width-15-n*25,y:rect.y+40}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await pause(300);
        assert(await strip.evaluate(element => element.scrollLeft > 0),'touch swipe scrolls hand');
        assert.equal(await strip.locator('button').count(),before,'swipe must not play');
        await strip.locator('button').last().scrollIntoViewIfNeeded();
        assert(await strip.locator('button').last().isVisible());
        await cdp.detach();
      }
      await hostTurn();
      await page.locator('.mobile-hand-scroll button').first().click();
      await page.locator('.mobile-actions').getByRole('button',{name:/^(Play|Spielen)/}).click();
      await pause(150);
      assert.equal(state.status,'challenge');
      const caller = bots[0];
      const called = await caller.emitWithAck('game:call-ravo');
      assert(called.ok,JSON.stringify(called));
      await pause(4000);
      if (state.status === 'bluff-extra') await page.locator('.mobile-game').getByRole('button',{name:/End bonus|Bonus beenden/}).click();
      if (state.currentTurnPlayerId === hostId) await page.locator('.mobile-actions').getByRole('button',{name:/^(Karte ziehen|Draw card)$/i}).click();
      await pause(720);
      const playingBot = bots.find(socket => socket.id === state.currentTurnPlayerId);
      assert((await playingBot.emitWithAck('game:play-card',{cardId:hands.get(playingBot.id)[0].id})).ok);
      await page.locator('.mobile-game').getByRole('button',{name:'RAVO!',exact:true}).click();
      await pause(4000);
      assert(state.lastRevealCallers.includes('Mobile Host'),'mobile Ravo caller recorded');
      await page.locator('.mobile-game summary').filter({hasText:'Chat'}).click();
      await page.locator('.mobile-game form input').fill('Mobile chat test');
      await page.locator('.mobile-game form button').click();
      await page.locator('.mobile-messages').getByText('Mobile chat test',{exact:false}).waitFor();
      await page.screenshot({path:process.env.TEMP+'/ravo-mobile-'+count+'.png',fullPage:true});
      await page.evaluate(() => scrollTo(0,0));
      await page.mouse.move(180,400);
      await page.mouse.wheel(0,500);
      await pause(300);
      assert(await page.evaluate(() => scrollY > 0),'page scrolls vertically');
      bots.forEach(socket => socket.disconnect());
      console.log('Verified gameplay, swipe, chat, layouts for',count,'players');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS',layouts,'layout assertions. Touch emulation, not a physical device.');
  } finally { sockets.forEach(socket => socket.disconnect()); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
