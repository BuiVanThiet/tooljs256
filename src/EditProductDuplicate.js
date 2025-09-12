import Promise from "bluebird";
import Hidemyacc from "./hidemyacc.js";
import { loginToProfile,
    openProductPage,
    closeBrowserAndStop,
    getIdAcc,
    scrollAndClickElement,
    closeBrowser,
    delayTime,
    fillInput,
    loadList,
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
    openPage,
    closeOldPage} from "../src/service/BaseToolService.js"
import { readExcelFile } from "../src/service/openFileExcel.js";
import path from "path";
const hide = new Hidemyacc();


// Đọc dữ liệu từ file Excel
const products = readExcelFile("InputImageVariation.xlsx");
async function indexComponent(page,element,valueCheck) {
    const inputs = await page.$$(element);
    let index = 0;
    for (let input of inputs) {

        // Lấy giá trị của từng input
        const value = await input.evaluate(el => el.value);
        // In ra giá trị và chỉ số
        console.log(`Index: ${index}, Value: ${value}`);
        // Tăng chỉ số
        if (valueCheck == value) {
            return index;
        }
        index++;
    }
    return -1;
}

async function indexDeleteInput(page, element, valueCheck) {
    const inputs = await page.$$(element); // Lấy tất cả các thẻ input
    let invalidIndexes = [];

    for (let index = 0; index < inputs.length; index++) {
        // Lấy giá trị của từng input
        const value = await inputs[index].evaluate(el => el.value);
        // In ra giá trị và chỉ số
        console.log(`Index: ${index}, Value: ${value}`);

        // Kiểm tra xem giá trị có không khớp với valueCheck không
        if (!valueCheck.includes(value)) {
            invalidIndexes.push(index); // Thêm vào mảng các chỉ số không khớp
        }
    }

    return invalidIndexes;
}
function getColorFromPath(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath)); // Lấy tên file không có phần mở rộng
    return fileName; // Trả về tên màu
}
async function checkElementInView(page, selector) {
    const element = await page.$(selector);
    if (!element) return false;

    const boundingBox = await element.boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    // Kiểm tra xem phần tử có nằm trong phạm vi nhìn thấy không
    return boundingBox && boundingBox.top >= 0 && boundingBox.top < viewportHeight;
}
async function scrollIntoViewIfNeeded(page, selector) {
    const isInView = await checkElementInView(page, selector);
    if (!isInView) {
        await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, selector);
        await delayTime(1000); // Đợi sau khi cuộn trang
    }
}


