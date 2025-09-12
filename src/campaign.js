import puppeteer from "puppeteer-core";
import Hidemyacc from "./hidemyacc.js";
import xlsx from "node-xlsx";
import writeXlsxFile from "write-excel-file/node";
import Promise from "bluebird";
import {
  delay,
  getAllText,
  getElement,
  getElements,
  getRandomIntBetween,
  getText,
} from "./puppeteer.js";

const hide = new Hidemyacc();

const schema = [
  { column: "Profile name", type: String, value: (obj) => obj.name },
  { column: "Result", type: String, value: (obj) => obj.err },
];

const setBrowserPosition = (index) => {
  index = parseInt(index);
  if (index >= 0 && index < 4) return `${index * 1200},0`;
  if (index >= 4 && index < 8) return `${(index - 4) * 1200},900`;
  return `${(index - 8) * 1200},1800`;
};

const task = async (data, profileId, index) => {
  let browser;
  let page;
  const screenIndex = index % 12;
  try {
    console.log(`Start profile: ${data.name}`);
    let start = null;
    while (!start) {
      start = await hide.start(
        profileId,
        JSON.stringify({
          params:
            "--force-device-scale-factor=0.4 --window-size=1280,720 --window-position=" +
            setBrowserPosition(screenIndex),
        })
      );
      if (!start) await delay(getRandomIntBetween(2000, 4000));
    }

    browser = await puppeteer.connect({
      browserWSEndpoint: start.data.wsUrl,
      defaultViewport: null,
    });
    page = await browser.newPage();

    try {
      await page.goto(data.link, {
        waitUntil: "domcontentloaded", // tránh đợi vô hạn
        timeout: 60000,
      });
      
      await delay(15000);

      // Sau khi goto, kiểm tra URL
      const currentUrl = page.url();
      if (currentUrl.includes("account/register")) {
        console.log(`[${data.name}] 🔒 LOGIN_ERROR: Redirect tới /account/register`);
        if (!page.isClosed()) await page.close();
        await browser.close();
        await hide.stop(profileId);
        return "LOGIN_ERROR";
      }

    } catch (e) {
      console.error(`[${data.name}] ❌ Lỗi khi goto(): ${e.message}`);
      if (!page.isClosed()) await page.close();
      await browser.close();
      await hide.stop(profileId);
      return "GOTO_TIMEOUT";
    }



    // Chọn radio "Percentage off"
    const radioGroups = await getElements(page, '.theme-arco-radio');
    for (let group of radioGroups) {
      const text = await page.evaluate((el) => el.innerText, group);
      if (text.includes("Percentage off")) {
        const mask = await getElement(group, ".theme-arco-radio-mask");
        if (mask) {
          await mask.evaluate((el) => el.click());
          await delay(1000);
        }
        break;
      }
    }

    // Nhập phần trăm discount
    const input = await page.$("#discount_input");
    if (input) {
      await input.type(data.percentage);
      await delay(2000);
    }

    // Click nút NEXT
    const buttons = await getElements(
      page,
      "button.theme-arco-btn.theme-arco-btn-primary.theme-arco-btn-size-large.theme-arco-btn-shape-square.theme-m4b-button"
    );

    let nextBtn;
    for (let btn of buttons) {
      const text = await page.evaluate((el) => el.innerText, btn);
      if (text.trim().toLowerCase() === "next") {
        nextBtn = btn;
        break;
      }
    }

    if (nextBtn) {
      await nextBtn.evaluate((el) =>
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      );
      await delay(500);
      await nextBtn.evaluate((el) => el.click());
      console.log("✅ Đã click nút NEXT");
      await delay(4000);
    } else {
      console.log("❌ Không tìm thấy nút NEXT");
      throw new Error("Không tìm thấy nút NEXT");
    }

  // ✅ Chờ hàng sản phẩm mở rộng xuất hiện
  const expandedRowSelector = "tr.theme-arco-table-tr.theme-arco-table-row-expanded";

  await page.waitForSelector(expandedRowSelector, {
    visible: true,
    timeout: 120000,
  }).catch(() => {
    throw new Error(`[${data.name}] Timeout: Không thấy hàng sản phẩm mở rộng`);
  });

  console.log(`[${data.name}] ✅ Đã thấy hàng mở rộng, chuẩn bị Submit...`);
  await delay(500);

  let submitSuccess = false;
      const submitButtons = await getElements(
        page,
        "button.theme-arco-btn.theme-arco-btn-primary.theme-arco-btn-size-large.theme-arco-btn-shape-square.theme-m4b-button"
      );

      let submitBtn;
      for (let btn of submitButtons) {
        const text = await page.evaluate((el) => el.innerText, btn);
        if (text.trim().toLowerCase() === "submit") {
          submitBtn = btn;
          break;
        }
      }

      if (submitBtn) {
        await submitBtn.evaluate((el) =>
          el.scrollIntoView({ behavior: "smooth", block: "center" })
        );
        await delay(500);
        await submitBtn.evaluate((el) => el.click());
        console.log("✅ Đã click nút SUBMIT");
        await delay(1200);

        // Kiểm tra div.text chứa "Invited"
        const invitedEl = await getElement(page, "div.text");
        if (invitedEl) {
          const text = await page.evaluate((el) => el.textContent, invitedEl);
          if (text.trim().toLowerCase() === "invited") {
            submitSuccess = true;
            console.log("🎉 Submit thành công: đã thấy 'Invited'");
          } else {
            console.log(`⚠️ Thẻ div.text có nội dung khác: ${text}`);
          }
        } else {
          console.log('❌ Không thấy thẻ <div class="text"> chứa "Invited"');
        }
      } else {
        console.log("❌ Không tìm thấy nút SUBMIT");
        throw new Error("Không tìm thấy nút SUBMIT");
      }



    if (page && !page.isClosed()) await page.close();
    await browser.close();
    await hide.stop(profileId);


    return submitSuccess ? "SUCCESS" : "ERROR_SUBMIT";
  } catch (err) {
    console.error(`❌ [${data.name}] lỗi: ${err.message}`);
    if (page && !page.isClosed()) await page.close();
    if (browser) await browser.close();
    await hide.stop(profileId);

    return err.message || "ERROR";
  }
};


