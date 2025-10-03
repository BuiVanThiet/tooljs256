// base.js
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import Hidemyacc from "../hidemyacc.js";


import axios from "axios";
import { chromium } from 'playwright'; // Thay puppeteer bằng playwright
import moment from 'moment-timezone';
// Hàm delay giúp chờ một khoảng thời gian
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Hàm xử lý tài khoản và tính toán vị trí cửa sổ cho từng sản phẩm
export async function runGroupedByKey(list, key, processItemFn, delayBetweenSameKey = 0) {
    // Gom theo key (Name Acc)
    const grouped = {};
    for (const item of list) {
        const k = item[key]?.trim() || "notData";
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(item);
    }

    // Chạy song song các nhóm 'Name Acc'
    const tasks = Object.entries(grouped).map(([groupKey, groupItems], groupIndex) => {
        return (async () => {
            console.log(`\n🚀 Bắt đầu xử lý nhóm: ${groupKey}`);

            // Duyệt các sản phẩm của nhóm 'Name Acc'
            const position = setBrowserPosition(groupIndex); // Vị trí của các sản phẩm cùng 'Name Acc'

            for (let i = 0; i < groupItems.length; i++) {
                const product = groupItems[i];

                // Tính toán vị trí cửa sổ cho sản phẩm
                const { x, y } = position; // Tất cả sản phẩm trong cùng 1 'Name Acc' sẽ có vị trí giống nhau

                await processItemFn(product, i, groupKey, x, y); // Truyền x, y vào hàm xử lý từng item

                if (i < groupItems.length - 1 && delayBetweenSameKey > 0) {
                    console.log(`⏳ Delay ${delayBetweenSameKey}ms giữa các dòng trong ${groupKey}`);
                    await delay(delayBetweenSameKey); // Delay giữa các dòng trong nhóm
                }
            }

            console.log(`🏁 Hoàn tất nhóm: ${groupKey}`);
        })();
    });

    // Chờ tất cả nhóm hoàn tất
    await Promise.all(tasks);
}

// Hàm tính vị trí cửa sổ trình duyệt
const setBrowserPosition = (index) => {
    index = parseInt(index);
    let x, y;

    // Tính toán vị trí cho mỗi cửa sổ (vị trí của từng tài khoản khác nhau)
    if (index >= 0 && index < 4) {
        x = index * 1200;
        y = 0;
    } else if (index >= 4 && index < 8) {
        x = (index - 4) * 1200;
        y = 900;
    } else {
        x = (index - 8) * 1200;
        y = 1800;
    }

    console.log(`Position for account ${index}: x = ${x}, y = ${y}`);
    return { x, y };
};



// Hàm đăng nhập vào tài khoản và khởi tạo trình duyệt
export async function loginToProfile(hide, profileId, screenIndex) {
    let start = null;
    console.log(screenIndex)
    const { x, y } = screenIndex;
    while (!start) {
        start = await hide.start(
            profileId,
            JSON.stringify({
                // params: "--force-device-scale-factor=0.4 --window-size=1280,720 --window-position=" + (screenIndex) // Tính toán vị trí cửa sổ
                params: `--force-device-scale-factor=0.4 --window-size=1280,720 --window-position=${x},${y}`

            })
        );
        if (!start) await delayTime(5000);
    }

    console.log("start.data.wsUrl: ", start.data.wsUrl);
    const wsUrl = start.data.wsUrl;
    if (!wsUrl) {
        console.log("Không nhận được wsUrl từ API.");
        return null;
    }

    // Kết nối đến trình duyệt qua CDP
    const browser = await chromium.connectOverCDP(wsUrl);
    const context = await browser.contexts()[0];

    return { browser, context };
}

// Hàm mở trang sản phẩm và kiểm tra URL
export async function openProductPage(page, link) {
    try {
        await gotoWithTimeout(page, link);
        await delayTime(15000);

        const currentUrl = page.url();
        if (currentUrl.includes('account/register')) {
            console.log(`🔒 LOGIN_ERROR: Redirect tới /account/register`);
            return 'LOGIN_ERROR';
        }
    } catch (e) {
        console.error(`[❌ Lỗi khi goto(): ${e.message}]`);
        return 'GOTO_TIMEOUT';
    }
}

// Hàm đóng browser và dừng profile
export async function closeBrowserAndStop(browser, hide, profileId) {
    if (browser) {
        await browser.close();
    }
    await hide.stop(profileId);
}

