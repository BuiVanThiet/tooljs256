// import Promise from "bluebird";
// import {
//     loginToProfile,
//     openPage,
//     closeBrowser,
//     getIdAcc,
//     delayTime,
//     scrollAndClickElement,
//     scrollAndClickElementByIndex,
//     hide, waitForElement, processTableData
// } from "../src/service/BaseToolService.js";
// import { readExcelFile } from "../src/service/openFileExcel.js";
// // import {coppyAndPateFileExcel} from "../src/service/CopyFileExxcel.js"
//
// // Đọc file Excel
// const products = readExcelFile("InputNameAcc.xlsx");
//
// // Nhóm các dòng theo Name Acc
// const groupedByAcc = {};
// for (const product of products) {
//     if (!groupedByAcc[product["Name Acc"]]) {
//         groupedByAcc[product["Name Acc"]] = [];
//     }
//     groupedByAcc[product["Name Acc"]].push(product);
// }
//
// // Đọc tham số --thread
// const args = process.argv.slice(2);
// const threadLimit = args.find(arg => arg.startsWith('--thread='));
// const THREAD_LIMIT = threadLimit ? parseInt(threadLimit.split('=')[1], 10) : 3;
//
// // Lấy tất cả Name Acc duy nhất
// const accNames = Object.keys(groupedByAcc);
// let listPoint = [];
// async function processSingleAcc(accName) {
//     const productsOfAcc = groupedByAcc[accName];
//
//     const profileId = await getIdAcc(accName);
//     const { browser, context } = await loginToProfile(hide, profileId, { x: 0, y: 0 });
//
//     if (!browser || !context) return;
//
//     // Xử lý tuần tự từng dòng của acc này
//     for (const product of productsOfAcc) {
//         const page = await openPage(
//             context,
//             "https://seller-us.tiktok.com/health-center",
//             { waitUntil: "load", timeout: 120000 }
//         );
//
//         const checkPage = await waitForElement(page, 'div#key-info-ahr span.cursor-pointer', 20000); // Chờ tối đa 10s
//         if (!checkPage) {
//             console.log('Khong thau danh sách sản phaamr');
//             await closeBrowser(product["Name Acc"]);
//             return;
//         }
//
//         // await coppyAndPateFileExcel("Tiktoksellercenter_batchedit_20250929_shipping_information_template")
//         const sel = 'div#key-info-ahr span.cursor-pointer';
//         await page.waitForSelector(sel, { state: 'visible', timeout: 10_000 });
//         const text = (await page.locator(sel).innerText()).trim();
//         console.log(text)
//         const data = {};
//         data.nameAcc = accName;
//         data.point = text;
//         listPoint = await listPoint.concat(data)
//         console.log("da xong 1 phan cua 1 acc, doii 2s de doi acc")
//         await delayTime(2000)
//         //
//         // Đóng các tab phụ, giữ tab đầu tiên
//         const pages = await context.pages();
//         for (let i = 1; i < pages.length; i++) {
//             await pages[i].close();
//         }
//     }
//
//
//     // Sau khi xử lý hết các dòng trùng acc mới đóng profile
//     await closeBrowser(accName);
//     console.log(`Đã đóng profile ${accName} sau khi xử lý hết các dòng trùng.`);
// }
//
// async function run() {
//     // Chạy các acc khác nhau song song, nhưng các dòng trong cùng acc chạy tuần tự
//     await Promise.map(
//         accNames,
//         async (accName) => {
//             await processSingleAcc(accName);
//         },
//         { concurrency: THREAD_LIMIT }
//     );
//
//     console.log('listPoint: ',listPoint)
//     const columns = [
//         { header: 'Tên acc', key: 'nameAcc' },
//         { header: 'Số điểm', key: 'point' }
//     ];
//
//     const output = './../Output/diemGayAcc/diemGayAcc.xlsx';
//     const outputRoot = './../Output/diemGayAcc/';
//     await processTableData(columns, listPoint, output, outputRoot);
// }
//
// await run();



import Promise from "bluebird";
import {
    loginToProfile,
    openPage,
    closeBrowser,
    getIdAcc,
    processTableData,
    scrollAndClickElement,
    checkIfElementIsDisabled,
    waitForElement,
    delayTime,
    hide
} from "../src/service/BaseToolService.js";
import { readExcelFile } from "../src/service/openFileExcel.js";

