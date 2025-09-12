import Promise from "bluebird";
import puppeteer from "puppeteer-core";
import Hidemyacc from "./hidemyacc.js";
import writeXlsxFile from "write-excel-file/node";
import xlsx from "node-xlsx";
import fs from "fs";
import path from "path";
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

const renameFile = async (pathDownload, name) => {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(checkFile);
      reject(new Error("Timeout waiting for file to be ready"));
    }, 30000);

    const checkFile = setInterval(() => {
      try {
        const files = fs.readdirSync(pathDownload);
        if (files.length > 0) {
          const downloadedFile = files[0];
          const extension = path.extname(downloadedFile);
          const oldPath = path.join(pathDownload, downloadedFile);
          const newPath = path.join(pathDownload, `${name}${extension}`);
          const stats = fs.statSync(oldPath);
          if (stats.size > 0 && !downloadedFile.includes("crdownload")) {
            try {
              fs.renameSync(oldPath, newPath);
              console.log(
                `Renamed file to ${name}${extension} in ${pathDownload}`
              );
            } catch (err) {
              console.log(`Error renaming file: ${err.message}`);
            }
            clearInterval(checkFile);
            clearTimeout(timeout);
            resolve();
          }
        }
      } catch (err) {
        reject(err);
        // File might not exist yet
      }
    }, 100);
  }).catch((err) => {
    console.log(`Error in renameFile: ${err.message}`);
  });
};

