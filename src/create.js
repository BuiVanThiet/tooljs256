import Promise from "bluebird";
import puppeteer from "puppeteer-core";
import fs from "fs";
import Hidemyacc from "./hidemyacc.js";
import writeXlsxFile from "write-excel-file/node";
import xlsx from "node-xlsx";
import {
  delay,
  getAllText,
  getElement,
  getElements,
  getRandomIntBetween,
} from "./puppeteer.js";
import { exec } from "child_process";

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

const readFolder = async (path) => {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (files && files.length) {
        resolve(files);
      } else {
        resolve(null);
      }
    });
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
    await delay(1000);
    return true;
  } catch (error) {
    return false;
  }
};

const task = async (data, round, profileId = undefined, index, errors) => {
  let idProfile;
  let page;
  let browser;
  const folders = await readFolder(data.path);
  if (!folders) return false;

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

        for (let i = 0; i < folders.length; i++) {
          page = await browser.newPage();
          try {
            try {
              await page.goto(data.id, {
                waitUntil: "networkidle2",
                timeout: 120000,
              });
            } catch (err) {}
            if (page.url().includes("account/register")) {
              try {
                if (browser) {
                  const pages = await browser.pages();
                  if (pages) {
                    for (let i = 0; i < pages.length; i++) {
                      await pages[i].close();
                      await delay(1000);
                    }
                  }

                  await browser.close();
                }
              } catch (err) {
                console.log(err);
              }
              await hide.stop(idProfile);
              resolve(false);
              return;
            }
            await delay(10000);

            const deleteButton = await getElement(
              page,
              '[d="M2 3.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5zm4-2a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm0 5a.5.5 0 011 0v4a.5.5 0 01-1 0v-4zm3 0a.5.5 0 011 0v4a.5.5 0 01-1 0v-4z"]'
            );
            if (deleteButton) {
              await scrollSmoothIfNotExistOnScreen(
                page,
                '[d="M2 3.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5zm4-2a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm0 5a.5.5 0 011 0v4a.5.5 0 01-1 0v-4zm3 0a.5.5 0 011 0v4a.5.5 0 01-1 0v-4z"]'
              );

              await moveToElement(page, deleteButton);
              await delay(1000);
              await deleteButton.click();
              await delay(3000);
              const viewUpload = await getElement(
                page,
                '[class="core-upload-list"]'
              );
              if (viewUpload) {
                await moveToElement(page, viewUpload);
                const inputFile = await getElements(page, '[type="file"]');
                if (inputFile && inputFile.length) {
                  console.log("Tìm được inputFile");
                  let files = await readFolder(`${data.path}/${folders[i]}`);
                  if (files) {
                    const [fileChooser] = await Promise.all([
                      page.waitForFileChooser(),
                      inputFile[0].evaluate((b) => b.click()),
                    ]);

                    files = files.map((e) => {
                      return `${data.path}/${folders[i]}/${e}`;
                    });
                    console.log("files", files);

                    await fileChooser.accept(files);

                    await delay(3000);

                    for (let j = 0; j < 3; j++) {
                      const btn = await getElement(
                        page,
                        '[class="theme-arco-btn theme-arco-btn-primary theme-arco-btn-size-large theme-arco-btn-shape-square theme-m4b-button"]',
                        2
                      );
                      if (btn) {
                        await btn.click();
                        await delay(15000);
                      } else {
                        break;
                      }
                    }

                    const btnx = await getElement(
                      page,
                      'class="theme-arco-icon theme-arco-icon-close fill-current text-gray-3 cursor-pointer"',
                      2
                    );
                    if (btnx) {
                      await btnx.click();
                      await delay(1000);
                    }

                    await delay(60000);

                    const inputTitlte = await getElement(
                      page,
                      '[data-id="product.publish.product_name"]'
                    );
                    if (inputTitlte) {
                      await inputTitlte.click();
                      await page.keyboard.down("Control");
                      await page.keyboard.press("A");
                      await page.keyboard.up("Control");
                      await page.keyboard.press("Backspace");
                      pbcopy(folders[i]);
                      await delay(1000);
                      await page.keyboard.down("Control");
                      await page.keyboard.press("V");
                      await page.keyboard.up("Control");
                      await delay(1000);

                      const editor = await getElement(
                        page,
                        '[class="ProseMirror"]'
                      );
                      if (editor) {
                        await editor.click();
                        await delay(1000);
                        const boundingBox = await editor.boundingBox();
                        if (boundingBox && boundingBox.x) {
                          const point = {
                            x: boundingBox.x + 2,
                            y: boundingBox.y + 2,
                          };
                          await page.mouse.click(point.x, point.y);
                          await delay(2000);
                          await page.mouse.click(point.x, point.y);
                          await delay(3000);
                          pbcopy(`${folders[i]}\n`);
                          await delay(1000);
                          await page.keyboard.down("Control");
                          await page.keyboard.press("V");
                          await page.keyboard.up("Control");
                          await delay(2000);
                          try {
                            const [fileChooser1] = await Promise.all([
                              page.waitForFileChooser(),
                              inputFile[1].evaluate((b) => b.click()),
                            ]);
                            await fileChooser1.accept(files);
                            await delay(80000);
                          } catch (e) {}

                          const submit = await getElement(
                            page,
                            '[class="core-btn core-btn-primary core-btn-size-default core-btn-shape-square pulse-button pulse-button-size-default"]'
                          );
                          if (submit) {
                            let isDone = false;
                            for (let j = 0; j < 10; j++) {
                              await submit.click();
                              await delay(2000);
                              const btnSubmit = await getElement(
                                page,
                                '[class="core-btn core-btn-primary core-btn-size-large core-btn-shape-square pulse-button pulse-button-size-large"]',
                                2
                              );
                              if (btnSubmit) {
                                await btnSubmit.click();
                                await delay(5000);
                              }
                              await delay(10000);
                              const text = await getAllText(page);
                              if (text.includes("Congratulations!")) {
                                isDone = true;
                                const btn = await getElement(
                                  page,
                                  '[class="theme-arco-btn theme-arco-btn-secondary theme-arco-btn-size-default theme-arco-btn-shape-square theme-m4b-button"]',
                                  2
                                );
                                if (btn) {
                                  await btn.click();
                                  await delay(10000);
                                }
                                break;
                              }
                            }
                            if (!isDone) {
                              errors.push(folders[i]);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              await page.close();
            }
          } catch (error) {
            if (page) {
              try {
                await page.close();
              } catch (error) {}
            }
            console.log(error);
          }
        }

        try {
          if (browser) {
            const pages = await browser.pages();
            if (pages) {
              for (let i = 0; i < pages.length; i++) {
                await pages[i].close();
                await delay(1000);
              }
            }

            await browser.close();
          }
        } catch (err) {
          console.log(err);
        }
        await hide.stop(idProfile);
        resolve(errors);
        return;
      }
    } catch (err) {
      console.log(err);
      if (idProfile && idProfile !== "") {
        try {
          if (browser) {
            const pages = await browser.pages();
            if (pages) {
              for (let i = 0; i < pages.length; i++) {
                await pages[i].close();
                await delay(1000);
              }
            }

            await browser.close();
          }
        } catch (err) {
          console.log(err);
        }
        await hide.stop(idProfile);
        await delay(3000);
      }
      resolve(await task(data, round, idProfile, index, errors));
    }
  })
    .then()
    .catch(async (e) => {
      if (idProfile && idProfile !== "") {
        try {
          if (browser) {
            const pages = await browser.pages();
            if (pages) {
              for (let i = 0; i < pages.length; i++) {
                await pages[i].close();
                await delay(1000);
              }
            }

            await browser.close();
          }
        } catch (err) {
          console.log(err);
        }
        await hide.stop(idProfile);
        await delay(3000);
      }
      return await task(data, round, profileId, index, errors);
    });
};

const splitToChunks = (array, size) => {
  const results = [];
  for (let i = 0; i < array.length; i += size) {
    results.push(array.slice(i, i + size));
  }
  return results;
};
function pbcopy(data) {
  exec(`echo ${data}| clip`, function (err, stdout, stderr) {});
}
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
          id: dataXlsx[5],
          path: dataXlsx[6],
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
            const result = await task(data, round, profile.id, index, []);
            let newData;
            if (!result) {
              newData = { ...data, err: "ERROR" };
            } else {
              if (result.length) {
                newData = { ...data, err: result.join(" | ") };
              } else {
                newData = { ...data, err: "SUCCESS" };
              }
            }
            arrResult.push(newData);
            try {
              await writeXlsxFile(arrResult, {
                schema,
                filePath: "../Result Create.xlsx",
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
