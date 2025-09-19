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
    delayTime
} from "../src/service/BaseToolService.js";
import { readExcelFile } from "../src/service/openFileExcel.js";

const hide = new Hidemyacc();

// Đọc file Excel
const products = readExcelFile("InputNameAcc.xlsx");

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

        const page = await openPage(context, 'https://seller-us.tiktok.com/health-center?click_for=overview&tab=ncp', {
            waitUntil: 'load',
            timeout: 120000
        });

        const isElementFound = await waitForElement(page, 'tbody tr.core-table-tr', 10000); // Chờ tối đa 10s
        if (!isElementFound) {
            console.log('No element found within 10 seconds, breaking out.');
            await closeBrowser(product["Name Acc"]);
            return;
        } else {
            delayTime(3000);
        }

        // Lấy tất cả các hàng trong bảng
        let products = [];
        let productModal = [];

        for (let i = 0; i < 100000; i++) {
            const newProducts = await page.$$eval('tbody tr.core-table-tr', rows => {
                return rows.map(row => {
                    // Tạo đối tượng để lưu trữ dữ liệu
                    const data = {};

                    // Lấy tất cả các cột <td> trong hàng
                    const tds = row.querySelectorAll('td.core-table-td');

                    // Kiểm tra nếu có ít nhất một cột
                    if (tds.length > 0) {
                        const nameGay = tds[0].querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col div.text-base.text-gray-1.font-regular')?.innerText.trim() || 'Unknown';
                        const idGay = tds[0].querySelector('p.pt-4.text-p4-regular.text-neutral-text3')?.innerText.trim() || 'Unknown';
                        const violationReason = tds[1].querySelector('div.core-table-cell span.core-table-cell-wrap-value div div.text-base.text-gray-1.font-regular')?.innerText.trim() || 'Unknown';
                        const dateVio = tds[2].querySelector('div.core-table-cell span.core-table-cell-wrap-value div.text-base.text-gray-1.font-regular.break-normal')?.innerText.trim() || 'Unknown';

                        // Kiểm tra nếu dateVio có dữ liệu trước khi xử lý
                        const [date, time] = dateVio ? dateVio.split('\n\n') : ['Unknown', 'Unknown'];

                        const formattedDate = `${time} - ${date}`;

                        const status = tds[3]?.querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col.break-normal div.text-p3-regular.text-neutral-text3')?.innerText.trim() || 'Unknown';
                        const timeStatus = tds[3]?.querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col.break-normal div.text-p3-regular.text-neutral-text3 div.flex div div.text-neutral-text3')?.innerText.trim() || 'Unknown';

                        console.log('status: '+status)

                        const now = new Date();
                        const hours = now.getHours().toString().padStart(2, '0');
                        const minutes = now.getMinutes().toString().padStart(2, '0');
                        const seconds = now.getSeconds().toString().padStart(2, '0');
                        const day = now.getDate().toString().padStart(2, '0');
                        const month = (now.getMonth() + 1).toString().padStart(2, '0');
                        const year = now.getFullYear();
                        data.nameGay = nameGay;
                        data.idGay = idGay.replace('ID: ', '');
                        data.violationReason = violationReason;
                        data.dateVio = formattedDate;
                        data.status = status.replace('\n', ', ') + (timeStatus === 'Unknown' ? '' : '(' + timeStatus + ')');
                        data.getDate = `${hours}:${minutes}:${seconds}-${day}/${month}/${year}`;
                        return data;
                    } else {
                        console.log('No <td> elements found in row.');
                        return null; // Nếu không có cột nào, trả về null hoặc dữ liệu mặc định
                    }
                }).filter(item => item !== null);  // Loại bỏ các null nếu có
            });

            products = await products.concat(newProducts);

            const numberOfRows = await page.$$eval('tbody tr.core-table-tr', rows => rows.length);
            console.log(`Number of rows in the table: ${numberOfRows}`);

            for (let i=0; i <numberOfRows; i++) {
                const buttons = await page.$$('button.core-btn.core-btn-secondary');
                await buttons[i].click();
                await delayTime(3000);
                const checkNameProduct = await waitForElement(page, 'div.flex.flex-col div.text-p3-regular.text-neutral-text1.cursor-default div.flex.mt-4 div.ml-8.text-p3-regular p:nth-child(1)', 5000); // Chờ tối đa 10s
                if (checkNameProduct) {
                    const modalData = await page.evaluate(() => {
                        // Lấy tên sản phẩm và ID sản phẩm từ modal
                        const productName = document.querySelector('div.flex.flex-col div.text-p3-regular.text-neutral-text1.cursor-default div.flex.mt-4 div.ml-8.text-p3-regular p:nth-child(1)')?.innerText.trim() || 'Unknown';
                        const productId = document.querySelector('div.flex.flex-col div.text-p3-regular.text-neutral-text1.cursor-default div.flex.mt-4 div.ml-8.text-p3-regular p:nth-child(2)')?.innerText.trim().replace('Product ID: ', '') || 'Unknown';

                        return { productName, productId }; // Trả về tên sản phẩm và ID sản phẩm
                    });
                    productModal = await productModal.concat(modalData);
                    console.log('Modal Data:', modalData);  // In ra dữ liệu tên và ID sản phẩm
                }

                const closeButtons = await page.$$('div.core-drawer-inner div.core-drawer-scroll span.core-icon-hover.core-drawer-close-icon');
                if (closeButtons.length > 0) {
                    await closeButtons[0].click(); // Nhấn vào phần tử đầu tiên
                    await delayTime(3000)
                    console.log('Close button clicked');
                } else {
                    console.log('Close button not found');
                }
            }

            if (await checkIfElementIsDisabled(page, "li[aria-label='Next']") === false) {
                break;
            } else {
                await scrollAndClickElement(page, "li[aria-label='Next']");
                await page.waitForTimeout(5000);
            }
        }

        console.log("da thoat vong lap");
        const combinedData = products.map((product, index) => {
            const modal = productModal[index];  // Lấy phần tử tương ứng từ modalData

            return {
                ...product,  // Giữ lại tất cả các trường từ productData
                productName: modal.productName,  // Thêm tên sản phẩm từ modal
                productId: modal.productId  // Thêm ID sản phẩm từ modal
            };
        });

        console.log('Combined Data:', combinedData);
        // console.log(products);

        const columns = [
            { header: 'Tên gậy', key: 'nameGay' },
            { header: 'ID gậy', key: 'idGay' },
            { header: 'Lý do vi phạm', key: 'violationReason' },
            { header: 'Tên sản phẩm', key: 'productName' },
            { header: 'ID sản phẩm', key: 'productId' },
            { header: 'Ngày bị gậy', key: 'dateVio' },
            { header: 'Trạng thái', key: 'status' }
        ];

        const output = './../Output/checkVio/checkVio' + product["Name Acc"] + '.xlsx';
        const outputRoot = './../Output/checkVio/';
        await processTableData(columns, combinedData, output, outputRoot);

        // await closeBrowser(product["Name Acc"]);
    });

    // Chờ tất cả các tài khoản trong nhóm hoàn thành
    await Promise.all(promises);
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
//         const page = await openPage(context, 'https://seller-us.tiktok.com/health-center?click_for=overview&tab=ncp', {
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
//             const isElementFound = await waitForElement(page, 'tbody tr.core-table-tr', 10000); // Chờ tối đa 10s
//
//             if (!isElementFound) {
//                 console.log('No element found within 10 seconds, breaking out.');
//                 break; // Nếu không tìm thấy phần tử, thoát vòng lặp
//             }
//
//             const newProducts = await page.$$eval('tbody tr.core-table-tr', rows => {
//                 return rows.map(row => {
//                     // Tạo đối tượng để lưu trữ dữ liệu
//                     const data = {};
//                     // Lấy tất cả các cột <td> trong hàng
//                     const tds = row.querySelectorAll('td.core-table-td');
//                     const nameGay = tds[0].querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col div.text-base.text-gray-1.font-regular')?.innerText.trim() || 'Unknown';
//                     const idGay = tds[0].querySelector('p.pt-4.text-p4-regular.text-neutral-text3')?.innerText.trim() || 'Unknown';
//                     const violationReason = tds[1].querySelector('div.core-table-cell span.core-table-cell-wrap-value div div.text-base.text-gray-1.font-regular')?.innerText.trim() || 'Unknown';
//                     const dateVio = tds[2].querySelector('div.core-table-cell span.core-table-cell-wrap-value div.text-base.text-gray-1.font-regular.break-normal')?.innerText.trim() || 'Unknown';
//
//                     const [date, time] = dateVio.split('\n\n');
//
//                     const formattedDate = `${time} - ${date}`;
//
//                     const status = tds[3].querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col.break-normal div.text-p3-regular.text-neutral-text3 div.flex div div.text-neutral-text1')?.innerText.trim() || 'Unknown';
//                     const timeStatus = tds[3].querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col.break-normal div.text-p3-regular.text-neutral-text3 div.flex div div.text-neutral-text3')?.innerText.trim() || 'Unknown';
//
//                     const now = new Date();
//                     const hours = now.getHours().toString().padStart(2, '0');
//                     const minutes = now.getMinutes().toString().padStart(2, '0');
//                     const seconds = now.getSeconds().toString().padStart(2, '0');
//                     const day = now.getDate().toString().padStart(2, '0');
//                     const month = (now.getMonth() + 1).toString().padStart(2, '0');
//                     const year = now.getFullYear();
//
//                     data.nameGay = nameGay;
//                     data.idGay = idGay.replace('ID: ', '');
//                     data.violationReason = violationReason;
//                     data.dateVio = formattedDate;
//                     data.status = status+(timeStatus === 'Unknown' ? '' : '('+timeStatus+')');
//                     data.getDate = `${hours}:${minutes}:${seconds}-${day}/${month}/${year}`;
//
//                     return data;
//                 });
//             });
//
//             // Add the new products to the existing products array
//             products = await products.concat(newProducts);
//
//             if (await checkIfElementIsDisabled(page,"li[aria-label='Next']") === false) {
//                 break;
//             } else {
//                 await scrollAndClickElement(page,"li[aria-label='Next']");
//                 await page.waitForTimeout(5000);
//             }
//         }
//         console.log("da thoat vong lap");
//         console.log(products);
//
//         const columns = [
//             { header: 'Tên gậy', key: 'nameGay' },
//             { header: 'ID gậy', key: 'idGay' },
//             { header: 'Lý do vi phạm', key: 'violationReason' },
//             { header: 'Ngày bị gậy', key: 'dateVio' },
//             { header: 'Trạng thái', key: 'status' },
//             { header: 'Ngày chạy', key: 'getDate' }
//         ];
//
//         const output = './../Output/checkVio/checkVio'+nameAcc+'.xlsx';
//         const outputRoot = './../Output/checkVio/';
//         await processTableData(columns, products, output,outputRoot);
//
//         await closeBrowser(nameAcc);
//
//     },
//     5000 // Delay 5s giữa các dòng của cùng 1 acc
// );