(async () => {
  let profiles;
  while (!profiles) {
    profiles = await hide.profiles();
    if (!profiles) {
      console.log("Please open Hidemyacc.");
      await delay(5000);
    } else {
      profiles = profiles.data;
    }
  }

  const workSheets = xlsx.parse(`../campaign.xlsx`);
  const datas = [];
  workSheets[0].data.forEach((row, i) => {
    if (i === 0 || row.length < 4) return;
    datas.push({
      name: row[0],
      link: row[1],
      productsSelected: parseInt(row[2]),
      percentage: row[3].toString(),
    });
  });

  const threadArg = process.argv.find((a) => a.startsWith("--thread"));
  let concurrency = 1;
  if (threadArg) {
    const t = parseInt(threadArg.split("=")[1]);
    if (!isNaN(t) && t > 0) concurrency = t;
  }

  const arrResult = [];

  await Promise.map(
    datas,
    async (data, index) => {
      const profile = profiles.find(
        (e) => e.name.trim().toLowerCase() === data.name.trim().toLowerCase()
      );
      if (!profile) {
        console.log("Không tìm thấy profile: " + data.name);
        arrResult.push({ ...data, err: "Không tìm thấy profile" });

        // Ghi ngay sau mỗi profile
        await writeXlsxFile(arrResult, {
          schema,
          filePath: "../Result Campaign.xlsx",
        });

        return;
      }

      const originalIndex = datas.findIndex(
        (d) => d.name.trim().toLowerCase() === data.name.trim().toLowerCase()
      );

      const result = await task(data, profile.id, originalIndex);
      arrResult.push({ ...data, err: result });

      // Ghi ngay sau mỗi profile
      await writeXlsxFile(arrResult, {
        schema,
        filePath: "../Result Campaign.xlsx",
      });
    },
    { concurrency }
  );

  await writeXlsxFile(arrResult, {
    schema,
    filePath: "../Result Campaign.xlsx",
  });

  console.log("DONE ALL");
})();