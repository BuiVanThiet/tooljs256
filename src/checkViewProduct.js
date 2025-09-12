// import Promise from "bluebird";
// import Hidemyacc from "./hidemyacc.js";
// import {
//     loginToProfile,
//     openPage,
//     closeOldPage,
//     delayTime,
//     closeBrowser,
//     getIdAcc,
//     runGroupedByKey,
//     scrollAndClickElement,
//     openProductPage,
//     closeBrowserAndStop,
//     scrollAndClickByText,
//     scrollDownByPixels,
//     splitByComma,
//     clickInputByLabelTextAttribute,
//     parseAttributes,
//     enterDescription,
//     enterInputValue,
//     selectRadioButton,
//     uploadFileToPage,
//     scrollAndHoverElement,
//     uploadFile,
//     scrollAndHoverByText,
//     checkIfElementIsDisabled,
//     fillInput,
//     getFormattedDate,
//     parseSizes,
//     extractTextFromElements,
//     scrollToBottom,
//     smoothScrollToTop,
//     processTableData,
//     getDateToday
// } from "../src/service/BaseToolService.js";
// import { readExcelFile,processCategoriesToArray } from "../src/service/openFileExcel.js";
//
// const hide = new Hidemyacc();
//
// // Đọc file Excel
// const products = readExcelFile("InputNameAcc.xlsx");
//
// // Gọi hàm xử lý các tài khoản, delay 5s giữa các sản phẩm cùng một acc
// await runGroupedByKey(
//     products,
//     "Name Acc", // field dùng để gom nhóm
//     async (product, index, nameAcc, x, y) => {
//         // const data = JSON.stringify(product, null, 2);
//         const profileId = await getIdAcc(nameAcc);
//         console.log(JSON.stringify(product, null, 2))
//
//         const { browser, context } = await loginToProfile(hide, profileId, { x, y });
//         if (!browser || !context) return;
//
//         // Sử dụng vị trí x, y khi mở trình duyệt
//         const page = await openPage(context, 'https://seller-us.tiktok.com/product/manage?shop_region=US', {
//             waitUntil: 'load',
//             timeout: 120000
//         });
//
//         // Lấy tất cả các phần tử có class content-jECjMB
//         // Lấy tất cả các hàng trong bảng
//         let products = [];
//
//         for(let i = 0; i <100000; i++) {
//             console.log("da vao vong lap "+i);
//             const newProducts = await page.$$eval('tbody tr.core-table-tr.core-table-row-expanded', rows => {
//                 return rows.map(row => {
//                     const columns = row.querySelectorAll('div.container-ImPBJr div.content-jECjMB');
//                     const performanceContainer = row.querySelector('div.performace-container');
//
//                     // Lấy tên sản phẩm và ID sản phẩm từ các cột
//                     const data = {};
//                     const elements = Array.from(columns);
//                     elements.forEach((el, index) => {
//                         const text = el.innerText.trim();
//                         if (index % 2 === 0) {
//                             data.productName = text; // Lẻ: tên sản phẩm
//                         } else {
//                             data.productId = text; // Chẵn: ID sản phẩm
//                         }
//                     });
//
//                     // Lấy số lượng đã bán (sold)
//                     const soldElement = performanceContainer?.querySelector('div.performanceSoldUnit-tbpKMA div.break-normal');
//                     data.sold = soldElement ? (soldElement.innerText.trim()) : 0; // Nếu không có, gán giá trị 0
//
//                     // Lấy lượt xem (view)
//                     const viewElement = performanceContainer?.querySelector('div.mt-4.text-neutral-text3.text-body-s-regular');
//                     data.view = viewElement ? (viewElement.innerText.trim()) : 0; // Nếu không có, gán giá trị 0
//
//                     // Lấy thời gian hiện tại
//                     const now = new Date();
//                     const hours = now.getHours().toString().padStart(2, '0');
//                     const minutes = now.getMinutes().toString().padStart(2, '0');
//                     const seconds = now.getSeconds().toString().padStart(2, '0');
//                     const day = now.getDate().toString().padStart(2, '0');
//                     const month = (now.getMonth() + 1).toString().padStart(2, '0');
//                     const year = now.getFullYear();
//
//                     // Lưu thông tin ngày và giờ
//                     data.getDate = `${hours}:${minutes}:${seconds}-${day}/${month}/${year}`;
//
//                     return data;
//                 });
//             });
//
//             // Add the new products to the existing products array
//             products = await products.concat(newProducts);
//             // products = await page.$$eval('tbody tr.core-table-tr.core-table-row-expanded', rows => {
//             //     return rows.map(row => {
//             //         const columns = row.querySelectorAll('div.container-ImPBJr div.content-jECjMB');
//             //         const performanceContainer = row.querySelector('div.performace-container');
//             //
//             //         // Lấy tên sản phẩm và ID sản phẩm từ các cột
//             //         const data = {};
//             //         const elements = Array.from(columns);
//             //         elements.forEach((el, index) => {
//             //             const text = el.innerText.trim();
//             //             if (index % 2 === 0) {
//             //                 data.productName = text; // Lẻ: tên sản phẩm
//             //             } else {
//             //                 data.productId = text; // Chẵn: ID sản phẩm
//             //             }
//             //         });
//             //
//             //         // Lấy số lượng đã bán (sold)
//             //         const soldElement = performanceContainer?.querySelector('div.performanceSoldUnit-tbpKMA div.break-normal');
//             //         data.sold = soldElement ? (soldElement.innerText.trim()) : 0; // Nếu không có, gán giá trị 0
//             //
//             //         // Lấy lượt xem (view)
//             //         const viewElement = performanceContainer?.querySelector('div.mt-4.text-neutral-text3.text-body-s-regular');
//             //         data.view = viewElement ? (viewElement.innerText.trim()) : 0; // Nếu không có, gán giá trị 0
//             //
//             //         // Lấy thời gian hiện tại
//             //         const now = new Date();
//             //         const hours = now.getHours().toString().padStart(2, '0');
//             //         const minutes = now.getMinutes().toString().padStart(2, '0');
//             //         const seconds = now.getSeconds().toString().padStart(2, '0');
//             //         const day = now.getDate().toString().padStart(2, '0');
//             //         const month = (now.getMonth() + 1).toString().padStart(2, '0');
//             //         const year = now.getFullYear();
//             //
//             //         // Lưu thông tin ngày và giờ
//             //         data.getDate = `${hours}:${minutes}:${seconds}-${day}/${month}/${year}`;
//             //
//             //         return data;
//             //     });
//             // });
//
//             if (await checkIfElementIsDisabled(page,"ul.core-pagination-list li[aria-label='Next']") === false) {
//                 break;
//             } else {
//                 await scrollAndClickElement(page,"ul.core-pagination-list li[aria-label='Next']");
//                 await page.waitForTimeout(5000);
//             }
//         }
//         console.log("da thoat vong lap");
//         console.log(products);
//
//         const columns = [
//             { header: 'Product Name', key: 'productName' },
//             { header: 'Product ID', key: 'productId' },
//             { header: 'Sold', key: 'sold' },
//             { header: 'View', key: 'view' },
//             { header: 'getDate', key: 'getDate' }
//         ];
//
//         const output = './../Output/checkView/checkView'+nameAcc+'.xlsx';
//         const outputRoot = './../Output/checkView/';
//         await processTableData(columns, products, output,outputRoot);
//
//         await closeBrowser(nameAcc);
//
//     },
//     5000 // Delay 5s giữa các dòng của cùng 1 acc
// );



