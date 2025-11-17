const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const time1 = new Date();
//读取用户列表文件txt
const userfile = path.resolve(__dirname, 'hostinfo.txt');
const userstr = fs.readFileSync(userfile, 'utf8').trim();
const [username,hostname] = userstr.split('@');
//读取密码文件
const passfile = path.resolve(__dirname, 'password.txt');
const password = fs.readFileSync(passfile, 'utf8').trim();

const ipfile = path.resolve(__dirname, 'ip.txt');
const ip=fs.readFileSync(ipfile, 'utf8').trim();
console.log(username,hostname,ip);
const account = {
    username,
    hostname,
    password,
    ip
}
const generateRandomUA = () => {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15'
    ];
    const randomUAIndex = Math.floor(Math.random() * userAgents.length);
    return userAgents[randomUAIndex];
};
async function delayTime(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// 模拟登录函数
async function account_login(account) {
    const { username, hostname, password } = account;
    // 启动浏览器
    const browser = await puppeteer.launch({
        headless: true, // 设置为false可以看到浏览器界面，方便调试
        args: ['--start-maximized'],// 最大化窗口
        defaultViewport: {
            width: 1280,
            height: 1180
        }
    });
    // 打开新页面
    const page = await browser.newPage();
    const customUA = generateRandomUA();
    await page.setUserAgent(customUA);
    try {
        // 导航到登录页面
        await page.goto(`https://panel${hostname.slice(1)}/login/?next=/`, {
            waitUntil: 'networkidle2', // 等待网络空闲
            timeout: 60000 // 超时时间设置为60秒
        });
        await page.waitForSelector('input[name="username"]', { visible: true });
        await page.waitForSelector('input[name="password"]', { visible: true });

        // 输入用户名和密码
        await page.type('input[name="username"]', username, { delay: 100 });
        await page.type('input[name="password"]', password, { delay: 200 });

        // 点击登录按钮
        const submitBtn=await page.$('.login-form__button button[type=submit]')
        await submitBtn.click()
            // page.click('button[type="submit"]', { delay: 500 }) // 点击登录按钮
        await  page.waitForNavigation({ waitUntil: 'networkidle2' }); // 等待导航完成
        // 等待登录完成
        await page.waitForSelector(`a[href="/logout/"]`, { visible: true });
        let mes = `账号: ${username}@${hostname} 登录成功！\n From: ${ip}`;
        account.success = true;
        account.message = mes;
        console.log(mes);


    } catch (error) {
        account.success = false;
        let mes = `账号: ${username}@${hostname} 登录失败！\n From: ${ip}`;
        account.message = mes;
        console.error(mes, '\n', error);
    } finally {
        const delay = Math.floor(Math.random() * 3) + 3;
        await delayTime(delay * 1000);
        await browser.close();
    }
    return account;
}

//==========TG通知===========================
async function sendSummary(results) {
    const successfulLogins = results.filter(r => r.success);
    const failedLogins = results.filter(r => !r.success);
    let summaryMessage = '\n';
    if (successfulLogins.length > 0) {
        successfulLogins.forEach(({ message }) => summaryMessage += message);
    };
    if (failedLogins.length > 0) {
        failedLogins.forEach(({ message }) => summaryMessage += message);
    }
    const nowBeijing = formatTzone(8); // 北京时间东8区
    const time2 = new Date; //统计任务耗时
    const taketime = gettaketime(time2 - time1);
    const ip = fs.readFileSync('ip.txt', 'utf-8').trim();
    let summaryMsg = `任务完成：${nowBeijing}\n`;
    summaryMsg += `任务耗时：${taketime}\n`;
    summaryMsg += `登录统计：\u3000成功：${successfulLogins.length}\u3000`;
    if (failedLogins.length > 0) {
        summaryMsg += `\u3000失败：${failedLogins.length}\n`;
    } else {
        summaryMsg += '\n';
    }
    summaryMsg += `服务器IP：${ip}\n`;
    summaryMessage = summaryMsg + summaryMessage;
    console.log(summaryMessage);
    // await sendTelegramMessage(summaryMessage);
}
async function sendTelegramMessage(message) {
    // 读取 telegram 信息
    const telegramJson = fs.readFileSync('telegram.json', 'utf-8');
    const telegramConfig = JSON.parse(telegramJson);
    const { telegramBotToken, telegramBotUserId } = telegramConfig;
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: telegramBotUserId,
                text: message
            })
        });
    } catch (error) {
        console.error('Error sending Telegram message:', error);
    }
}

// 格式化时间
function formatTzone(zone) {
    let nowtime = new Date().getTime();
    let ztime = new Date(nowtime + (zone * 60 * 60 * 1000));
    let outstr;
    if (zone == 8) {
        let dt = ztime.toISOString();
        outstr = dt.replace(/T|Z|\..*/g, ' ');
    } else {
        let dt = ztime.toGMTString().split(/ |:/);
        let Y = dt[3];
        let M = dt[2];
        let D = dt[1];
        let h = dt[4];
        let m = dt[5];
        let s = dt[6];
        let am = h > 12 ? "p.m." : 'a.m.';
        // 定制格式
        outstr = `${M}.${D},${Y}, ${h > 12 ? h - 12 : h}:${m} ${am}`;
    }
    return outstr;
}
function gettaketime(ms) {
    const milliSeconds = ms % 1000;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    let res = milliSeconds + '毫秒';
    if (seconds > 0) res = seconds + '秒' + res;
    if (minutes > 0) res = minutes + '分' + res;
    if (hours > 0) res = hours + '小时' + res;
    return res;
}
// 批量同时异步登录
async function main(allaccounts) {
    // 同步：每个用户依次登录
    // for (const account of allaccounts) {
    //   await account_login(account);
    // }
    //异步同时登录
    //const results = await Promise.all(allaccounts.map(account => account_login(account)));
    // console.log('results:', results);
    // TG通知
     await Promise.all([
            await account_login(account), // 等待登录完成
            await sendTelegramMessage(account.message) // 提交TG通知
    ]);
}