// Hàm lấy ID tài khoản
export async function getIdAcc(nameAcc) {
    // Step 1: Lấy danh sách tài khoản từ API
    const response = await axios.get("http://127.0.0.1:2268/profiles");
    const accounts = response.data.data;

    // Chọn tài khoản theo tên
    const account = accounts.find(acc => acc.name === nameAcc);
    if (!account) {
        console.log(`Tài khoản ${nameAcc} không tồn tại`);
        return null;
    }
    return account.id;
}

// Hàm điều hướng trang với timeout
export async function gotoWithTimeout(page, url, timeout = 5000) {
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout,
        });
    } catch (e) {
        console.error(`❌ Lỗi khi mở trang: ${e.message}`);
        return 'GOTO_TIMEOUT';
    }
}

export async function openPage(context, url, options = {}) {
    const page = await context.newPage(); // Tạo một page mới trong context
    await page.goto(url, options);  // Mở trang và chờ tải xong
    return page;  // Trả về page hợp lệ để có thể thao tác với page.evaluate()
}
export async function closeOldPage(context) {
    try {
        const pages = await context.pages();
        if (pages.length > 0) {
            const oldPage = pages[0];
            await oldPage.close();
        }
    } catch (e) {
        console.log("Lỗi khi đóng trang cũ:", e);
    }
}

// Hàm lướt đến phần tử và click vào phần tử đó
export async function scrollAndClickElement(page, selector) {
    try {
        // Chờ phần tử xuất hiện và đảm bảo phần tử có thể tương tác
        const element = await page.waitForSelector(selector, { timeout: 10000, state: 'visible' });

        if (element) {
            // Lướt đến phần tử trước khi click
            await element.scrollIntoViewIfNeeded();
            console.log(`Lướt đến phần tử: ${await element.innerText()}`);

            // Click vào phần tử
            await element.click();
            console.log(`Đã click vào phần tử: ${selector}`);
        } else {
            console.log(`Không tìm thấy phần tử: ${selector}`);
        }
    } catch (e) {
        console.log("Lỗi khi thao tác với phần tử:", e);
    }
}

export async function scrollAndClickElementByIndex(
    page,
    selector,
    position) {
    try {

        const idx = position - 1; // chuyển sang 0-based cho .nth()
        const list = page.locator(selector);
        const count = await list.count();

        if (count === 0) {
            console.log(`Không tìm thấy phần tử với selector: ${selector}`);
            return;
        }
        if (idx >= count) {
            console.log(
                `Chỉ tìm thấy ${count} phần tử, nhưng yêu cầu vị trí ${position}. Selector: ${selector}`
            );
            return;
        }

        const target = list.nth(idx);

        // Chờ phần tử trở nên "visible" và có thể tương tác
        await target.waitFor({ state: 'visible', timeout: 10000 });

        // Lướt tới phần tử
        await target.scrollIntoViewIfNeeded();

        const text = await target.innerText().catch(() => '');
        console.log(`Lướt đến phần tử [#${position}]: ${text?.slice(0, 120)}`);

        // Click
        await target.click();
        console.log(`Đã click vào phần tử [#${position}] của selector: ${selector}`);
    } catch (e) {
        console.log('Lỗi khi thao tác với phần tử:', e);
    }
}

export async function scrollAndHoverElement(page, selector) {
    try {
        // Chờ phần tử xuất hiện và đảm bảo phần tử có thể tương tác
        const element = await page.waitForSelector(selector, { timeout: 10000, state: 'visible' });

        if (element) {
            // Lướt đến phần tử trước khi click
            await element.evaluate(el => el.scrollIntoViewIfNeeded());
            // Lấy và in nội dung của phần tử
            const innerText = await element.evaluate(el => el.innerText);
            console.log(`Lướt đến phần tử: ${innerText}`);

            // Di chuột vào phần tử
            await element.hover();
            console.log(`Đã hover vào phần tử: ${selector}`);
        } else {
            console.log(`Không tìm thấy phần tử: ${selector}`);
        }
    } catch (e) {
        console.log("Lỗi khi thao tác với phần tử:", e);
    }
}

