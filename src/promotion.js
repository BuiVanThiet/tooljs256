import Promise from "bluebird";
import puppeteer from "puppeteer-core";
import Hidemyacc from "./hidemyacc.js";
import writeXlsxFile from "write-excel-file/node";
import xlsx from "node-xlsx";
import fs from "fs";
import {
  delay,
  getAllText,
  getElement,
  getElements,
  getRandomIntBetween,
  getText,
} from "./puppeteer.js";
const hide = new Hidemyacc();

const MAX_ROUND = 1;

const schema = [
  {
    column: "Profile name",
    type: String,
    value: (obj) => obj.name,
  },
  {
    column: "Promotion name",
    type: String,
    value: (obj) => obj.promotionName,
  },
  {
    column: "Note",
    type: String,
    value: (obj) => obj.err,
  },
];

let MAX_THREAD = 1;

const setBrowserPosition = (index) => {
  index = parseInt(index);
  if (index >= 0 && index < 4) {
    return `${index * 1200},0`;
  } else if (index >= 4 && index < 8) {
    return `${(index - 4) * 1200},900`;
  } else {
    return `${(index - 8) * 1200},1800`;
  }
};

const checkExistElementOnScreen = async (page, JSpath) => {
  try {
    const result = await page.$eval(JSpath, (el) => {
      if (el.getBoundingClientRect().top <= 0) {
        return false;
      } else if (
        el.getBoundingClientRect().top + el.getBoundingClientRect().height >
        window.innerHeight
      ) {
        return false;
      } else {
        return true;
      }
    });
    return result;
  } catch (error) {
    return error;
  }
};
const scrollSmoothIfNotExistOnScreen = async (page, JSpath) => {
  try {
    if ((await checkExistElementOnScreen(page, JSpath)) !== 0) {
      await page.evaluate((JSpath) => {
        document
          .querySelector(JSpath)
          .scrollIntoView({ behavior: "smooth", block: "center" });
      }, JSpath);
    }
    await delay(2000);
    return true;
  } catch (error) {
    return false;
  }
};

