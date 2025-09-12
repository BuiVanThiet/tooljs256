import Promise from "bluebird";
import Hidemyacc from "./hidemyacc.js";
import {
    loginToProfile,
    openPage,
    closeOldPage,
    delayTime,
    closeBrowser,
    getIdAcc,
    runGroupedByKey,
    scrollAndClickElement,
    openProductPage,
    closeBrowserAndStop,
    scrollAndClickByText,
    scrollDownByPixels,
    splitByComma,
    clickInputByLabelTextAttribute,
    parseAttributes,
    enterDescription,
    enterInputValue,
    selectRadioButton,
    uploadFileToPage,
    scrollAndHoverElement,
    uploadFile,
    scrollAndHoverByText,
    checkIfElementIsDisabled,
    fillInput,
    getFormattedDate,
    parseSizes,
    extractTextFromElements,
    scrollToBottom,
    smoothScrollToTop
} from "../src/service/BaseToolService.js";
import { readExcelFile,processCategoriesToArray } from "../src/service/openFileExcel.js";

const hide = new Hidemyacc();

// Đọc file Excel
const products = readExcelFile("InputFLS.xlsx");
//
// // ✅ Gom sản phẩm theo 'Name Acc'
// const groupedByAcc = {};
// for (const product of products) {
//     const nameAcc = product["Name Acc"]?.trim() || "notData";
//     if (!groupedByAcc[nameAcc]) {
//         groupedByAcc[nameAcc] = [];
//     }
//     groupedByAcc[nameAcc].push(product);
// }
//
// // ✅ Với mỗi account → chạy tuần tự các sản phẩm của nó
// const accTasks = Object.entries(groupedByAcc).map(([nameAcc, productList]) => {
//     return (async () => {
//         console.log(`\n🚀 Bắt đầu xử lý account: ${nameAcc}`);
//
//         for (const [index, product] of productList.entries()) {
//             try {
//                 console.log("🔄 Product:", product);
//
//                 const profileId = await getIdAcc(nameAcc);
//                 const { browser, context } = await loginToProfile(hide, profileId, index);
//
//                 if (!browser || !context) {
//                     console.warn(`⚠️ Không thể khởi tạo trình duyệt cho ${nameAcc}`);
//                     continue;
//                 }
//
//                 const newPage = await openPage(context, 'https://www.tiktok.com/t/ZP8hg4BR2/', {
//                     waitUntil: "load",
//                     timeout: 60000
//                 });
//
//                 await closeOldPage(context);
//                 await delayTime(10000);
//                 await closeBrowser(nameAcc);
//
//                 console.log(`✅ Đã xong 1 sản phẩm của ${nameAcc}`);
//             } catch (e) {
//                 console.error(`❌ Lỗi với ${nameAcc}:`, e);
//             }
//         }
//
//         console.log(`🏁 Đã hoàn tất toàn bộ sản phẩm cho ${nameAcc}\n`);
//     })();
// });
//
// // ✅ Chạy song song theo từng acc, bên trong thì tuần tự
// await Promise.all(accTasks);
// Gọi hàm xử lý các tài khoản, delay 5s giữa các sản phẩm cùng một acc
await runGroupedByKey(
    products,
    "Name Acc", // field dùng để gom nhóm
    async (product, index, nameAcc, x, y) => {
        // const data = JSON.stringify(product, null, 2);
        const profileId = await getIdAcc(nameAcc);
        console.log(JSON.stringify(product, null, 2))

        const { browser, context } = await loginToProfile(hide, profileId, { x, y });
        if (!browser || !context) return;

        // Sử dụng vị trí x, y khi mở trình duyệt
        const page = await openPage(context, 'https://seller-us.tiktok.com/promotion/marketing-tools/regular-flash-sale/create', {
            waitUntil: 'load',
            timeout: 60000
        });
        // await setTimeLine(page,1);
        // await setTimeLine(page,2);
        await delayTime(5000);
        await fillInput(page, "input#name_input", (product["Name sale"]));
        await delayTime(3000);

        // await scrollAndClickElement(page,"div.theme-arco-picker-container button.theme-arco-btn");
        // await delayTime(5000); // Delay 5s giữa các lần mở trang

        await scrollAndClickElement(page,"div#ProductScope div.bg-white.py-16 div.flex.justify-between.items-center div div button.theme-arco-btn");
        await delayTime(5000); // Delay 5s giữa các lần mở trang

        // const comboboxCategory = await page.$$("div.theme-arco-cascader[role='combobox']");
        // if (comboboxCategory.length > 0) {
        //     // Nhấn vào phần tử đầu tiên (index 0)
        //     await comboboxCategory[0].click();
        //     console.log('Clicked on the first element');
        //     await delayTime(5000);
        // } else {
        //     console.error('No elements found');
        // }

        // let indexStop = processCategoriesToArray(product["Categores"]).length;
        // let indexClick = 1;
        // for (let category of processCategoriesToArray(product["Categores"])) {
        //     if (!category || category.trim() === "") {
        //         console.log("❌ Encountered empty category. Stopping...");
        //         break;
        //     }
        //     const menuSelector = "ul.theme-arco-cascader-list";
        //     const itemSelector = "li[role=\'menuitem\']";
        //     await scrollAndHoverByText(page, menuSelector, itemSelector, category);
        //     await delayTime(1500);
        //     indexClick++;
        //     console.log(indexStop)
        //     console.log(indexClick)
        //     if (indexStop < indexClick) {
        //         await scrollAndClickByText(page, menuSelector, itemSelector, category);
        //         await delayTime(5000);
        //     }
        // }

        let idProducts = processCategoriesToArray(product["Id Product"])
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


//         await scrollAndClickElement(page,"tr.theme-arco-table-tr th.theme-arco-table-th div.theme-arco-table-th-item label.theme-arco-checkbox");
//         await delayTime(5000); // Delay 5s giữa các lần mở trang
        const menuSelectorDone = "div.theme-arco-modal-content div.flex.flex-col.pb-24 div.mt-16";
        const itemSelectorDone = "button.theme-arco-btn";
        await scrollAndClickByText(page, menuSelectorDone, itemSelectorDone, 'Done');
        await delayTime(5000);
//
        const menuSelectorVariation = "div.theme-arco-form-item-control-children div.mt-12 div#skuOrSpuRadioGroup div.theme-arco-radio-group";
        const itemSelectorVariation = "label.theme-arco-radio";
        let variation = product["Variation\n(Điền số 1: Có;\nĐiền số 2: Không;)"];
        if (variation === 1) {
            await scrollAndClickByText(page, menuSelectorVariation, itemSelectorVariation, 'Variation-level');
        } else {
            await scrollAndClickByText(page, menuSelectorVariation, itemSelectorVariation, 'Product-level');
        }
        await delayTime(5000);
//

        if ((product["Price reduction"]).toString() !== "notData") {
            console.log("co gia reduction")

            await scrollAndClickElement(page,"div.theme-arco-table-header table thead tr.theme-arco-table-tr th.theme-arco-table-th div.theme-arco-table-th-item label.theme-arco-checkbox");
            await delayTime(5000); // Delay 5s giữa các lần mở trang

            await scrollAndClickElement(page,"div.flex.flex-col.items-end.mr-16 div.flex.items-start.flex-col div.flex.items-center.mt-8 div.theme-m4b-input-group-select div.theme-arco-select[role='combobox']");
            await delayTime(5000); // Delay 5s giữa các lần mở trang

            const menuSelectorDiscountType = "div.theme-arco-select-popup-inner div div";
            const itemSelectorDiscountType = "li.theme-arco-select-option[role='option']";
            let discountType = product["Discount type\n(Điền số 1: %;\nĐiền số 2: tiền;)"];
            if (discountType === 1) {
                await scrollAndClickByText(page, menuSelectorDiscountType, itemSelectorDiscountType, 'Percentage off');
            } else {
                await scrollAndClickByText(page, menuSelectorDiscountType, itemSelectorDiscountType, 'Fixed price');
            }
            await delayTime(5000);

            await fillInput(page, "div.theme-m4b-input-group-select-child div.theme-arco-input-group-wrapper span.theme-arco-input-group span.theme-arco-input-inner-wrapper input[role='spinbutton']", (product["Price reduction"]).toString());
            await delayTime(3000);

            const menuSelectorUpdateDiscount = "div.mt-16.px-12.py-16.bg-neutral-bg2.rounded div.flex.justify-between.items-end.mt-20 div.flex.items-center";
            const itemSelectorUpdateDiscount = "button.theme-arco-btn";
            await scrollAndClickByText(page, menuSelectorUpdateDiscount, itemSelectorUpdateDiscount, 'Batch update');
            await delayTime(5000); // Delay 5s giữa các lần mở trang
            if (await checkIfElementIsDisabled(page,"li[aria-label='Next']") === true) {
                while (true) {
                    await scrollAndClickElement(page,"div.theme-arco-table-header table thead tr.theme-arco-table-tr th.theme-arco-table-th div.theme-arco-table-th-item label.theme-arco-checkbox");
                    await delayTime(5000); // Delay 5s giữa các lần mở trang

                    await scrollAndClickByText(page, menuSelectorUpdateDiscount, itemSelectorUpdateDiscount, 'Batch update');
                    await delayTime(5000); // Delay 5s giữa các lần mở trang

                    if (await checkIfElementIsDisabled(page,"li[aria-label='Next']") === false) {
                        break;
                    } else {
                        await scrollAndClickElement(page,"li[aria-label='Next']");
                    }
                }
            }
        }

        // if((product["Price reduction variation"]).toString() !== "notData") {
        //     await scrollAndClickElement(page,"div[data-uid='productsearch:div_onclicksearchicon:27e8f']");
        //     await delayTime(3000);
        //
        //     for (let id of idProducts) {
        //         await smoothScrollToTop(page,"div.theme-arco-table-content-scroll div.theme-arco-table-content-inner div.theme-arco-table-body")
        //         console.log(id)
        //         await fillInput(page, "div[data-uid='productsearch:div_onclicksearchicon:27e8f'] input.theme-arco-input", id);
        //         await delayTime(3000);
        //
        //         await scrollToBottom(page,"div.theme-arco-table-content-scroll div.theme-arco-table-content-inner div.theme-arco-table-body")
        //
        //         for (let data of await parseSizes((product["Price reduction variation"]).toString())) {
        //             console.log(data)
        //         }
        //         const data = await extractTextFromElements(page, 'div.pl-40');
        //         console.log(data);
        //     }
        // }

        // await setTimeLine(page,1);
        // await setTimeLine(page,2);

        // Selector cho button.theme-arco-btn trong cấu trúc HTML
        const buttonSelectorAgreeFLS = "div.flex.justify-between.items-center div.flex.justify-end.items-center div button.theme-arco-btn";

// Lấy tất cả các button trong vùng cha
        const buttons = await page.$$(buttonSelectorAgreeFLS);

// Kiểm tra nếu có button
        if (buttons.length > 0) {
            // Chọn phần tử cuối cùng
            const lastButton = buttons[buttons.length - 1];

            // Click vào button cuối cùng
            // await lastButton.click();
            console.log("Clicked on the last button.");
        } else {
            console.log("No buttons found.");
        }

        console.log(`✅ Đã hoàn tất xử lý cho sản phẩm của ${nameAcc}`);
        await delayTime(10000); // Delay 10s giữa các lần mở trang
        // await closeBrowser(nameAcc);

    },
    5000 // Delay 5s giữa các dòng của cùng 1 acc
);

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
    // for (let i = 1; i<= 3; i++) {
    //     const menuSelectorSetTime = "div.theme-arco-picker-container ul";
    //     const itemSelectorSetTime = "li.theme-arco-timepicker-cell";
    //     if (i == 1) {
    //         await scrollAndClickByText(page, menuSelectorSetTime, itemSelectorSetTime, timeSetFLS.hour);
    //     } else if (i == 2) {
    //         await scrollAndClickByText(page, menuSelectorSetTime, itemSelectorSetTime, timeSetFLS.minute);
    //     } else {
    //         await scrollAndClickByText(page, menuSelectorSetTime, itemSelectorSetTime, timeSetFLS.period);
    //     }
    //     await delayTime(3000);
    // }

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