export async function closeBrowser(accountName) {
    try {
        // Step 1: Lấy danh sách tài khoản từ API
        const response = await axios.get("http://127.0.0.1:2268/profiles");
        const accounts = response.data.data;

        // Chọn tài khoản theo tên
        const account = accounts.find(acc => acc.name === accountName);
        if (!account) {
            console.log(`Tài khoản ${accountName} không tồn tại`);
            return null;
        }
        console.log(`Đã đóng [${accountName}]`)
        const startResponse = await axios.post(`http://127.0.0.1:2268/profiles/stop/${account.id}`);
    } catch (e) {
        console.log("Lỗi khi đóng trình duyệt:", e);
    }
}

// Hàm điền vào ô input
export async function fillInput(page, selector, value) {
    try {
        // Chờ cho ô input xuất hiện trên trang
        const element = await page.waitForSelector(selector, { timeout: 10000, state: 'visible' });

        if (element) {
            const inputElement = await page.$(selector);
            if (inputElement) {
                await inputElement.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                await inputElement.click({ clickCount: 3 });
                await page.keyboard.press('Backspace');
            }

            // Điền giá trị mới vào ô input
            await element.type(value);
            console.log(`Đã điền giá trị "${value}" vào ô input`);
        } else {
            console.log("Không tìm thấy ô input với selector:", selector);
        }
    } catch (e) {
        console.log("Lỗi khi điền vào ô input:", e);
    }
}


export async function enterInputValue(page, selector, value, index) {
    try {
        // Lấy tất cả các phần tử trùng với selector
        const elements = await page.$$(selector);

        if (elements.length > 0) {
            // Lấy phần tử thứ 3 (index = 2)
            const element = elements[index];

            // Điền giá trị vào ô input
            await element.fill(value);
            await scrollAndClickElement(page,"div#preview-sale-information h1");
            console.log(`Đã điền giá trị "${value}" vào ô input thứ ${index + 1}`);
        } else {
            console.log(`Không tìm thấy đủ ô input, chỉ có ${elements.length} ô.`);
        }
    } catch (e) {
        console.log("Lỗi khi điền vào ô input:", e);
    }
}

// uploadFile.js (hoặc trong một file utils.js nếu bạn có nhiều file helpers)
export async function uploadFile(page, uploadInputSelector, filePaths) {
    try {
        // Chờ phần tử input (loại file) xuất hiện
        const inputElement = await page.waitForSelector(uploadInputSelector, { timeout: 10000, state: 'visible' });

        if (inputElement) {
            // Đảm bảo input là phần tử input kiểu file
            const inputFileElement = await page.$(uploadInputSelector); // Lấy lại phần tử input file

            if (inputFileElement) {
                // Tải lên tệp
                await inputFileElement.setInputFiles(filePaths);  // Phương thức này phải gọi trên input element
                console.log(`Đã tải lên ${filePaths.length} ảnh`);
            } else {
                console.log("Không tìm thấy phần tử input file");
            }
        } else {
            console.log(`Không tìm thấy input file với selector: ${uploadInputSelector}`);
        }
    } catch (e) {
        console.log("Lỗi khi tải tệp:", e);
    }
}


export async function loadList(page,element) {
    try {
        // Chờ phần tử `ul` có class `core-cascader-list` xuất hiện trên trang
        const menuItems = await page.$$eval('ul.core-cascader-list.core-cascader-list-select[role="menu"] li.core-cascader-list-item', items => {
            // Trả về tất cả các text của từng item trong danh sách
            return items.map(item => item.innerText);
        });

        // In danh sách các text của menu
        console.log("Danh sách các mục menu:");
        menuItems.forEach((text, index) => {
            console.log(`${index + 1}: ${text}`);
        });

        return menuItems; // Trả về mảng chứa text của các mục menu
    } catch (e) {
        console.error("Lỗi khi lấy text từ menu:", e);
    }
}

