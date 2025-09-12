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
        const page = await openPage(context, 'https://seller-us.tiktok.com/health-center?click_for=overview&tab=ncp', {
            waitUntil: 'load',
            timeout: 120000
        });

        // Lấy tất cả các phần tử có class content-jECjMB
        // Lấy tất cả các hàng trong bảng
        let products = [];

        for(let i = 0; i <100000; i++) {
            console.log("da vao vong lap "+i);
            const isElementFound = await waitForElement(page, 'tbody tr.core-table-tr', 10000); // Chờ tối đa 10s

            if (!isElementFound) {
                console.log('No element found within 10 seconds, breaking out.');
                break; // Nếu không tìm thấy phần tử, thoát vòng lặp
            }

            const newProducts = await page.$$eval('tbody tr.core-table-tr', rows => {
                return rows.map(row => {
                    // Tạo đối tượng để lưu trữ dữ liệu
                    const data = {};
                    // Lấy tất cả các cột <td> trong hàng
                    const tds = row.querySelectorAll('td.core-table-td');
                    const nameGay = tds[0].querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col div.text-base.text-gray-1.font-regular')?.innerText.trim() || 'Unknown';
                    const idGay = tds[0].querySelector('p.pt-4.text-p4-regular.text-neutral-text3')?.innerText.trim() || 'Unknown';
                    const violationReason = tds[1].querySelector('div.core-table-cell span.core-table-cell-wrap-value div div.text-base.text-gray-1.font-regular')?.innerText.trim() || 'Unknown';
                    const dateVio = tds[2].querySelector('div.core-table-cell span.core-table-cell-wrap-value div.text-base.text-gray-1.font-regular.break-normal')?.innerText.trim() || 'Unknown';

                    const [date, time] = dateVio.split('\n\n');

                    const formattedDate = `${time} - ${date}`;

                    const status = tds[3].querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col.break-normal div.text-p3-regular.text-neutral-text3 div.flex div div.text-neutral-text1')?.innerText.trim() || 'Unknown';
                    const timeStatus = tds[3].querySelector('div.text-base.text-gray-1.font-regular.flex.flex-col.break-normal div.text-p3-regular.text-neutral-text3 div.flex div div.text-neutral-text3')?.innerText.trim() || 'Unknown';

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
                    data.status = status+(timeStatus === 'Unknown' ? '' : '('+timeStatus+')');
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
            { header: 'Tên gậy', key: 'nameGay' },
            { header: 'ID gậy', key: 'idGay' },
            { header: 'Lý do vi phạm', key: 'violationReason' },
            { header: 'Ngày bị gậy', key: 'dateVio' },
            { header: 'Trạng thái', key: 'status' },
            { header: 'Ngày chạy', key: 'getDate' }
        ];

        const output = './../Output/checkVio/checkVio'+nameAcc+'.xlsx';
        const outputRoot = './../Output/checkVio/';
        await processTableData(columns, products, output,outputRoot);

        await closeBrowser(nameAcc);

    },
    5000 // Delay 5s giữa các dòng của cùng 1 acc
);
