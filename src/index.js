import Promise from "bluebird";
import puppeteer from "puppeteer-core";
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

const MAX_ROUND = 3;

const schema = [
  {
    column: "Profile name",
    type: String,
    value: (obj) => obj.name,
  },
  {
    column: "Link file excel",
    type: String,
    value: (obj) => obj.file,
  },
  {
    column: "Imported Successfully",
    type: String,
    value: (obj) => obj.success.toString(),
  },
  {
    column: "Failed Precheck",
    type: String,
    value: (obj) => obj.failed.toString(),
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
        let success = 0;
        let failed = 0;
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
        await page.goto(
          "https://seller-us.tiktok.com/product/batch/publish?entry-from=manage",
          {
            waitUntil: "networkidle2",
            timeout: 60000,
          }
        );
        await delay(3000);
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
        const steps = await getElements(
          page,
          '[class="core-collapse-item-header-title"]'
        );
        if (steps && steps.length > 1) {
          await steps[1].click();
          await delay(3000);
        }
        const input = await getElement(page, '[accept=".xlsx"]');
        if (input) {
          try {
            const [fileChooser] = await Promise.all([
              page.waitForFileChooser(),
              input.evaluate((b) => b.click()),
            ]);
            await fileChooser.accept([data.file]);
          } catch (err) {
            resolve(false);
            try {
              await page.close();
              await delay(1000);
              await browser.close();
            } catch (err) {
              console.log(err);
            }
            await hide.stop(idProfile);
            return;
          }
          for (let i = 0; i < 5; i++) {
            await delay(10000);
            const btnImport = await getElements(
              page,
              '[data-tid="m4b_button"]',
              5
            );
            let isClick = false;
            if (btnImport) {
              for (let i = 0; i < btnImport.length; i++) {
                const text = await getText(page, btnImport[i]);
                if (text.includes("Import")) {
                  await btnImport[i].evaluate((b) => b.click());
                  await delay(5000);
                  isClick = true;
                  break;
                }
              }
            }
            if (isClick) {
              break;
            }
          }

          for (let i = 0; i < 5; i++) {
            await delay(6000);
            const results = await getElements(
              page,
              '[class="p-24 mb-12 rounded bg-neutral-bg3 items-center pb-24"]>div[class="flex"]',
              5
            );
            if (results) {
              success = await getText(page, results[0]);
              failed =
                results.length == 2 ? await getText(page, results[1]) : 0;
              break;
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
        resolve({ success, failed });
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
          file: dataXlsx[1],
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
            let result;
            try {
              result = await task(data, round, profile.id, index);
            } catch (err) {}

            let newData;
            if (!result) {
              newData = { ...data, success: 0, failed: 0, err: "ERROR" };
            } else {
              newData = { ...data, ...result, err: "" };
            }
            arrResult.push(newData);
            try {
              await writeXlsxFile(arrResult, {
                schema,
                filePath: "../Result.xlsx",
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