// Hàm lướt đến phần tử có text cụ thể và click vào phần tử
export async function scrollAndClickByText(page, menuSelector, itemSelector, itemText,itemClearText) {
    try {
        // Lấy tất cả các phần tử con của menu
        let menuItems = await page.$$eval(`${menuSelector} ${itemSelector}`, (items) => {
            // Trả về danh sách text của các mục menu
            return items.map(item => item.innerText.trim());
        });
        // Nếu không có phần tử nào, thay đổi menuSelector sang giá trị mặc định
        if (menuItems.length === 0) {
            console.log(`Không tìm thấy phần tử nào với menuSelector: ${menuSelector}. Sử dụng selector mặc định.`);
            menuSelector = 'div.core-select-popup div div.core-select-popup-inner div div'; // Thay đổi selector
            menuItems = await page.$$eval(`${menuSelector} ${itemSelector}`, (items) => {
                // Trả về danh sách text của các mục menu
                return items.map(item => item.innerText.trim());
            });
        }

        // Tìm phần tử có text khớp và click vào nó
        const index = menuItems.findIndex(text => text === itemText); // Tìm index của phần tử có text
        if (index !== -1) {
            // Tìm phần tử tương ứng và lướt đến nó
            const itemToClick = await page.$$(menuSelector + ' ' + itemSelector);
            await itemToClick[index].scrollIntoViewIfNeeded();  // Lướt đến phần tử
            await itemToClick[index].click();  // Click vào phần tử
            console.log(`Đã click vào phần tử có text: ${itemText}`);
        } else {
            await fillInput(page, "input[placeholder='Enter a custom value']", itemText);
            await delayTime(3000)
            await scrollAndClickElement(page,"div.flex.px-12.pb-0.space-x-8.flex-grow-1 button[data-v='17f6g56']")
            await delayTime(3000)
            console.log(`Không tìm thấy phần tử với text: ${itemText}`);
            // Chọn toàn bộ nội dung trong ô input để xóa
            await itemClearText.click({ clickCount: 3 }); // Chọn toàn bộ nội dung
            await page.keyboard.press('Backspace'); // Xóa nội dung đã nhập
            await page.waitForTimeout(3000); // Đợi 1s trước khi chuyển sang value tiếp theo
        }
    } catch (e) {
        console.error("Lỗi khi thao tác với phần tử:", e);
    }
}

export async function scrollAndHoverByText(page, menuSelector, itemSelector, itemText, itemClearText) {
    try {
        // Lấy tất cả các phần tử con của menu
        let menuItems = await page.$$eval(`${menuSelector} ${itemSelector}`, (items) => {
            // Trả về danh sách text của các mục menu
            return items.map(item => item.innerText.trim());
        });

        // Nếu không có phần tử nào, thay đổi menuSelector sang giá trị mặc định
        if (menuItems.length === 0) {
            console.log(`Không tìm thấy phần tử nào với menuSelector: ${menuSelector}. Sử dụng selector mặc định.`);
            menuSelector = 'div.core-select-popup div div.core-select-popup-inner div div'; // Thay đổi selector
            menuItems = await page.$$eval(`${menuSelector} ${itemSelector}`, (items) => {
                // Trả về danh sách text của các mục menu
                return items.map(item => item.innerText.trim());
            });
        }

        // Tìm phần tử có text khớp và click vào nó
        const index = menuItems.findIndex(text => text === itemText); // Tìm index của phần tử có text
        if (index !== -1) {
            // Tìm phần tử tương ứng và lướt đến nó
            const itemToClick = await page.$$(menuSelector + ' ' + itemSelector);
            await itemToClick[index].scrollIntoViewIfNeeded();  // Lướt đến phần tử

            // Thực hiện hover vào phần tử trước khi click
            await itemToClick[index].hover();
            console.log(`Đã hover vào phần tử có text: ${itemText}`);

            // await itemToClick[index].click();  // Click vào phần tử
            // console.log(`Đã click vào phần tử có text: ${itemText}`);
        } else {
            await fillInput(page, "input[placeholder='Enter a custom value']", itemText);
            await delayTime(3000);
            await scrollAndClickElement(page, "div.flex.px-12.pb-0.space-x-8.flex-grow-1 button[data-v='17f6g56']");
            await delayTime(3000);
            console.log(`Không tìm thấy phần tử với text: ${itemText}`);

            // Chọn toàn bộ nội dung trong ô input để xóa
            await itemClearText.click({ clickCount: 3 }); // Chọn toàn bộ nội dung
            await page.keyboard.press('Backspace'); // Xóa nội dung đã nhập
            await page.waitForTimeout(3000); // Đợi 1s trước khi chuyển sang value tiếp theo
        }
    } catch (e) {
        console.error("Lỗi khi thao tác với phần tử:", e);
    }
}


