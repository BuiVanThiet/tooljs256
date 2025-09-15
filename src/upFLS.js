import Promise from "bluebird";
import Hidemyacc from "./hidemyacc.js";
import {
    loginToProfile,
    openPage,
    closeBrowser,
    getIdAcc,
    processTableData,
    scrollAndClickElement,
    checkIfElementIsDisabled,
    waitForElement,
    fillInput, delayTime
} from "../src/service/BaseToolService.js";
import { readExcelFile } from "../src/service/openFileExcel.js";

const hide = new Hidemyacc();

// Đọc file Excel
const products = readExcelFile("InputDuplicateFLS.xlsx");

// Hàm để chia tài khoản thành các nhóm tối đa 3 tài khoản
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

const accGroups = chunkArray(products, 3);  // Chia nhóm tài khoản thành các nhóm tối đa 3 tài khoản

// Hàm xử lý một nhóm tài khoản
async function processAccountGroup(group) {
    const promises = group.map(async (product, index) => {
        // Cập nhật tọa độ x cho mỗi tài khoản
        const toaDoX = index * 1200; // Tăng dần theo tài khoản: 0, 1200, 2400, ...

        const profileId = await getIdAcc(product["Name Acc"]);
        console.log(`Processing account: ${product["Name Acc"]}`);
        console.log(`Position for account ${product["Name Acc"]}: { x: ${toaDoX}, y: 0 }`);  // Kiểm tra giá trị x

        const { browser, context } = await loginToProfile(hide, profileId, { x: toaDoX, y: 0 });

        if (!browser || !context) return;
        console.log(product)

        const page = await openPage(context, product["Link Duplicate"], {
            waitUntil: 'load',
            timeout: 120000
        });
        const isElementFound = await waitForElement(page, 'div#name input', 10000); // Chờ tối đa 10s

        if (!isElementFound) {
            console.log('No element found within 10 seconds, breaking out.');
            await closeBrowser(product["Name Acc"]);
        }

        await fillInput(page,"div#name input",product["Name sale"])
        await delayTime(2000);

        if (product["id product"] !== 'notData') {
            let idProducts = processCategoriesToArray(product["id product"])
            for (let id of idProducts) {
                console.log(id)
                await fillInput(page, "input[data-tid='m4b_input_search']", id);
                await delayTime(3000);
                const search = await page.$$("div.theme-arco-input-group-wrapper span.theme-arco-input-group span.theme-arco-input-group-suffix");
                search[1].click();
                await delayTime(3000);

                await scrollAndClickElement(page,"tr.theme-arco-table-tr th.theme-arco-table-th div.theme-arco-table-th-item label.theme-arco-checkbox");
                await delayTime(5000);
            }
        }

        let variation = product["Variation\n(Điền số 1: Có;\nĐiền số 2: Không;)"];
        const elementCheckVariation = await page.$$('div.theme-arco-radio-group label.theme-arco-radio.theme-m4b-radio');

        if (variation === '1') {
            await elementCheckVariation[1].click();
        } else {
            await elementCheckVariation[0].click();
        }
        await delayTime(3000);

        for (let i = 0; i < 100000; i++) {
            const elementClịckAllProductDiscount = await page.$$('div.theme-arco-radio-group label.theme-arco-radio.theme-m4b-radio');
            await elementClịckAllProductDiscount[0].click();
            await delayTime(2000);

            const elementClịckDeal = await page.$$('div.flex.items-center.mt-8 div.theme-m4b-input-group-select div.theme-m4b-select-has-tooltip-error');
            await elementClịckDeal[0].click();
            await delayTime(2000);

            const elementClickDiscountType = await page.$$('div#theme-arco-select-popup-4 li.theme-arco-select-option');
            let discountType = product["Discount type\n(Điền số 1: %;\nĐiền số 2: tiền;)"];
            if (discountType === 1) {
                await elementClickDiscountType[1].click();
            } else {
                await elementClickDiscountType[0].click();
            }
            await delayTime(2000);

            if (i === 0) {
                await fillInput(page,"div[data-tid=\"m4b_input_group\"] span.theme-arco-input-inner-wrapper.theme-arco-input-inner-wrapper-has-prefix input",product["Price reduction"])
                await delayTime(2000);
            }

            const elementUpdatePrice = await page.$$('div.flex.justify-between.items-end.mt-20 div.flex.items-center button.theme-arco-btn.theme-arco-btn-secondary');
            await elementUpdatePrice[0].click();
            await delayTime(2000);

            if (await checkIfElementIsDisabled(page, "li[aria-label='Next']") === false) {
                break;
            } else {
                await scrollAndClickElement(page, "li[aria-label='Next']");
                await page.waitForTimeout(5000);
            }

        }

        if (product['Thời gian bắt đầu'] !== 'noData') {
            await setTimeLine(page,1);
            await setTimeLine(page,2);
        }

        // Selector cho button.theme-arco-btn trong cấu trúc HTML
        const buttonSelectorAgreeFLS = "div.flex.justify-between.items-center div.flex.justify-end.items-center div button.theme-arco-btn";
        const buttons = await page.$$(buttonSelectorAgreeFLS);

        if (buttons.length > 0) {
            // Chọn phần tử cuối cùng
            const lastButton = buttons[buttons.length - 1];
            // Click vào button cuối cùng
            await lastButton.click();
            console.log("Clicked on the last button.");
        } else {
            console.log("No buttons found.");
        }

        // await closeBrowser(product["Name Acc"]);
    });

    // Chờ tất cả các tài khoản trong nhóm hoàn thành
    await Promise.all(promises);
}