async function checkDisableInputPrice(page) {
    const selector = "div#skus div.mt-8 div div div.core-input-group-wrapper span.core-input-group span.core-input-inner-wrapper input[role='spinbutton'].core-input.core-input-size-default";

    try {
        const inputs = await page.$$(selector);

        if (inputs.length === 0) {
            console.log("❌ Không tìm thấy phần tử input nào.");
            return false;
        }

        for (const input of inputs) {
            const isDisabled = await input.evaluate(el => el.disabled);
            if (isDisabled) {
                console.log("⛔ Một trong các input bị disabled. Thoát...");
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error("Lỗi khi kiểm tra các input:", error.message);
        return false;
    }
}
// Hàm chính xử lý từng sản phẩm
const promises = products.map(async (product, index) => {
    try {
        console.log("Processing account: ", product.nameAcc);
        const profileId = await getIdAcc(product.nameAcc);

        // Bước 1: Đăng nhập vào Hidemyacc và khởi tạo trình duyệt
        const { browser, context } = await loginToProfile(hide, profileId, index);
        if (!browser || !context) {
            return;
        }

        const newPage = await openPage(context, product.linkProduct, { waitUntil: 'load',timeout: 60000 });
        await closeOldPage(context);
        for (let i = 0;i<9;i++) {
            const elementsHover = await newPage.$$('div.dndContainerV2-tdbMJG div.grid div.uploadRender-gyBS2T div.commonImage-hulquZ div.succeed-lqV0m6');
            if(elementsHover.length <= 0) {
                break;
            }
            await scrollAndHoverElement(newPage,"div.dndContainerV2-tdbMJG div.grid div.uploadRender-gyBS2T div.commonImage-hulquZ div.succeed-lqV0m6");
            await delayTime(3000);
            const elements = await newPage.$$('div.commonImage-hulquZ div.succeed-lqV0m6 div.core-space.core-space-horizontal.core-space-align-center.pulse-space div.core-space-item');
            elements[2].click();
            await delayTime(3000);
        }
        await delayTime(3000);
        const uploadInputSelector = "div.cursor-default div.pulse-upload div.core-upload-type-picture-card input[type=\"file\"]"; // Selector cho input file (cần thay đổi selector phù hợp nếu cần)
        // Đẩy ảnh vào input
        await newPage.setInputFiles(uploadInputSelector, product.listImage);
        console.log("Đã tải lên 9 ảnh");
        await delayTime(3000);
        const elementNameProduct = "input[data-id='product.publish.product_name']";

        // Cuộn đến phần tử nếu cần thiết
        await scrollIntoViewIfNeeded(newPage, elementNameProduct);

        await delayTime(3000);
        await fillInput(newPage, elementNameProduct, product.nameProduct);
        await delayTime(3000);
        const isDisabled = await newPage.$eval(
            "div[data-id='product.publish.variation.switch'] button[role='switch']",
            (button) => button.disabled
        );

        const selector = 'div.flex.bg-neutral-bg2.rounded-8 div.flex-1 div.relative div.flex.flex-row.relative div.w-full div[role="combobox"] div.core-select-view span.core-select-view-selector span.core-select-view-value';

        try {
            const values = await newPage.$$eval(selector, elements =>
                elements.map(el => el.textContent.trim().toLowerCase()) // 👈 chuyển hết về chữ thường
            );

            console.log("Các giá trị đã lấy:", values);
            let checkColorText = false;
            for (let col=0;col <values.length;col++) {
                let value = values[col];
                console.log("value: "+value)
                if (value === 'color') {
                    checkColorText = true;
                    break;
                }
            }

            if (checkColorText) {
                console.log("✅ Tìm thấy giá trị chứa 'color', tiếp tục xử lý...");
                console.log("isDisabled: "+isDisabled)
                console.log("product.variationStatus: "+product.variationStatus)
                if (isDisabled == false) {
                    if (product.variationStatus.toLowerCase() !== 'không có') {
                        let isVariationOn = await product.variationStatus.toLowerCase() === 'on' ? "true" : "false";
                        const ariaChecked = await newPage.$eval("div.flex-1 div.relative div.mt-16 div.pulse-switch-container button.core-switch", (button) => {
                            return button.getAttribute('aria-checked');
                        });
                        console.log("ariaChecked: " + ariaChecked)
                        console.log("isVariationOn: " + isVariationOn)
                        if (!(isVariationOn === ariaChecked)) {
                            console.log("Đã ấn do khác nhau")
                            await scrollAndClickElement(newPage,"div.flex-1 div.relative div.mt-16 div.pulse-switch-container button.core-switch");
                            await delayTime(3000);
                        }
                    }
                }

                // Mảng để lưu các phần tử không được điền
                const failedUploads = [];
                let fileInputs = await newPage.$$(`div.flex-row div.w-full div.flex-1 div div.core-space div.core-space-item div.cursor-default div.pulse-upload div.core-upload input[type="file"]`);
                if (fileInputs.length > 0) {
                    for (let data of product.listImage) {
                        const nameColor = await getColorFromPath(data);  // Lấy tên màu từ đường dẫn hình ảnh
                        console.log(nameColor);

                        let i = await indexComponent(newPage, 'div.flex-row div.w-full div.flex-1 div.w-full div.core-input-group-wrapper span.core-input-group span.core-input-inner-wrapper input.core-input', nameColor);
                        console.log(data);

                        // Lấy tất cả các thẻ input[type="file"] trên trang
                        fileInputs = await newPage.$$(`div.flex-row div.w-full div.flex-1 div div.core-space div.core-space-item div.cursor-default div.pulse-upload div.core-upload input[type="file"]`);

                        // Kiểm tra nếu chỉ số i hợp lệ (nằm trong phạm vi mảng)
                        if (i >= 0 && i < fileInputs.length) {
                            const fileInput = fileInputs[i];  // Chọn thẻ input tương ứng với chỉ số i
                            // Thực hiện thao tác upload file
                            await fileInput.setInputFiles(data);
                            console.log(`File uploaded for ${data}`);
                            await delayTime(2000);  // Delay 2 giây sau mỗi lần upload
                        } else {
                            // Nếu không thể tìm thấy input file hợp lệ, lưu vào mảng failedUploads
                            console.error(`Invalid index ${i}. Input file not found.`);
                            failedUploads.push({ nameColor, data });
                        }
                    }

                    // Sau khi hoàn thành, in ra các phần tử không được điền
                    console.log('Failed uploads:', failedUploads);
                    let listNameColor = [];
                    for (let data of product.listImage) {
                        const nameColor = await getColorFromPath(data);
                        listNameColor.push(nameColor);
                    }
                    const invalidIndexes = await indexDeleteInput(newPage, 'div.flex-row div.w-full div.flex-1 div.w-full div.core-input-group-wrapper span.core-input-group span.core-input-inner-wrapper input.core-input', listNameColor);
                    console.log(invalidIndexes);
                    const reversedIndexes = invalidIndexes.reverse();

                    for (let index of reversedIndexes) {
                        console.log(`Index: ${index}`);
                        const elementsDelete = await newPage.$$('div.flex div.flex-1 div.relative.bg-neutral-bg2 div div div[role=\'button\'].flex button.core-btn');
                        elementsDelete[index].click();
                        await delayTime(3000);
                    }
                    for (let failed of failedUploads) {
                        console.log(`Name Color: ${failed.nameColor}`);
                        console.log(`Data: ${failed.data}`);
                        const inputs = await newPage.$$('div.flex-row div.w-full div.flex-1 div.w-full div.core-input-group-wrapper span.core-input-group span.core-input-inner-wrapper input.core-input');
                        if (inputs.length > 0) {
                            const index = inputs.length - 1;
                            const lastInput = inputs[index];  // Lấy phần tử cuối cùng trong mảng

                            // Ghi giá trị vào input cuối cùng
                            await lastInput.fill(failed.nameColor);
                            await delayTime(3000);
                            const elements = await newPage.$$('div#sale_properties div[aria-roledescription="sortable"] div.flex-1 div.relative div.justify-between span.font-medium.text-neutral-text2');
                            if (elements.length > 0) {
                                // Nhấn vào phần tử đầu tiên (index 0)
                                await elements[0].click();
                                console.log('Clicked on the first element');
                                await delayTime(5000);
                            } else {
                                console.error('No elements found');
                            }

                            await delayTime(5000);
                            console.log('Value "hi" written to the last input');
                            const fileInputs = await newPage.$$(`div.flex-row div.w-full div.flex-1 div div.core-space div.core-space-item div.cursor-default div.pulse-upload div.core-upload input[type="file"]`);
                            const fileInput = fileInputs[index];  // Chọn thẻ input tương ứng với chỉ số i

                            // Thực hiện thao tác upload file
                            await fileInput.setInputFiles(failed.data);
                            console.log(`File uploaded for ${failed.data}`);
                            await delayTime(5000);  // Delay 2 giây sau mỗi lần upload
                        } else {
                            console.error('No input elements found');
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Lỗi khi lấy giá trị từ combobox:", error.message);
        }

        await scrollAndClickElement(newPage,"div#skus div.flex-col div.flex.flex-row.justify-between.mb-12.items-center div.flex.items-center.w-full div button[data-id='product.publish.skus.batch_edit']");
        await delayTime(5000)

        const elementsSelected = await newPage.$$('div#skus div.mt-8 div[role="combobox"][aria-haspopup="listbox"].core-select.core-select-single');
        let numberSelected = 0;
        for (let i = 0;i<elementsSelected.length;i++) {
            const element = await elementsSelected[i];  // Lấy phần tử tại index i
            await element.click();  // Nhấn vào phần tử
            const elementsLI = await newPage.$$("span[trigger-placement='bottom'] div.core-select-popup.pulse-select-popup div.core-select-popup-inner div div li[role='option'].core-select-option.pulse-select-option");
            for (let l = 0; l < elementsLI.length; l++) {
                const textLI = await elementsLI[l].evaluate(el => el.innerText);  // Lấy nội dung văn bản của phần tử li
                // So sánh không phân biệt hoa thường
                let dataSize = 'XL';
                if (textLI.trim().toLowerCase() === dataSize.trim().toLowerCase()) {
                    await elementsLI[l].click();
                    await delayTime(3000);
                    numberSelected = i;
                    break;
                }
            }
        }

        for (let data of product.priceEdit) {
            console.log("size: "+data.size)
            console.log("price: "+data.price)
            console.log("numberSelected: ",numberSelected)
            const elementsSelected = await newPage.$$('div#skus div.mt-8 div[role="combobox"][aria-haspopup="listbox"].core-select.core-select-single');
            const element = await elementsSelected[numberSelected];  // Lấy phần tử tại index i
            await element.click();  // Nhấn vào phần tử
            const elementsLI = await newPage.$$("span[trigger-placement='bottom'] div.core-select-popup.pulse-select-popup div.core-select-popup-inner div div li[role='option'].core-select-option.pulse-select-option");
            for (let i = 0; i < elementsLI.length; i++) {
                const textLI = await elementsLI[i].evaluate(el => el.innerText);  // Lấy nội dung văn bản của phần tử li
                // So sánh không phân biệt hoa thường
                if (textLI.trim().toLowerCase() === data.size.trim().toLowerCase()) {
                    await elementsLI[i].click();
                    await delayTime(3000);
                    break;
                }
            }

            let checkInputPrice = await checkDisableInputPrice(newPage);

            if (checkInputPrice == false) {
                break;
            }

            const inputs = await newPage.$$("div#skus div.mt-8 div div div.core-input-group-wrapper span.core-input-group span.core-input-inner-wrapper input[role='spinbutton'].core-input.core-input-size-default");
            await inputs[0].fill((data.price).toString())
            await delayTime(2000);
            await inputs[2].fill("9")
            await delayTime(2000);
            await scrollAndClickElement(newPage,"div#skus div.mt-8 button.core-btn.core-btn-secondary");
            await delayTime(2000);
        }
        let dataCheck = await splitByComma(product.productCompliance);

        await selectRadioButton(newPage,"div#LegalProductProperties101400 label[data-tid=\"m4b_radio\"]",dataCheck[0])
        await delayTime(1000)
        await selectRadioButton(newPage,"div#LegalProductProperties101395 label[data-tid=\"m4b_radio\"]",dataCheck[1])
        await delayTime(1000)
        await selectRadioButton(newPage,"div#LegalProductProperties101619 label[data-tid=\"m4b_radio\"]",dataCheck[2])
        await delayTime(1000)
        await delayTime(10000);
        await scrollAndClickElement(newPage,"div.w-full div.flex div.flex button.core-btn.core-btn-primary");
        await delayTime(5000);
        await scrollAndClickElement(newPage,"div.core-modal div.core-modal-footer div.pulse-modal-footer button.core-btn.core-btn-primary.core-btn-size-large");
        await delayTime(10000);
        // Đóng browser sau khi thực hiện
        // await closeBrowser(product.nameAcc);
    } catch (e) {
        console.error("Lỗi:", e);
    }
});

// Chạy song song tất cả các Promise
await Promise.all(promises);
