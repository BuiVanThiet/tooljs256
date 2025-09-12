import Promise from "bluebird";
import puppeteer from "puppeteer-core";
import fs from "fs";
import Hidemyacc from "./hidemyacc.js";
import writeXlsxFile from "write-excel-file/node";
import xlsx from "node-xlsx";
import {
  delay,
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
    column: "Result",
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
        let page;
        for (let i = 0; i < 3; i++) {
          try {
            if (page) {
              try {
                await page.close();
                await delay(1000);
              } catch (err) {}
            }
            page = await browser.newPage();
            await page.goto(
              "https://seller-us.tiktok.com/product/manage?tab=active",
              {
                waitUntil: "networkidle2",
                timeout: 120000,
              }
            );
            break;
          } catch (err) {
            continue;
          }
        }
        if (!page) {
          resolve(false);
          return;
        }
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
        const text = fs
          .readFileSync("../keyword.txt", {
            encoding: "utf8",
            flag: "r",
          })
          .trim();

        let keywords = text.split("\n");
        keywords = keywords
          .filter((e) => e && e.trim() !== "")
          .map((e) => e.trim());

        for (let i = 0; i < keywords.length; i++) {
          const input = await getElement(
            page,
            '[data-id="product.manage.search.input"]'
          );
          if (!input) {
            resolve(false);
            return;
          }
          await input.type(keywords[i]);
          await delay(1000);
          await page.keyboard.press("Enter");
          await delay(10000);
          const checkboxs = await getElements(
            page,
            '[data-tid="m4b_checkbox"]',
            5
          );
          if (checkboxs && checkboxs.length > 1) {
            await checkboxs[0].click();
            await delay(2000);

            const deleteBtn = await getElements(
              page,
              '[class="core-btn core-btn-secondary core-btn-size-default core-btn-shape-square pulse-button pulse-button-size-default ml-16"]',
              2
            );
            if (deleteBtn && deleteBtn.length) {
              for (let i = 0; i < deleteBtn.length; i++) {
                const text = await getText(page, deleteBtn[i]);
                if (text.includes("Delete")) {
                  await deleteBtn[i].click();
                  await delay(1000);
                  break;
                }
              }

              const confirm = await getElement(
                page,
                '[class="core-btn core-btn-primary core-btn-size-large core-btn-shape-square pulse-button pulse-button-size-large"]',
                2
              );
              if (confirm) {
                await confirm.click();
                await delay(5000);
              }
            }
          }
          await input.click();
          await page.keyboard.down("Control");
          await page.keyboard.press("A");
          await page.keyboard.up("Control");
          await page.keyboard.press("Backspace");
          await delay(1000);
        }

        try {
          await page.close();
          await delay(1000);
          await browser.close();
        } catch (err) {
          console.log(err);
        }
        await hide.stop(idProfile);
        resolve(true);
        return;
      }
    } catch (err) {
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
        };
        datas.push(data);
      }
    });
    const lengthThread = thread <= datas.length ? thread : datas.length;
    MAX_THREAD = lengthThread;
    const results = splitToChunks(datas, lengthThread);
    const arrResult = [];
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
            const result = await task(data, round, profile.id, index);
            let newData;
            if (!result) {
              newData = { ...data, err: "ERROR" };
            } else {
              newData = { ...data, err: "SUCCESS" };
            }
            arrResult.push(newData);
            try {
              await writeXlsxFile(arrResult, {
                schema,
                filePath: "../Result Delete.xlsx",
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
    console.log(e);
  }
})();