async function setTimeLine(page,check) {
    const timeSetFLS = await getFormattedDate(check);
    console.log(timeSetFLS)
    await scrollAndClickElement(page,check === 1 ? "input[placeholder='Start Time']" : "input[placeholder='End Time']");
    await delayTime(3000); // Delay 5s giữa các lần mở trang

    const menuSelectorSetDayDiscount = "div.theme-arco-picker-container div.theme-arco-picker-body div.theme-arco-picker-date";
    const itemSelectorSetDayDiscount = "div.theme-arco-picker-date-value";
    await scrollAndClickByText(page, menuSelectorSetDayDiscount, itemSelectorSetDayDiscount, timeSetFLS.day);
    await delayTime(3000); // Delay 5s giữa các lần mở trang

    const menuSelectorSetTimeDiscount = "div.theme-arco-picker-container";
    const itemSelectorSetTimeDiscount = "button.theme-arco-btn";
    await scrollAndClickByText(page, menuSelectorSetTimeDiscount, itemSelectorSetTimeDiscount, 'Select time');
    await delayTime(3000);

    const menuSelectorSetTime = "div.theme-arco-picker-container ul";  // Tìm tất cả các vùng
    const itemSelectorSetTime = "li.theme-arco-timepicker-cell"; // Các mục trong mỗi vùng

    for (let i =0; i < 3; i++) {

        const allRegions = await page.$$(menuSelectorSetTime);  // Lấy tất cả các vùng trong picker
        const region2 = allRegions[i];  // Chọn vùng thứ 2 (index 1 vì bắt đầu từ 0)

        const items = await region2.$$(itemSelectorSetTime);  // Lấy các mục trong vùng 2

        for (let item of items) {
            // Lấy text trong mỗi mục
            const text = await item.evaluate(el => el.innerText.trim());
            let timeSet = '';
            if (i == 0) {
                timeSet = timeSetFLS.hour;
            } else if (i == 1) {
                timeSet = timeSetFLS.minute;
            } else if (i == 2) {
                timeSet = timeSetFLS.period;
            }
            // So sánh nếu text giống với giá trị cần chọn
            if (text === timeSet) {
                // Nếu tìm thấy, click vào mục đó
                await item.click();
                console.log(`Clicked on ${text} in region 2`);
                break; // Ngừng vòng lặp nếu đã click được
            }
        }

        // Delay giữa các thao tác
        await delayTime(3000);
    }


    const menuSelectorSetOK = "div.theme-arco-picker-container";
    const itemSelectorSetOK = "button.theme-arco-btn";
    await scrollAndClickByText(page, menuSelectorSetOK, itemSelectorSetOK, 'OK');
    await delayTime(3000);
}

// Hàm chạy tất cả các nhóm tài khoản
async function run() {
    for (let group of accGroups) {
        await processAccountGroup(group); // Xử lý nhóm tài khoản
        console.log("Finished processing a group of accounts");
    }
}

// Chạy hàm
await run();

