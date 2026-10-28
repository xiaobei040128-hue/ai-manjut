import {writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import { expect, test, type Locator, type Page } from "@playwright/test";

async function drag(page: Page, locator: Locator, deltaX: number, deltaY: number, steps = 8) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Drag target has no bounding box");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      startX + (deltaX * step) / steps,
      startY + (deltaY * step) / steps,
    );
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(()=>localStorage.setItem("ai-creator-language-v1","zh-SG"));
  await page.goto("/tests/runtime-fixture.html");
});

test("enrollment first load survives StrictMode cleanup and remains refreshable", async ({ page }) => {
  await page.route("**/api/stage-three/enrollment", async route => {
    await route.fulfill({ json: { eligible: true, enrollment: null } });
  });
  await page.goto("/tests/runtime-fixture.html?fixture=enrollment");
  await expect(page.getByRole("button", { name: "申请报名", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "刷新状态", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "刷新状态", exact: true }).click();
  await expect(page.getByRole("button", { name: "刷新状态", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "申请报名", exact: true })).toBeEnabled();
});

test("task and achievement artwork stay in their reserved positions during entry", async ({ page }) => {
  await page.goto('/tests/runtime-fixture.html?fixture=journey');
  for (const button of ['Show task reward', 'Show completion reward']) {
    await page.getByRole('button', {name:button,exact:true}).click();
    const emblem = page.locator('.j-emblem');
    await expect(emblem).toBeVisible();
    const first = await emblem.boundingBox();
    await page.waitForTimeout(950);
    const settled = await emblem.boundingBox();
    expect(first).not.toBeNull();
    expect(settled).not.toBeNull();
    expect(Math.abs(settled!.y-first!.y)).toBeLessThan(1);
    expect(Math.abs(settled!.height-first!.height)).toBeLessThan(1);
    await page.getByRole('button', {name:'关闭动画提示',exact:true}).click();
  }
});

test("copyright settlement updates in place without reloading or shifting scroll", async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  const task = {id:'qa-task',stage:3,premium:0,title:'QA Story',cover:'/stories/murder-at-30000-feet.webp',genre:'悬疑',description:'用于结算页面稳定性验收的故事简介。'.repeat(15),deposit:20000,commission:700};
  const assignment = {id:'qa-license',owner_id:'qa-owner',status:'active',task};
  await page.route('**/api/stage-finance/license?assignment=*', route => route.fulfill({json:{assignment,code:'QA-CODE'}}));
  await page.route('**/api/stage-finance/license/complete', route => route.fulfill({json:{assignment:{...assignment,status:'completed'},code:'QA-CODE',first:true}}));
  await page.goto('/tests/runtime-fixture.html?fixture=copyright');
  const complete = page.getByRole('button',{name:'复制并完成任务',exact:true});
  await expect(complete).toBeVisible();
  await complete.scrollIntoViewIfNeeded();
  const before = await page.locator('.third-copyright-scroll').evaluate(element=>element.scrollTop);
  const documentStart = await page.evaluate(()=>performance.timeOrigin);
  await complete.click();
  await expect(page.getByRole('heading',{name:'本次版权任务已完成',exact:true,includeHidden:true})).toBeAttached();
  expect(await page.evaluate(()=>performance.timeOrigin)).toBe(documentStart);
  expect(await page.locator('.third-copyright-scroll').evaluate(element=>element.scrollTop)).toBe(before);
});

test("horizontal intent stays in Carousel and cannot create parent momentum", async ({ page }) => {
  const carousel = page.locator(".fixture-carousel");
  const card = page.locator(".carousel-card").nth(1);
  const parent = page.getByTestId("mobile-scroll");

  await expect(carousel).not.toHaveAttribute("data-scroll-drag", "ignore");
  await drag(page, card, -130, 14, 5);

  const afterRelease = await carousel.evaluate((element) => element.scrollLeft);
  expect(afterRelease).toBeGreaterThan(40);
  expect(await parent.evaluate((element) => element.scrollTop)).toBe(0);

  await page.waitForTimeout(250);
  expect(await parent.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await page.getByTestId("tap-count").textContent()).toBe("0");
});

test("vertical intent over a carousel is handed to MobileScroll in both directions", async ({ page }) => {
  const card = page.locator(".carousel-card").nth(1);
  const carousel = page.locator(".fixture-carousel");
  const parent = page.getByTestId("mobile-scroll");

  await drag(page, card, 4, -150);
  expect(await parent.evaluate((element) => element.scrollTop)).toBeGreaterThan(60);
  expect(await carousel.evaluate((element) => element.scrollLeft)).toBe(0);

  await parent.evaluate((element) => {
    element.scrollTop = 80;
  });
  await drag(page, card, -3, 110);
  expect(await parent.evaluate((element) => element.scrollTop)).toBeLessThan(80);
});

test("tap activates a card but a completed drag does not", async ({ page }) => {
  const firstCard = page.locator(".carousel-card").first();
  await firstCard.click();
  await expect(page.getByTestId("tap-count")).toHaveText("1");

  await drag(page, firstCard, -100, 6);
  await expect(page.getByTestId("tap-count")).toHaveText("1");
});