export async function scrollDownByPixels(newPage, pixels) {
    try {
        // Ép kiểu pixels thành số nguyên (parseInt) để đảm bảo giá trị là số
        const pixelsToScroll = parseInt(pixels, 10);

        if (isNaN(pixelsToScroll)) {
            console.error("Giá trị pixels không hợp lệ:", pixels);
            return;
        }

        // Kéo trang xuống theo chiều dọc (Y-axis) với số pixel đầu vào
        await newPage.evaluate((pixels) => {
            window.scrollBy(0, pixels);  // Cuộn trang xuống số pixel bạn truyền vào
        }, pixelsToScroll);

        console.log(`Đã cuộn màn xuống ${pixelsToScroll} pixel`);
    } catch (e) {
        console.log("Lỗi khi cuộn trang:", e);
    }
}

export async function splitByComma(inputString) {
    // Kiểm tra chuỗi đầu vào có hợp lệ không
    if (!inputString || typeof inputString !== "string") {
        console.error("Invalid input string:", inputString);
        return [];
    }

    // Chia chuỗi theo dấu phẩy, loại bỏ khoảng trắng ở hai đầu
    return inputString
        .split(",")                // tách theo dấu phẩy
        .map(item => item.trim())   // loại bỏ khoảng trắng 2 đầu mỗi phần tử
        .filter(Boolean);
}

// cho attribute

export async function parseAttributes(attributes) {
    // Bước 1: Tách chuỗi thành các cặp (key: value) theo dấu phẩy
    const attributePairs = attributes
        .split('),')  // Tách chuỗi theo dấu "),"
        .map(pair => pair.trim().replace(/[()]/g, ''));  // Loại bỏ dấu ngoặc đơn và khoảng trắng

    // Bước 2: Tạo đối tượng từ các cặp key-value
    const result = attributePairs.map(pair => {
        const [key, value] = pair.split(':');  // Tách key và value theo dấu ":"
        const trimmedKey = key.trim();  // Loại bỏ khoảng trắng dư thừa
        const trimmedValue = value.trim();  // Loại bỏ khoảng trắng dư thừa

        // Bước 3: Tách giá trị có dấu phẩy thành mảng (nếu có)
        const valueArray = trimmedValue.split(',').map(item => item.trim());

        return { [trimmedKey]: valueArray };  // Trả về đối tượng với key và giá trị dạng mảng
    });

    return result;  // Trả về mảng đối tượng
}

export async function clickInputByLabelTextAttribute(page, labelText, values = []) {
    try {
        if (!Array.isArray(values) || values.length === 0) {
            console.warn(`⚠️ Không có giá trị nào để chọn cho label "${labelText}"`);
            return false;
        }

        const inputSelector = await page.evaluate((labelText) => {
            const labels = Array.from(document.querySelectorAll("div.grid div label.text-neutral-text2"));
            for (const label of labels) {
                const textNode = label.querySelector(
                    "div.formLabel-GtFmkf span.flex.items-center span.title-TwiAC7 div.content-jECjMB"
                );
                if (textNode && textNode.textContent.trim() === labelText) {
                    const wrapper = label.closest("div");
                    if (!wrapper) return null;

                    const input = wrapper.querySelector("[role='combobox']");
                    if (input && input.getAttribute("aria-controls")) {
                        return `[aria-controls="${input.getAttribute("aria-controls")}"]`;
                    }
                }
            }
            return null;
        }, labelText);

        if (!inputSelector) {
            console.error(`❌ Không tìm thấy selector cho label "${labelText}"`);
            return false;
        }

        const input = await page.$(inputSelector);
        if (!input) {
            console.error(`❌ Không tìm thấy element DOM từ selector "${inputSelector}"`);
            return false;
        }

        await input.click();
        await page.waitForTimeout(3000);

        for (const value of values) {
            const inputBox = await input.$("input");
            if (!inputBox) {
                console.error("❌ Không tìm thấy ô nhập để gõ giá trị");
                return false;
            }

            await inputBox.type(value);
            await page.waitForTimeout(3000);

            // Enter để xác nhận giá trị đã gõ (giả định hệ thống tự suggest)
            await page.keyboard.press("Enter");
            await page.waitForTimeout(3000);

            await scrollAndClickByText(page, "div.core-select-popup.pulse-select-popup.core-select-popup-multiple div div.core-select-popup-inner div div", "li.core-select-option", value,inputBox);
            await page.waitForTimeout(3000);
        }

        console.log(`✅ Đã chọn ${values.length} giá trị cho "${labelText}"`);

    } catch (e) {
        console.error(`❌ Lỗi khi chọn giá trị cho "${labelText}":`, e);
    }
}

//