const moveToElement = async (page, element) => {
  const boundingBox = await element.boundingBox();
  if (boundingBox && boundingBox.x) {
    const point = {
      x: boundingBox.x + boundingBox.width / 2,
      y: boundingBox.y + boundingBox.height / 2,
    };
    await page.mouse.move(point.x, point.y);
    await delay(1000);
    await page.mouse.click(point.x, point.y);
    await delay(1000);
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
                "--enable-features=NetworkService,NetworkServiceInProcess --enable-features=DownloadBubble --force-device-scale-factor=0.4 --window-size=1920,1080 --window-position=" +
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
        const client = await page.target().createCDPSession();

        try {
          let url;
          switch (data.type) {
            case "BASIC":
              url = "https://seller-us.tiktok.com/product/batch/edit-prods";
              break;
            case "PRODUCT CARD":
              url = "https://seller-us.tiktok.com/compass/single-product-card";
              break;
            case "TEMPLATE":
              url = "https://seller-us.tiktok.com/product/batch/publish";
              break;
            case "PRODUCT":
              url = data.url;
              break;
            default:
              url = "https://seller-us.tiktok.com/product/batch/edit-prods";
              break;
          }
          await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 60000,
          });
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
          resolve(false);
          return;
        }

        if (data.type === "BASIC") {
          const pathDownload = path.resolve("../downloads", data.name, "Basic");
          if (fs.existsSync(pathDownload)) {
            fs.rmSync(pathDownload, { recursive: true, force: true });
            await delay(500);
          }
          fs.mkdirSync(pathDownload, { recursive: true });
          await delay(500);
          await client.send("Page.setDownloadBehavior", {
            behavior: "allow",
            downloadPath: pathDownload,
          });

          const select = await getElement(
            page,
            '[class="core-btn core-btn-primary core-btn-size-large core-btn-shape-square pulse-button pulse-button-size-large"]'
          );

          if (select) {
            await select.click();
            await delay(5000);
            const selectFilter = await getElement(
              page,
              '[class="core-btn core-btn-primary core-btn-size-default core-btn-shape-square pulse-button pulse-button-size-default"]'
            );
            if (selectFilter) {
              await selectFilter.click();
              await delay(500);
              const checkboxs = await getElements(
                page,
                '[class="core-radio-mask"]'
              );
              if (checkboxs && checkboxs.length > 1) {
                await checkboxs[1].click();
                await delay(500);
                const selects = await getElements(
                  page,
                  '[class="core-btn core-btn-primary core-btn-size-large core-btn-shape-square pulse-button pulse-button-size-large"]'
                );
                if (selects && selects.length > 1) {
                  await selects[1].click();
                  await delay(15000);
                  const downloads = await getElements(
                    page,
                    '[class="core-btn core-btn-primary core-btn-size-small core-btn-shape-square pulse-button pulse-button-size-small"]'
                  );
                  if (downloads && downloads.length) {
                    await downloads[0].click();
                    await renameFile(pathDownload, data.name + " - Basic");
                    success = true;
                  }
                }
              }
            }
          }
        } else if (data.type === "PRODUCT CARD") {
          const pathDownload = path.resolve(
            "../downloads",
            data.name,
            "Product Card"
          );
          if (fs.existsSync(pathDownload)) {
            fs.rmSync(pathDownload, { recursive: true, force: true });
            await delay(500);
          }
          fs.mkdirSync(pathDownload, { recursive: true });
          await delay(500);
          await client.send("Page.setDownloadBehavior", {
            behavior: "allow",
            downloadPath: pathDownload,
          });

          const timeSelect = await getElement(
            page,
            '[data-testid="time-selector-input"]'
          );
          if (timeSelect) {
            await moveToElement(page, timeSelect);
            await delay(1000);
            const day28s = await getElements(
              page,
              '[class="theme-arco-btn theme-arco-btn-secondary theme-arco-btn-size-mini theme-arco-btn-shape-square theme-m4b-button theme-m4b-button-size-mini theme-m4b-date-picker-range-with-mode-shortcut-custom-btn theme-arco-tooltip-open"]'
            );
            if (day28s && day28s.length > 1) {
              await moveToElement(page, day28s[day28s.length - 1]);
              await delay(10000);
              const exportBtn = await getElements(
                page,
                '[class="theme-arco-btn theme-arco-btn-secondary theme-arco-btn-size-default theme-arco-btn-shape-square theme-m4b-button"]'
              );
              if (exportBtn && exportBtn.length > 1) {
                await exportBtn[1].click();
                await delay(1000);
                await renameFile(pathDownload, data.name + " - Product Card");
                success = true;
              }
            }
          }
        } else if (data.type === "PRODUCT") {
          const pathDownload = path.resolve(
            "../downloads",
            data.name,
            "Product"
          );
          if (fs.existsSync(pathDownload)) {
            fs.rmSync(pathDownload, { recursive: true, force: true });
            await delay(500);
          }
          fs.mkdirSync(pathDownload, { recursive: true });
          await delay(500);
          await client.send("Page.setDownloadBehavior", {
            behavior: "allow",
            downloadPath: pathDownload,
          });
          console.log("Product");
          const exportBtn = await getElements(
            page,
            '[class="theme-arco-btn theme-arco-btn-secondary theme-arco-btn-size-default theme-arco-btn-shape-square theme-m4b-button"]'
          );
          if (exportBtn && exportBtn.length > 1) {
            await exportBtn[1].click();
            await delay(1000);
            await renameFile(pathDownload, data.name + " - Product");
            success = true;
          }
        }
        if (data.type === "TEMPLATE") {
          const pathDownload = path.resolve(
            "../downloads",
            data.name,
            "Template"
          );
          if (fs.existsSync(pathDownload)) {
            fs.rmSync(pathDownload, { recursive: true, force: true });
            await delay(500);
          }
          fs.mkdirSync(pathDownload, { recursive: true });
          await delay(500);
          await client.send("Page.setDownloadBehavior", {
            behavior: "allow",
            downloadPath: pathDownload,
          });

          const spanTrigger = await getElement(
            page,
            'span.core-cascader-view-value-mirror'
          );

          if (spanTrigger) {
            await spanTrigger.click();
            await delay(5000);

            // 2. Sau khi click, tìm ô input vừa xuất hiện
            const input = await getElement(
              page,
              'input[placeholder="Search"]'
            );

          if (input) {
            await input.type(data.nameTemplate);
            await delay(5000);
            const listItem = await getElements(
              page,
              '[class="core-cascader-list-item-label"]'
            );
            if (listItem && listItem.length > 0) {
              let clickDone = false;
              for (let i = 0; i < listItem.length; i++) {
                const text = await getText(page, listItem[i]);
                console.log("text", text);
                if (
                  text
                    .trim()
                    .toLowerCase()
                    .includes(data.nameTemplate.trim().toLowerCase())
                ) {
                  await listItem[i].click();
                  await delay(3000);
                  clickDone = true;
                  break;
                }
              }
              if (clickDone) {
                const downloadBtn = await getElement(
                  page,
                  '[class="core-btn core-btn-primary core-btn-size-default core-btn-shape-square pulse-button pulse-button-size-default mt-48 w-full"]'
                );
                if (downloadBtn) {
                  await downloadBtn.click();
                  await delay(1000);
                  await renameFile(pathDownload, data.name + " - Template");
                  success = true;
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
    const workSheetsFromFile = xlsx.parse(`../HIDEMYACC.xlsx`);

    const datas = [];
    workSheetsFromFile[0].data.forEach((dataXlsx, index) => {
      if (index > 0 && dataXlsx.length > 1) {
        const data = {
          name: dataXlsx[0],
          type: dataXlsx[9] ? dataXlsx[9].toString().trim() : "BASIC",
          nameTemplate: dataXlsx[10] ? dataXlsx[10].toString().trim() : "",
          url: dataXlsx[11] ? dataXlsx[11].toString().trim() : "",
        };
        datas.push(data);
      }
    });

    const lengthThread = thread <= datas.length ? thread : datas.length;
    MAX_THREAD = lengthThread;
    const results = splitToChunks(datas, lengthThread);

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
            if (!result) {
              arrError.push(data.name);
              newData = { ...data, err: "ERROR" };
            } else {
              newData = { ...data, ...result, err: "DONE" };
            }
            arrResult.push(newData);
            try {
              await writeXlsxFile(arrResult, {
                schema,
                filePath: "../Result-Download.xlsx",
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
