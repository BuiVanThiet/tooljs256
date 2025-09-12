import Promise from "bluebird";

export const windowScroll = async function (
  page,
  scrollDistance = 1000,
  scrollStep = 250,
  scrollDelay = 100
) {
  await page.evaluate(
    async (step, delay, distance) => {
      await new Promise((resolve) => {
        var totalHeight = 0;
        var timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, step);
          if (step > 0) {
            totalHeight += step;
          } else {
            totalHeight -= step;
          }

          if (totalHeight >= scrollHeight || totalHeight >= distance) {
            clearInterval(timer);
            resolve();
          }
        }, delay);
      });
    },
    scrollStep,
    scrollDelay,
    scrollDistance
  );
};
export const unixtime = () => {
  return Math.floor(new Date().getTime() / 1000);
};
export const delay = async function (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
};
export const getRandomInt = (max) => {
  return Math.floor(Math.random() * max);
};
export const getRandomIntBetween = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
};

export const getKeyword = function (keywordSearch) {
  let keyword = "";
  for (i = 0; i < 100; i++) {
    const index = Math.floor(Math.random() * keywordSearch.length);
    keyword = keywordSearch[index].toLowerCase();
    if (keyword.length > 3) break;
  }

  return keyword;
};

export const getElementByID = async function (
  page,
  id,
  timeout = 30000,
  visible = false
) {
  try {
    const selector = "#" + id;
    return await page.waitForSelector(selector, { timeout, visible });
  } catch (error) {
    return null;
  }
};

export const clickElement = async function (page, selector) {
  await page.$eval(selector, (e) => e.click());
};

export const scrollToElement = async function (page, elem) {
  try {
    const boundingBox = await elem.boundingBox();
    await page.mouse.move(
      boundingBox.x + boundingBox.width / 2,
      boundingBox.y + boundingBox.height / 2
    );

    await page.mouse.wheel({ deltaY: -100 });
  } catch (error) {
    console.error(error);
  }
};

export const waitForNavigation = async (page, timeout = 60000) => {
  try {
    return await page.waitForNavigation({
      waitUntil: "networkidle0",
      timeout,
    });
  } catch (error) {
    return null;
  }
};
export const waitForNavigation2 = async function (page, timeout = 60000) {
  try {
    return await page.waitForNavigation({
      waitUntil: "networkidle2",
      timeout,
    });
  } catch (error) {
    return null;
  }
};
export const getAllText = async function (page) {
  try {
    const text = await page.$eval("*", (el) => el.innerText);
    return text;
  } catch (err) {
    return "";
  }
};
export const getText = async function (page, element) {
  try {
    const text = await page.evaluate((el) => el.innerText, element);
    return text;
  } catch (err) {
    return "";
  }
};

export const getValue = async function (page, element) {
  try {
    const text = await page.evaluate((el) => el.value, element);
    return text;
  } catch (err) {
    return "";
  }
};
export const getElementByXpath = async function (
  page,
  selector,
  timeout = 60000
) {
  try {
    return await page.waitForXPath(selector, { timeout });
  } catch (error) {
    return null;
  }
};
export const getElementsByXpath = async function (page, selector) {
  try {
    return await page.$$(selector);
  } catch (error) {
    console.log(error);
    return null;
  }
};
export const getElementByName = async function (page, name, loop = 30) {
  let element;
  for (let i = 0; i < loop; i++) {
    if (i == 0) {
      console.log("GET element by name");
    }

    try {
      element = await page.$('[name="' + name + '"]', { timeout: 1000 });
    } catch (error) {
      element = null;
    }
    if (element) return element;
    await delay(1000);
  }
};

export const getElement = async function (page, selector, loop = 30) {
  let element;
  for (let i = 0; i < loop; i++) {
    try {
      if (i == 0) {
        console.log("GET element " + selector);
      }
      element = await page.$(selector, { timeout: 1000 });
    } catch (error) {
      element = null;
    }
    if (element) return element;
    await delay(1500);
  }
};

export const getElements = async function (page, selector, loop = 30) {
  let elements;
  for (let i = 0; i < loop; i++) {
    try {
      if (i == 0) {
        console.log("GET elements");
      }
      elements = await page.$$(selector, { timeout: 1000 });
    } catch (error) {
      elements = null;
    }
    if (elements && elements.length) return elements;
    await delay(1500);
  }
};

export const getElementByClass = async function (page, name, loop = 30) {
  let element;
  for (let i = 0; i < loop; i++) {
    try {
      if (i == 0) {
        console.log("GET element by Class");
      }
      element = await page.$('[class="' + name + '"]', { timeout: 1000 });
    } catch (error) {
      element = null;
    }
    if (element) return element;
    await delay(1500);
  }
};