export async function enterDescription(page, element, content) {
    try {
        // Tìm phần tử div với selector CSS
        const descriptionField = await page.findElement(By.css(element));

        // Chờ đến khi phần tử có thể tương tác được (có thể sử dụng wait cho ổn định)
        await page.wait(1000); // Bạn có thể thay thế bằng các phương thức chờ khác nếu cần

        // Chỉnh sửa nội dung HTML của phần tử div
        await page.executeScript("arguments[0].innerHTML = arguments[1];", descriptionField, content);

        console.log(`Đã điền giá trị vào phần tử với selector "${element}"`);
    } catch (e) {
        console.log("Lỗi khi nhập vào phần tử:", e);
    }
}

export async function selectRadioButton(page, selector, value) {
    try {
        // Tìm tất cả các phần tử radio theo selector
        const labels = await page.$$(selector);

        // Lặp qua tất cả các label và tìm radio button có giá trị value tương ứng
        for (const label of labels) {
            const radioButton = await label.$('input[type="radio"]'); // Tìm input radio trong label
            const radioValue = await radioButton.evaluate(el => el.value); // Lấy giá trị value của radio button

            // So sánh giá trị radio với giá trị yêu cầu, không phân biệt hoa thường
            if (radioValue.toLowerCase() === value.toLowerCase()) {
                // Tìm span có class "core-icon-hover" trong cùng label
                const span = await label.$('span.core-icon-hover');

                if (span) {
                    // Click vào span có class "core-icon-hover"
                    await span.click();
                    console.log(`Đã chọn radio với value "${value}"`);
                    return;  // Kết thúc sau khi click vào radio button phù hợp
                } else {
                    console.log('Không tìm thấy span với class "core-icon-hover" trong label.');
                    return;
                }
            }
        }

        console.log(`Không tìm thấy radio với value "${value}"`);
    } catch (e) {
        console.log("Lỗi khi chọn radio button:", e);
    }
}

//chỉnh sửa variable
export async function uploadFileToPage(page, dataList) {
    // Lấy tất cả các thẻ input[type="file"] trên trang
    const fileInputs = await page.$$(`div.flex-row div.w-full div.flex-1 div div.core-space div.core-space-item div.cursor-default div.pulse-upload div.core-upload input[type="file"]`);

    // Duyệt qua từng phần tử trong danh sách dữ liệu và truyền ảnh vào các thẻ input[type="file"]
    for (let i = 0; i < dataList.length; i++) {
        const { filePath } = dataList[i]; // Lấy filePath từ dữ liệu
        const fileInput = fileInputs[i]; // Lấy thẻ input[type="file"] theo chỉ số i

        console.log(`Đang tải lên file ${filePath} vào thẻ input thứ ${i + 1}`);
        await fileInput.uploadFile(filePath); // Upload file vào thẻ input

        // Thêm sự kiện change để kích hoạt hành động sau khi tải lên
        await fileInput.evaluate(el => el.dispatchEvent(new Event('change')));
        console.log(`Tải lên thành công cho thẻ input thứ ${i + 1}`);
    }
}

export async function checkIfElementIsDisabled(page, elementSelector) {
    try {
        // Lấy phần tử
        const element = await page.$(elementSelector);

        // Kiểm tra xem phần tử có tồn tại không
        if (!element) {
            console.log(`Phần tử không tìm thấy: ${elementSelector}`);
            return false;
        }

        // Kiểm tra xem phần tử có class 'theme-arco-pagination-item-disabled' không
        const hasClass = await element.evaluate(el =>
            el.classList.contains('theme-arco-pagination-item-disabled') || el.classList.contains('core-pagination-item-disabled')
        );

        // Nếu có class 'theme-arco-pagination-item-disabled', trả về false
        return !hasClass;
    } catch (error) {
        console.error("Lỗi khi kiểm tra phần tử:", error);
        return false;
    }
}

export async function getFormattedDate(check) {
    let now = moment.tz('America/Los_Angeles'); // lấy thời gian hiện tại ở Los Angeles

    if (check === 1) {
        now.add(2, 'minutes'); // thêm 2 phút
    } else {
        now.add(3, 'days'); // thêm 3 ngày
    }

    const day = now.date();
    const month = now.month() + 1; // tháng là từ 0 đến 11
    const year = now.year();
    const hour = now.hours();
    const minute = now.minutes();
    const period = hour >= 12 ? 'PM' : 'AM';

    return {
        day: formatNumber(day).toString(),
        month: formatNumber(month).toString(),
        year: year.toString(),
        hour: formatNumber(hour > 12 ? hour - 12 : hour), // Điều chỉnh giờ theo định dạng 12 giờ
        minute: formatNumber(minute),
        period: period
    };
}