const task = async (data, round, profileId = undefined, index) => {
  let idProfile;
  let page;
  let browser;
  return new Promise(async (resolve, reject) => {
    try {
      round++;

      if (round > MAX_ROUND) {
        resolve(false);
        return;
      } else {
        console.log(`Run ${data.name}\tROUND: ${round}`);
        let success = false;
        idProfile = profileId;

        let start;
        while (!start) {
          start = await hide.start(
            idProfile,
            JSON.stringify({
              params:
                "--force-device-scale-factor=0.4 --window-size=1280,720 --window-position=" +
                setBrowserPosition(index % MAX_THREAD),
            })
          );
          if (!start) {
            await delay(getRandomIntBetween(2000, 5000));
          }
        }

        browser = await puppeteer.connect({
          browserWSEndpoint: start.data.wsUrl.toString(),
          defaultViewport: null,
        });

        const page = await browser.newPage();
        try {
          await page.goto(
            data.type === "FL"
              ? "https://seller-us.tiktok.com/promotion/marketing-tools/flash-sale/create"
              : "https://seller-us.tiktok.com/promotion/marketing-tools/discount/create",
            {
              waitUntil: "networkidle2",
              timeout: 60000,
            }
          );
        } catch (err) {}

        if (page.url().includes("account/register")) {
          try {
            await page.close();
            await delay(1000);
            await browser.close();
          } catch (err) {
            console.log(err);
          }
          await hide.stop(idProfile);
          resolve({ err: "Login error" });
          return;
        }
        for (let j = 0; j < 2; j++) {
          const cancelBtn = await getElement(
            page,
            '[class="theme-arco-icon theme-arco-icon-close "]',
            5
          );
          if (cancelBtn) {
            if (j == 0) {
              const cancel = await getElement(
                page,
                '[class="theme-arco-icon theme-arco-icon-close_small "]',
                1
              );
              if (cancel) {
                await cancel.click();
                await delay(500);
              }
            }
            await cancelBtn.click();
            await delay(500);
          }
        }
        const title = await getElement(
          page,
          data.type === "FL"
            ? '[id="name_input"]'
            : '[id="promotion_name_input"]',
          60
        );
        if (title) {
          await title.type(data.promotionName, { delay: 10 });
          await delay(1000);

          const variations = await getElements(
            page,
            '[class="theme-arco-icon-hover theme-arco-radio-icon-hover theme-arco-radio-mask-wrapper"]'
          );
          if (variations && variations.length > 2) {
            if (data.type !== "FL") {
              await variations[0].click();
              await delay(1000);
            } else {
              await variations[variations.length - 1].click();
              await delay(1000);
            }

            const select = await getElement(
              page,
              '[class="theme-arco-btn theme-arco-btn-secondary theme-arco-btn-size-default theme-arco-btn-shape-square theme-m4b-button"]'
            );
            if (select) {
              await select.click();
              await delay(10000);
              if (!data.selectedIds && data.productID === "") {
                const rows = await getElements(
                  page,
                  '[class="theme-arco-table-tr"]',
                  50
                );
                if (rows && rows.length) {
                  const rowFilter = [];
                  for (let i = 1; i < rows.length; i++) {
                    const text = await getText(page, rows[i]);
                    if (
                      text.includes(data.originalPrice) &&
                      text.includes(data.stock)
                    ) {
                      rowFilter.push(rows[i]);
                    }
                  }

                  const count =
                    rowFilter.length >= data.productsSelected
                      ? data.productsSelected
                      : rowFilter.length;

                  for (let i = 0; i < count; i++) {
                    const btn = await getElement(
                      rowFilter[i],
                      '[class="theme-arco-checkbox"]',
                      2
                    );
                    if (btn) {
                      await btn.click();
                      await delay(500);
                    }
                  }
                }
              } else {
                const input = await getElement(
                  page,
                  '[data-tid="m4b_input_search"]'
                );
                if (input) {
                  await input.type(
                    data.selectedIds && data.selectedIds.length > 0
                      ? data.selectedIds
                      : data.productID
                  );
                  await delay(1000);
                  await page.keyboard.press("Enter");
                  await delay(10000);
                  if (!data.selectedIds || data.selectedIds.length === 0) {
                    const rows = await getElements(
                      page,
                      '[class="theme-arco-table-tr"]',
                      50
                    );
                    if (rows && rows.length > 1) {
                      for (let i = 1; i < rows.length; i++) {
                        const btn = await getElement(
                          rows[i],
                          '[class="theme-arco-checkbox"]',
                          2
                        );
                        if (btn) {
                          await btn.click();
                          await delay(500);
                        }
                      }
                    }
                  } else {
                    const checkboxs = await getElements(
                      page,
                      '[class="theme-arco-checkbox"]',
                      50
                    );
                    if (checkboxs && checkboxs.length) {
                      await checkboxs[0].click();
                      await delay(2000);
                    }
                  }
                }
              }
              const btnDone = await getElement(
                page,
                '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-large theme-arco-btn-shape-square theme-m4b-button"]'
              );
              if (btnDone) {
                await btnDone.click();
                await delay(3000);
              }
            }
            const mores = await getElements(
              page,
              '[class="theme-arco-select-view-value"]'
            );
            if (mores && mores.length) {
              await mores[mores.length - 1].evaluate((b) => b.click());
              await delay(1000);
              const options = await getElements(
                page,
                '[class="theme-arco-select-option"]'
              );
              if (options && options.length) {
                await options[options.length - 1].click();
                await delay(3000);
              }
            }
            const btnCheckbox = await getElement(
              page,
              '[class="theme-arco-icon-hover theme-arco-checkbox-icon-hover theme-arco-checkbox-mask-wrapper"]'
            );
            if (btnCheckbox) {
              await btnCheckbox.evaluate((b) => b.click());
              await delay(1000);

              const btnSelect = await getElement(
                page,
                '[class="theme-arco-select-view-value"]'
              );
              if (btnSelect) {
                await btnSelect.evaluate((b) => b.click());
                await delay(2000);
                const btnPercent = await getElement(
                  page,
                  '[class="theme-arco-select-option theme-m4b-select-option"]'
                );
                if (btnPercent) {
                  await btnPercent.evaluate((b) => b.click());
                  await delay(2000);
                }
              }

              const inputDiscount = await getElement(
                page,
                '[class="theme-arco-input theme-arco-input-size-default"][aria-valuemax="100"]'
              );
              if (inputDiscount) {
                await inputDiscount.type(data.discount);
                await delay(3000);
                const update = await getElement(
                  page,
                  "#ProductScope > div.bg-white.py-16 > div.mt-16.px-12.py-16.bg-neutral-bg2.rounded > div.flex.justify-between.items-end.mt-20 > div.flex.items-center > button:nth-child(1)"
                );
                if (update) {
                  await scrollSmoothIfNotExistOnScreen(
                    page,
                    "#ProductScope > div.bg-white.py-16 > div.mt-16.px-12.py-16.bg-neutral-bg2.rounded > div.flex.justify-between.items-end.mt-20 > div.flex.items-center > button:nth-child(1)"
                  );
                  await update.click();
                  await delay(5000);
                  if (data.type === "FL") {
                    const agrees = await getElements(
                      page,
                      '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-default theme-arco-btn-shape-square theme-m4b-button ml-16"]'
                    );
                    if (agrees && agrees.length > 1) {
                      await agrees[1].click();
                      await delay(7000);
                      success = true;
                    }

                    const allText = await getAllText(page);
                    if (
                      allText.includes(
                        `These products exceed the lowest price in 30 days`
                      )
                    ) {
                      const gotIt = await getElement(
                        page,
                        '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-large theme-arco-btn-shape-square theme-m4b-button"]'
                      );

                      if (gotIt) {
                        await gotIt.evaluate((b) => b.click());
                        await delay(5000);
                      }

                      const agrees = await getElements(
                        page,
                        '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-default theme-arco-btn-shape-square theme-m4b-button ml-16"]'
                      );
                      if (agrees && agrees.length > 1) {
                        await agrees[1].click();
                        await delay(2000);
                      }

                      const rows = await getElements(
                        page,
                        '[class="theme-arco-table-tr theme-arco-table-row-custom-expand styled"]'
                      );

                      if (rows && rows.length) {
                        for (let i = 0; i < rows.length; i++) {
                          const text = await getText(page, rows[i]);
                          if (
                            text.includes(
                              "The Flash sale price must be less than"
                            )
                          ) {
                            const btnSwitch = await getElement(
                              rows[i],
                              '[class="theme-arco-switch theme-arco-switch-type-circle theme-arco-switch-checked theme-m4b-switch"]'
                            );

                            if (btnSwitch) {
                              await btnSwitch.evaluate((b) => b.click());
                              await delay(1000);
                            }
                          }
                        }

                        if (agrees && agrees.length > 1) {
                          await agrees[1].click();
                          await delay(7000);
                        }
                      }
                    }

                    for (let i = 0; i < 5; i++) {
                      const done = await getElement(
                        page,
                        '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-large theme-arco-btn-shape-square theme-m4b-button"]',
                        5
                      );
                      if (done) {
                        await done.click();
                        await delay(10000);
                        break;
                      }
                    }
                    for (let i = 0; i < 5; i++) {
                      const gotIt = await getElement(
                        page,
                        '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-large theme-arco-btn-shape-square"]'
                      );
                      if (gotIt) {
                        await gotIt.click();
                        await delay(5000);
                        success = true;
                        break;
                      }
                    }
                  } else {
                    const agrees = await getElements(
                      page,
                      '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-default theme-arco-btn-shape-square theme-m4b-button"]'
                    );
                    if (agrees && agrees.length > 0) {
                      await agrees[agrees.length - 1].click();
                    }
                    for (let i = 0; i < 5; i++) {
                      await delay(5000);
                      const text = await getAllText(page);
                      if (text.includes("Promotion created")) {
                        success = true;
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        try {
          await page.close();
          await delay(1000);
          await browser.close();
        } catch (err) {
          console.log(err);
        }
        await hide.stop(idProfile);
        resolve(success);
        return;
      }
    } catch (err) {
      try {
        await page.close();
        await delay(1000);
        await browser.close();
      } catch (err) {
        console.log(err);
      }
      console.log(err);
      if (idProfile && idProfile !== "") {
        try {
          await page.close();
          await delay(1000);
          await browser.close();
        } catch (err) {
          console.log(err);
        }
        await hide.stop(idProfile);
        await delay(3000);
      }
      resolve(await task(data, round, idProfile, index));
    }
  })
    .then()
    .catch(async (e) => {
      if (idProfile && idProfile !== "") {
        await hide.stop(idProfile);
        await delay(3000);
      }
      return await task(data, round, profileId, index);
    });
};

const splitToChunks = (array, size) => {
  const results = [];
  for (let i = 0; i < array.length; i += size) {
    results.push(array.slice(i, i + size));
  }
  return results;
};

const splitToUniqueChunks = (array, size) => {
  const results = [];
  let remainingItems = [...array];

  while (remainingItems.length > 0) {
    const usedNames = new Set();
    const currentChunk = [];

    // Tạo một chunk mới từ các phần tử còn lại
    for (
      let i = 0;
      i < remainingItems.length && currentChunk.length < size;
      i++
    ) {
      const item = remainingItems[i];

      // Nếu name chưa được sử dụng trong chunk hiện tại
      if (!usedNames.has(item.name)) {
        currentChunk.push(item);
        usedNames.add(item.name);
        // Xóa phần tử đã được sử dụng khỏi mảng remainingItems
        remainingItems.splice(i, 1);
        i--; // Điều chỉnh index vì mảng đã bị thay đổi
      }
    }

    // Thêm chunk hiện tại vào kết quả
    if (currentChunk.length > 0) {
      results.push(currentChunk);
    }
  }

  return results;
};

(async () => {
  try {
    let thread = 1;
    let threadAvg = process.argv.find((a) => a.startsWith("--thread"));
    if (threadAvg) {
      threadAvg = threadAvg.replace("--thread=", "");
    }

    if (threadAvg) {
      const newThread = parseInt(threadAvg);
      if (!isNaN(newThread)) thread = newThread;
    }
    let profiles;
    while (!profiles) {
      profiles = await hide.profiles();

      if (!profiles) {
        console.log("OPEN HIDEMYACC!!");
        await delay(5000);
      } else {
        profiles = profiles.data;
      }
    }

    const workSheetsFromFile = xlsx.parse(`../PROMOTION.xlsx`);

    const datas = [];
    workSheetsFromFile[0].data.forEach((dataXlsx, index) => {
      if (index > 0 && dataXlsx.length > 1 && dataXlsx[1]) {
        const data = {
          name: dataXlsx[0],
          type: dataXlsx[1].toString().split("-")[0].trim(),
          discount: dataXlsx[1].toString().split("-")[1].trim(),
          productsSelected: dataXlsx[2] ? dataXlsx[2] : 1,
          productID: dataXlsx[3] ? dataXlsx[3].trim() : "",
          originalPrice: dataXlsx[4] ? dataXlsx[4].trim() : "",
          stock: dataXlsx[5] ? dataXlsx[5].toString().trim() : "",
          promotionName: dataXlsx[6] ? dataXlsx[6].trim() : "",
        };
        const linkId = dataXlsx[7] ? dataXlsx[7].trim() : "";
        if (linkId && linkId.length > 0) {
          const text = fs
            .readFileSync(linkId, {
              encoding: "utf8",
              flag: "r",
            })
            .trim();

          let ids = text.split("\n");
          ids = ids.filter((e) => e && e.trim() !== "").map((e) => e.trim());
          const tempIds = splitToChunks(ids, data.productsSelected);
          for (let i = 0; i < tempIds.length; i++) {
            datas.push({
              ...data,
              selectedIds: tempIds[i].join(","),
              promotionName: data.promotionName + `-${i + 1}`,
            });
          }
        } else {
          datas.push(data);
        }
      }
    });

    const lengthThread = thread <= datas.length ? thread : datas.length;
    MAX_THREAD = lengthThread;
    const results = splitToUniqueChunks(datas, lengthThread);

    const arrResult = [];
    const arrError = [];
    for (let i = 0; i < results.length; i++) {
      await new Promise.map(
        results[i],
        async (data, index) => {
          const profile = profiles.find(
            (e) => e.name.toLowerCase().trim() == data.name.toLowerCase().trim()
          );
          if (profile) {
            if (i == 0) {
              await delay(index * 5000);
            }
            let round = 0;
            let result;
            try {
              result = await task(data, round, profile.id, index);
            } catch (err) {}

            let newData;
if (!result || result.err) {
  arrError.push(data.name);
  newData = { ...data, err: result?.err || "ERROR" };
} else {
  newData = { ...data, ...result, err: "DONE" };
}

            arrResult.push(newData);
            try {
              await writeXlsxFile(arrResult, {
                schema,
                filePath: "../Result-PROMOTION.xlsx",
              });
            } catch (e) {
              console.log(e);
            }
            return;
          } else {
            console.log("Không tìm thấy profile: " + data.name);
          }
        },
        { concurrency: lengthThread }
      );
    }
    console.log("DONE ALL");
    await delay(60000);
  } catch (e) {
    console.log("ERRR", e);
  }
})();