test("Carousel preserves momentum and edge rubber-banding", async ({ page }) => {
  const carousel = page.locator(".fixture-carousel");
  const card = page.locator(".carousel-card").nth(1);

  await drag(page, card, -100, 5, 3);
  const releasedOffset = await carousel.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(120);
  expect(await carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(releasedOffset);

  await carousel.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const box = await card.boundingBox();
  if (!box) throw new Error("Card has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 4 });
  expect(Number(await carousel.getAttribute("data-overscroll"))).toBeGreaterThan(0);
  await page.mouse.up();
  await page.waitForTimeout(900);
  expect(Math.abs(Number(await carousel.getAttribute("data-overscroll")))).toBeLessThan(1);
});

test("BottomSheet remains mounted while its default exit animation plays", async ({ page }) => {
  await page.locator(".sheet-trigger").click();
  await expect(page.getByTestId("bottom-sheet")).toBeVisible();

  await page.getByTestId("sheet-overlay").click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId("bottom-sheet")).toHaveCount(1);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("bottom-sheet")).toHaveCount(0);
});

test("keyboard and its attached footer dismiss on the same transition", async ({ page }) => {
  await page.goto("/tests/runtime-fixture.html?fixture=keyboard");
  const input = page.getByLabel("Message");
  const footer = page.getByTestId("flow-fixed-footer");
  const keyboard = page.getByTestId("keyboard-dock");

  await input.click();
  await expect(keyboard).toHaveAttribute("data-visible", "true");
  await drag(page, footer, 0, 120, 5);
  await expect(keyboard).toHaveAttribute("data-visible", "false");

  await page.waitForTimeout(100);
  const progress = await page.evaluate(() => {
    const footerElement = document.querySelector<HTMLElement>('[data-testid="flow-fixed-footer"]')!;
    const keyboardElement = document.querySelector<HTMLElement>('[data-testid="keyboard-dock"]')!;
    const fullHeight = Number.parseFloat(keyboardElement.style.height);
    const footerRemaining = Number.parseFloat(getComputedStyle(footerElement).bottom);
    const matrix = new DOMMatrixReadOnly(getComputedStyle(keyboardElement).transform);
    return {
      footer: footerRemaining / fullHeight,
      keyboard: 1 - matrix.m42 / fullHeight,
    };
  });
  expect(Math.abs(progress.footer - progress.keyboard)).toBeLessThan(0.18);

  await page.waitForTimeout(300);
  expect(await footer.evaluate((element) => getComputedStyle(element).bottom)).toBe("34px");
});

test("switching to Pixel keeps the composer above Android navigation", async ({ page }) => {
  await page.goto("/tests/runtime-fixture.html?fixture=keyboard");
  const input = page.getByLabel("Message");
  await input.evaluate((element: HTMLInputElement) => {
    element.value = "Draft message";
  });

  await page.getByTestId("device-picker").click();
  await page.getByTestId("device-option-pixel-10").click();

  const frame = page.getByTestId("phone-frame");
  const screen = page.getByTestId("device-screen");
  const statusIndicators = page.getByTestId("status-indicators");
  const navigation = page.getByTestId("android-navigation-bar");
  const footer = page.getByTestId("flow-fixed-footer");

  await expect(frame).toHaveAttribute("data-device", "pixel-10");
  await expect(screen).toHaveAttribute("data-device", "pixel-10");
  await expect(page.locator(".phone-bezel")).toHaveAttribute(
    "src",
    "/assets/android/Pixel10.png",
  );
  await expect(statusIndicators).toHaveAttribute("data-platform", "android");
  await expect(statusIndicators).toHaveAttribute(
    "src",
    "/assets/status/status-icons.svg",
  );
  await expect(navigation).toBeVisible();
  await expect(page.getByTestId("home-indicator")).toHaveCount(0);
  await expect(input).toHaveValue("Draft message");
  await page.waitForTimeout(300);

  const layout = await page.evaluate(() => {
    const footerElement = document.querySelector<HTMLElement>(
      '[data-testid="flow-fixed-footer"]',
    )!;
    const navigationElement = document.querySelector<HTMLElement>(
      '[data-testid="android-navigation-bar"]',
    )!;
    const appViewportElement = document.querySelector<HTMLElement>(
      '[data-testid="mobile-app-viewport"]',
    )!;
    return {
      footerBottom: footerElement.getBoundingClientRect().bottom,
      appViewportBottom: appViewportElement.getBoundingClientRect().bottom,
      navigationTop: navigationElement.getBoundingClientRect().top,
      navigationHeight: Number.parseFloat(getComputedStyle(navigationElement).height),
      safeAreaBottom: Number.parseFloat(
        getComputedStyle(document.querySelector<HTMLElement>('[data-testid="device-screen"]')!).getPropertyValue(
          "--device-safe-area-bottom",
        ),
      ),
    };
  });

  expect(layout.safeAreaBottom).toBe(layout.navigationHeight);
  expect(Math.abs(layout.appViewportBottom - layout.navigationTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.footerBottom - layout.navigationTop)).toBeLessThanOrEqual(1);

  await input.click();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "true");
  await expect(navigation).toHaveCount(0);
  await page.waitForTimeout(300);

  const keyboardLayout = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]')!;
    const viewport = document.querySelector<HTMLElement>('[data-testid="mobile-app-viewport"]')!;
    const scroll = document.querySelector<HTMLElement>('[data-testid="mobile-scroll"]')!;
    const footerElement = document.querySelector<HTMLElement>('[data-testid="flow-fixed-footer"]')!;
    const keyboard = document.querySelector<HTMLElement>('[data-testid="keyboard-dock"]')!;

    return {
      screenBottom: screen.getBoundingClientRect().bottom,
      viewportBottom: viewport.getBoundingClientRect().bottom,
      scrollBottom: scroll.getBoundingClientRect().bottom,
      footerBottom: footerElement.getBoundingClientRect().bottom,
      keyboardTop: keyboard.getBoundingClientRect().top,
      keyboardBottom: keyboard.getBoundingClientRect().bottom,
    };
  });

  expect(keyboardLayout.viewportBottom).toBeCloseTo(keyboardLayout.screenBottom, 0);
  expect(Math.abs(keyboardLayout.keyboardBottom - keyboardLayout.screenBottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(keyboardLayout.scrollBottom - keyboardLayout.keyboardTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(keyboardLayout.footerBottom - keyboardLayout.keyboardTop)).toBeLessThanOrEqual(1);
});