function formatNumber(num) {
    return num.toString().padStart(2, '0');  // Đảm bảo rằng số có ít nhất 2 chữ số
}

export async function parseSizes(sizeString) {
    // Sử dụng regex để tách các phần size và giá trị
    const sizeArray = sizeString.match(/\(([^)]+)\)/g).map(item => {
        const [size, value] = item.slice(1, -1).split(": ");
        return { size, value: parseFloat(value) };
    });
    return sizeArray;
}
//xuat du lieu the div tim dc
export async function extractTextFromElements(page, selector) {
    try {
        // Chờ cho tất cả các phần tử có selector xuất hiện trên trang
        const elements = await page.$$eval(selector, (els) => {
            // Trả về mảng văn bản của các phần tử
            return els.map(el => el.textContent.trim());
        });

        // Kiểm tra nếu không có dữ liệu
        if (elements.length === 0) {
            console.log(`Không tìm thấy phần tử nào với selector: ${selector}`);
        } else {
            console.log(`Đã trích xuất ${elements.length} phần tử với selector: ${selector}`);
        }

        // Trả về mảng chứa văn bản của các phần tử
        return elements;
    } catch (e) {
        console.log("Lỗi khi trích xuất văn bản từ các phần tử:", e);
    }
}

export async function scrollToBottom(page, selector) {
    try {
        // Chờ phần tử xuất hiện
        const element = await page.waitForSelector(selector, { timeout: 10000, state: 'visible' });

        if (element) {
            // Lấy chiều cao của phần tử và chiều cao có thể nhìn thấy
            const scrollHeight = await element.evaluate(el => el.scrollHeight);
            const clientHeight = await element.evaluate(el => el.clientHeight);
            let scrollPosition = 0;
            const scrollStep = 10; // Mỗi lần cuộn di chuyển 10px
            const interval = 15; // Thời gian giữa các lần cuộn (ms)

            // Cuộn từ từ bằng cách tăng scrollTop dần
            const smoothScroll = setInterval(async () => {
                scrollPosition += scrollStep;

                // Cuộn xuống
                await element.evaluate((el, position) => {
                    el.scrollTop = position;
                }, scrollPosition);

                // Kiểm tra nếu đã cuộn đến đáy
                if (scrollPosition >= scrollHeight - clientHeight) {
                    clearInterval(smoothScroll);
                    console.log('Đã cuộn đến đáy');
                }
            }, interval); // Thực hiện cuộn mỗi 15ms
        } else {
            console.log(`Không tìm thấy phần tử: ${selector}`);
        }
    } catch (e) {
        console.log("Lỗi khi thao tác cuộn phần tử:", e);
    }
}

export async function smoothScrollToTop(page, selector) {
    try {
        // Chờ phần tử xuất hiện
        const element = await page.waitForSelector(selector, { timeout: 10000, state: 'visible' });

        if (element) {
            // Lấy chiều cao của phần tử và chiều cao có thể nhìn thấy
            const scrollHeight = await element.evaluate(el => el.scrollHeight);
            const clientHeight = await element.evaluate(el => el.clientHeight);
            let scrollPosition = scrollHeight;  // Bắt đầu từ vị trí cuộn hiện tại
            const scrollStep = 10; // Mỗi lần cuộn di chuyển 10px
            const interval = 15; // Thời gian giữa các lần cuộn (ms)

            // Cuộn từ từ bằng cách giảm scrollTop dần
            const smoothScroll = setInterval(async () => {
                scrollPosition -= scrollStep;

                // Cuộn lên đầu
                await element.evaluate((el, position) => {
                    el.scrollTop = position;
                }, scrollPosition);

                // Kiểm tra nếu đã cuộn đến đầu
                if (scrollPosition <= 0) {
                    clearInterval(smoothScroll);
                    console.log('Đã cuộn lên đầu');
                }
            }, interval); // Thực hiện cuộn mỗi 15ms
        } else {
            console.log(`Không tìm thấy phần tử: ${selector}`);
        }
    } catch (e) {
        console.log("Lỗi khi thao tác cuộn phần tử:", e);
    }
}