// Đọc file Excel
const products = readExcelFile("InputNameAcc.xlsx");
console.log(`✅ Đã đọc ${products.length} dòng từ file InputNameAcc.xlsx`);
let listPoint = [];
// Hàm để chia tài khoản thành các nhóm tối đa 3 tài khoản
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// Đọc tham số --thread từ dòng lệnh
const args = process.argv.slice(2);
const threadLimit = args.find(arg => arg.startsWith('--thread='));
const THREAD_LIMIT = threadLimit ? parseInt(threadLimit.split('=')[1], 10) : 3;  // Mặc định là 3 nếu không có tham số --thread
console.log(`Using THREAD_LIMIT = ${THREAD_LIMIT}`);

const accGroups = chunkArray(products, THREAD_LIMIT);  // Chia mảng sản phẩm thành các nhóm (số lượng nhóm = THREAD_LIMIT)
// Hàm xử lý một nhóm tài khoản
async function processAccountGroup(group) {
    const promises = group.map(async (product, index) => {
        const profileId = await getIdAcc(product["Name Acc"]);
        console.log(`Processing account: ${product["Name Acc"]}`);
        console.log("index: "+index)
        let toaDoX = 0;
        let toaDoY = 0; // Khai báo toaDoY ngoài hàm
        if (index >= 0 && index <= 3) {
            console.log('tu 0 den 3')
            toaDoX = index * 1200;  // index từ 0 đến 3
            toaDoY = 0;
        } else if (index >= 4 && index <= 7) {
            console.log('tu 4 den 7')
            toaDoX = (index - 4) * 1200;  // index từ 4 đến 7
            toaDoY = 900;
        } else if (index >= 8) {
            console.log('tu 8 den n')
            toaDoX = (index - 8) * 1200;  // index từ 8 trở đi
            toaDoY = 1800;
        }
        console.log(`Position for account ${product["Name Acc"]}: { x: ${toaDoX}, y: ${toaDoY} }`+'index: '+index);

        const { browser, context } = await loginToProfile(hide, profileId, { x: toaDoX, y: toaDoY });

        if (!browser || !context) return;

        let page;
        try {
            page = await openPage(context, 'https://seller-us.tiktok.com/health-center', {
                waitUntil: 'load',
                timeout: 120000
            });
            // Tiếp tục các thao tác khác trên page nếu mở thành công
        } catch (error) {
            console.log(`Failed to open page for account ${product["Name Acc"]}`);
            // Đảm bảo browser được đóng khi gặp lỗi
            await closeBrowser(product["Name Acc"]);
            return;
        }

        const sel = 'div#key-info-ahr span.cursor-pointer';
        const checkPage = await waitForElement(page, sel, 20000); // Chờ tối đa 10s
        if (!checkPage) {
            console.log('Khong thau danh sách sản phaamr');
            await closeBrowser(product["Name Acc"]);
            return;
        }

        await page.waitForSelector(sel, { state: 'visible', timeout: 10_000 });
        const text = (await page.locator(sel).innerText()).trim();
        console.log(text)
        const data = {};
        data.nameAcc = product["Name Acc"];
        data.point = text;
        listPoint = await listPoint.concat(data)
        console.log("da xong 1 phan cua 1 acc, doii 2s de doi acc")
        await delayTime(2000)
        //
        // Đóng các tab phụ, giữ tab đầu tiên
        const pages = await context.pages();
        for (let i = 1; i < pages.length; i++) {
            await pages[i].close();
        }

        await closeBrowser(product["Name Acc"]);
    });

    // Sử dụng Promise.map để chạy song song với THREAD_LIMIT
    await Promise.map(promises, async (promise) => {
        await promise;
    }, { concurrency: THREAD_LIMIT });
}

// Hàm chạy tất cả các nhóm tài khoản
async function run() {
    for (let group of accGroups) {
        await processAccountGroup(group); // Xử lý nhóm tài khoản
        console.log("Finished processing a group of accounts");
    }
    console.log('listPoint: ',listPoint)
    const columns = [
        { header: 'Tên acc', key: 'nameAcc' },
        { header: 'Số điểm', key: 'point' }
    ];

    const output = './../Output/diemGayAcc/diemGayAcc.xlsx';
    const outputRoot = './../Output/diemGayAcc/';
    await processTableData(columns, listPoint, output, outputRoot);
}

// Chạy hàm
await run();