import Promise from "bluebird";
import Hidemyacc from "./hidemyacc.js";
import {
    loginToProfile,
    openPage,
    closeBrowser,
    getIdAcc,
    runGroupedByKey,
    scrollAndClickElement,
    checkIfElementIsDisabled,
    processTableData,
    waitForElement
} from "../src/service/BaseToolService.js";
import { readExcelFile } from "../src/service/openFileExcel.js";

const hide = new Hidemyacc();

// Đọc file Excel
const products = readExcelFile("InputNameAcc.xlsx");

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
        const page = await openPage(context, 'https://seller-us.tiktok.com/product/manage', {
            waitUntil: 'load',
            timeout: 120000
        });

        // Lấy tất cả các phần tử có class content-jECjMB
        // Lấy tất cả các hàng trong bảng
        let products = [];

        for(let i = 0; i <100000; i++) {
            console.log("da vao vong lap "+i);
            const isElementFound = await waitForElement(page, 'tbody tr.core-table-tr.core-table-row-expanded', 20000); // Chờ tối đa 10s

            if (!isElementFound) {
                console.log('No element found within 10 seconds, breaking out.');
                break; // Nếu không tìm thấy phần tử, thoát vòng lặp
            }

            const newProducts = await page.$$eval('tbody tr.core-table-tr.core-table-row-expanded', rows => {
                return rows.map(row => {
                    // Tạo đối tượng để lưu trữ dữ liệu
                    const data = {};
                    // Lấy tất cả các cột <td> trong hàng
                    const tds = row.querySelectorAll('td.core-table-td');

                    const columns = row.querySelectorAll('div.container-FTU0m8 div.content-jECjMB');

                    const elements = Array.from(columns);
                    elements.forEach((el, index) => {
                        const text = el.innerText.trim();
                        if (index % 2 === 0) {
                            data.productName = text; // Lẻ: tên sản phẩm
                        } else {
                            data.productId = text.replace('ID:', ''); // Chẵn: ID sản phẩm
                        }
                    });

                    const view = tds[3].querySelector('div.performace-container div.mt-4.text-neutral-text3.text-body-s-regular')?.innerText.trim() || '0';
                    data.view = view;

                    const sold = tds[3].querySelector('div.box-hover-active-icon div.break-normal')?.innerText.trim() || '0';
                    data.sold = sold;

                    // Lấy ngày giờ hiện tại
                    const now = new Date();
                    const hours = now.getHours().toString().padStart(2, '0');
                    const minutes = now.getMinutes().toString().padStart(2, '0');
                    const seconds = now.getSeconds().toString().padStart(2, '0');
                    const day = now.getDate().toString().padStart(2, '0');
                    const month = (now.getMonth() + 1).toString().padStart(2, '0');
                    const year = now.getFullYear();

                    // Gán thời gian hiện tại vào dữ liệu
                    data.getDate = `${hours}:${minutes}:${seconds}-${day}/${month}/${year}`;

                    return data;
                });
            });

            // Add the new products to the existing products array
            products = await products.concat(newProducts);

            if (await checkIfElementIsDisabled(page,"li[aria-label='Next']") === false) {
                break;
            } else {
                await scrollAndClickElement(page,"li[aria-label='Next']");
                await page.waitForTimeout(5000);
            }
        }
        console.log("da thoat vong lap");
        console.log(products);

        const columns = [
            { header: 'Tên sản phẩm', key: 'productName' },
            { header: 'ID sản phẩm', key: 'productId' },
            { header: 'View', key: 'view' },
            { header: 'Sold', key: 'sold' },
            { header: 'Ngày chạy', key: 'getDate' }
        ];
        //
        const output = './../Output/checkView/checkView'+nameAcc+'.xlsx';
        const outputRoot = './../Output/checkView/';
        await processTableData(columns, products, output,outputRoot);

        await closeBrowser(nameAcc);

    },
    5000 // Delay 5s giữa các dòng của cùng 1 acc
);