//ham chờ
export async function waitForElement(page, selector, timeout ) {
    // Tạo promise cho việc chờ đợi phần tử
    const elementPromise = page.waitForSelector(selector, { visible: true, timeout });

    // Tạo promise để hủy sau thời gian timeout
    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error(`Timeout after ${timeout / 1000} seconds waiting for element: ${selector}`));
        }, timeout);
    });

    // Sử dụng Promise.race để chờ cho đến khi phần tử xuất hiện hoặc hết thời gian
    try {
        await Promise.race([elementPromise, timeoutPromise]);
        console.log(`Element ${selector} appeared.`);
        return true; // Trả về true nếu phần tử xuất hiện
    } catch (error) {
        console.log(`Error: ${error.message}`);
        return false; // Trả về false nếu hết thời gian
    }
}
// Hàm tạo tên sheet từ thời gian hiện tại (giờphútgiâyngàythángnăm)
function getFormattedSheetName() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();

    return `${hours}${minutes}${seconds}${day}${month}${year}`;
}

export async function getDateToday() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();

    return `${hours}:${minutes}:${seconds}-${day}/${month}/${year}`;
}
// Hàm nhận vào tên cột và dữ liệu từng hàng
export async function processTableData(colum,data,output,outputRoot) {

    const outputPath = path.resolve(output);

    // Tạo workbook mới hoặc mở workbook đã tồn tại
    const workbook = new ExcelJS.Workbook();

    if (fs.existsSync(outputPath)) {
        // Nếu tệp đã tồn tại, đọc tệp Excel
        await workbook.xlsx.readFile(outputPath);
    }

    // Tạo một sheet mới với tên mới dựa trên thời gian
    const sheetName = getFormattedSheetName();
    const worksheet = workbook.addWorksheet(sheetName);

    // Đặt tên các cột
    worksheet.columns = colum;

    // Thêm dữ liệu vào bảng
    // worksheet.addRow({ productName: 'T-shirt A', productId: '003', sold: 20, view: 150 });
    // worksheet.addRow({ productName: 'T-shirt B', productId: '002', sold: 35, view: 200 });

    data.forEach(row => worksheet.addRow(row));


    // Đảm bảo thư mục Output nằm ở cấp gốc của dự án
    const dir = path.resolve(outputRoot);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Ghi tệp vào thư mục Output
    await workbook.xlsx.writeFile(outputPath);

    console.log(`File Excel đã được tạo tại ${outputPath} với sheet tên là ${sheetName}`);

    // const outputPath = path.resolve('./../Output/checkView/product_data.xlsx');
    //
    // // Tạo workbook mới hoặc mở workbook đã tồn tại
    // const workbook = new ExcelJS.Workbook();
    //
    // if (fs.existsSync(outputPath)) {
    //     // Nếu tệp đã tồn tại, đọc tệp Excel
    //     await workbook.xlsx.readFile(outputPath);
    // }
    //
    // // Tạo một sheet mới với tên mới dựa trên thời gian
    // const sheetName = getFormattedSheetName();
    // const worksheet = workbook.addWorksheet(sheetName);
    //
    // // Đặt tên các cột
    // worksheet.columns = [
    //     { header: 'Product Name', key: 'productName' },
    //     { header: 'Product ID', key: 'productId' },
    //     { header: 'Sold', key: 'sold' },
    //     { header: 'View', key: 'view' }
    // ];
    //
    // // Thêm dữ liệu vào bảng
    // worksheet.addRow({ productName: 'T-shirt A', productId: '003', sold: 20, view: 150 });
    // worksheet.addRow({ productName: 'T-shirt B', productId: '002', sold: 35, view: 200 });
    //
    // // Đảm bảo thư mục Output nằm ở cấp gốc của dự án
    // const dir = path.resolve('./../Output/checkView');
    // if (!fs.existsSync(dir)) {
    //     fs.mkdirSync(dir, { recursive: true });
    // }
    //
    // // Ghi tệp vào thư mục Output
    // await workbook.xlsx.writeFile(outputPath);
    //
    // console.log(`File Excel đã được tạo tại ${outputPath} với sheet tên là ${sheetName}`);
}


// Hàm để chia tài khoản thành các nhóm tối đa 3 tài khoản
export function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}
export const hide = new Hidemyacc();


export const delayTime = (ms) => delay(ms); // Sử dụng lại delay cho các bước khác