test("FlowStack pushes and pops screens while dismissing the keyboard", async ({ page }) => {
  await page.goto("/tests/runtime-fixture.html?fixture=flow");
  await page.getByLabel("Flow message").click();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "true");

  await page.getByRole("button", { name: "Push level 2" }).click();
  await expect(page.getByRole("heading", { name: "Screen stacking works" })).toBeVisible();
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute("data-visible", "false");
  const safeHeaderPlacement = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('[data-testid="device-screen"]')!;
    const toolbar = document.querySelector<HTMLElement>(".flow-fixture-header")!;
    return toolbar.getBoundingClientRect().top - screen.getBoundingClientRect().top;
  });
  expect(safeHeaderPlacement).toBeGreaterThanOrEqual(54);

  await page.getByRole("button", { name: "Push level 3" }).click();
  await expect(page.getByRole("heading", { name: "Nested view level 3" })).toBeVisible();
  await page.getByRole("button", { name: "Push level 4" }).click();
  await expect(page.getByRole("heading", { name: "Nested view level 4" })).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Nested view level 3" })).toBeVisible();
  await page.getByRole("button", { name: "‹ Back" }).click();
  await expect(page.getByRole("heading", { name: "Screen stacking works" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Flow root" })).toBeVisible();
});

test("account security sheets remain within small native viewports and clear dismissed secrets", async ({page})=>{
 await page.route('**/api/auth/fund-password',route=>route.fulfill({json:{configured:false}}));
 for(const size of [{width:320,height:568},{width:390,height:844}]){
  await page.setViewportSize(size);
  await page.goto('/tests/runtime-fixture.html?fixture=security');
  await page.getByRole('button',{name:'登录密码 已设置 修改密码'}).click();
  const sheet=page.getByRole('dialog');
  await expect(sheet.getByRole('heading',{name:'修改登录密码'})).toBeVisible();
  await expect(page.getByRole('button',{name:'关闭修改密码'})).toBeFocused();
  await expect(sheet.getByRole('button',{name:'确认修改',exact:true})).toBeInViewport();
  await expect.poll(async()=>{const b=await sheet.boundingBox();return b?b.y+b.height:9999;}).toBeLessThanOrEqual(size.height+1);
  expect((await sheet.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await page.getByRole('button',{name:'关闭修改密码'}).click();
  await page.getByRole('button',{name:'资金密码 未设置 · 提款前需设置 设置'}).click();
  await expect(page.getByRole('button',{name:'关闭资金密码'})).toBeFocused();
  await expect(sheet.getByRole('button',{name:'确认保存',exact:true})).toBeInViewport();
  await sheet.getByLabel('新资金密码',{exact:true}).fill('Disposable-Test-Only');
  await page.getByRole('button',{name:'关闭资金密码'}).click();
  await page.getByRole('button',{name:'资金密码 未设置 · 提款前需设置 设置'}).click();
  await expect(sheet.getByLabel('新资金密码',{exact:true})).toHaveValue('');
  await expect(sheet.getByRole('heading',{name:'设置资金密码'})).toBeInViewport();
  await page.waitForTimeout(700);
  await page.screenshot({path:`work/security-${size.width}.png`});
 }
});




test("temporary audit HTML cannot reload an active preview or clear its input",async({page})=>{
 await page.goto('/tests/runtime-fixture.html?fixture=keyboard');const input=page.getByLabel('Message',{exact:true});await input.fill('keep this draft');let reloads=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())reloads++;});const artifact=resolve('work/preview-watch-'+Date.now()+'.html');try{await writeFile(artifact,'<html>temporary audit artifact</html>');await page.waitForTimeout(1000);await expect(input).toHaveValue('keep this draft');expect(reloads).toBe(0);}finally{await unlink(artifact);}
});
