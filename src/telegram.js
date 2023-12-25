const c = global.chalk;
const Telegraf = global.telegraf;
const Keyboard = global.telegram_keyboard;
const { setConst, load, updateFile, getConst, loadConfig, loadSettings } = global.storage;
const log = global.log;

class TelegramBot {
    constructor(token) {
        this.bot = new Telegraf(token);

        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
        this.bot.catch((err) => {
            log(`Ошибка бота telegram: ${err}`, 'r');
        })
    }

    async run() {
        this.setupListeners();
        await this.setupBot();

        this.bot.launch();
        log(`Управление через telegram бота ${c.yellowBright(this.botInfo.username)} запущено.`, 'g');
    }

    async setupBot() {
        this.botInfo = await this.bot.telegram.getMe();
        this.bot.options.username = this.botInfo.username;

        this.mainKeyboard = this.getMainKeyboard();
        this.editGoodsKeyboard = this.getEditGoodsKeyboard();
        this.selectIssueTypeKeyboard = this.getSelectIssueTypeKeyboard();
        this.backKeyboard = this.getBackKeyboard();
        this.configKeyboard = this.getConfigKeyboard();

        this.waitingForLotDelete = false;
        this.waitingForLotName = false;
        this.waitingForLotContent = false;
        this.waitingForDeliveryFile = false;

        this.lotType = '';
        this.lotName = '';
        this.lotContent = '';
        this.products = [];
    }

    setupListeners() {
        this.bot.on('text', (ctx) => this.onMessage(ctx));
        this.bot.on('document', (ctx) => this.onMessage(ctx));
        this.bot.on('inline_query', (ctx) => this.onInlineQuery(ctx));
    }
    
    async onMessage(ctx) {
        try {
            const msg = ctx.update.message.text;
            
            if(!this.isUserAuthed(ctx)) {
                ctx.reply('Привет! 😄\nДля авторизации введи свой ник в настройках FunPay Server, после чего перезапусти бота.');
                return;
            }
    
            if(msg == '🔥 Статус 🔥') {
                this.replyStatus(ctx);
                return;
            }

            if(msg === '⚙️ Конфиг ⚙️') {
                this.replyConfig(ctx);
                return;
            }

            if(msg === '🟢 Всегда онлайн 🟢') {
                this.alwaysOnlineConfigChange(ctx);
                return;
            }

            if(msg === '⬆️ Автоподнятие предложений ⬆️') {
                this.lotsRaiseConfigChange(ctx);
                return;
            }

            if(msg === '1. 📦') {
                this.newOrderNonAutoNotificationConfigChange(ctx);
                return;
            }

            if(msg === '2. ✉️') {
                this.newMessageNotificationConfigChange(ctx);
                return;
            }

            if(msg === '3. ⬆️') {
                this.lotsRaiseNotificationConfigChange(ctx);
                return;
            }

            if(msg === '4. 🚚') {
                this.deliveryNotificationConfigChange(ctx);
                return;
            }

            if(['🔥 Отключить всё 🔥', '✅ Включить всё ✅'].includes(msg)) {
                this.toggleAllConfig(ctx, msg);
                return;
            }

            if(msg == '🚀 Редактировать автовыдачу 🚀') {
                this.editAutoIssue(ctx);
                return;
            }

            if(msg == '❔ Инфо ❔') {
                this.getInfo(ctx);
                return;
            }

            if(msg == '☑️ Добавить товар ☑️') {
                this.addProduct(ctx);
                return;
            }

            if(msg == '📛 Удалить товар 📛') {
                this.removeProduct(ctx);
                return;
            }

            if(msg == 'Инструкция (выдача одного и того же текста)') {
                this.lotType = 'instruction';
                this.addProductName(ctx);
                return;
            }

            if(msg == 'Аккаунты (выдача разных текстов по очереди)') {
                this.lotType = 'accounts';
                this.addProductName(ctx);
                return;
            }

            if(msg == '⬇️ Получить файл автовыдачи ⬇️') {
                await this.getAutoIssueFile(ctx);
                return;
            }

            if(msg == '⬆️ Загрузить файл автовыдачи ⬆️') {
                this.uploadAutoIssueFile(ctx);
                return;
            }

            if(msg == '🔙 Назад 🔙') {
                await this.back(ctx);
                return;
            }

            if(this.waitingForLotName) {
                await this.saveLotName(ctx);
                return;
            }

            if(this.waitingForLotContent) {
                await this.saveLotContent(ctx);
                return;
            }

            if(this.waitingForLotDelete) {
                await this.deleteLot(ctx);
                return;
            }

            if(this.waitingForDeliveryFile) {
                await this.onUploadDeliveryFile(ctx);
                return;
            }

            this.waitingForLotName = false;
            this.waitingForLotContent = false;
            this.waitingForLotDelete = false;
            this.waitingForDeliveryFile = false;
            
            ctx.reply('🏠 Меню', this.mainKeyboard.reply());
        } catch (err) {
            log(`Ошибка при обработке telegram сообщения: ${err}`, 'r');
            ctx.reply(`Воу! Я словил ошибку... Хз как так получилось, но вот всё, что мне известно: ${err}`, this.mainKeyboard.reply());
        }
    }

    isUserAuthed(ctx) {
        if(global.settings.userName == ctx.update.message.from.username) {
            if(!getConst('chatId')) setConst('chatId', ctx.update.message.chat.id);
            return true;
        }
        return false;
    }

    getMainKeyboard() {
        return Keyboard.make([
            ['🔥 Статус 🔥'],
            ['🚀 Редактировать автовыдачу 🚀'],
            ['❔ Инфо ❔'],
            ['⚙️ Конфиг ⚙️']
        ]);
    }

    getEditGoodsKeyboard() {
        return Keyboard.make([
            ['☑️ Добавить товар ☑️', '📛 Удалить товар 📛'],
            ['⬇️ Получить файл автовыдачи ⬇️', '⬆️ Загрузить файл автовыдачи ⬆️'],
            ['🔙 Назад 🔙']
        ]);
    }

    getConfigKeyboard() {
        return Keyboard.make([
            ['🟢 Всегда онлайн 🟢', '⬆️ Автоподнятие предложений ⬆️'],
            ['1. 📦', '2. ✉️', '3. ⬆️', '4. 🚚'],
            ['🔥 Отключить всё 🔥', '✅ Включить всё ✅'],
            ['🔙 Назад 🔙']
        ]);
    }

    getSelectIssueTypeKeyboard() {
        return Keyboard.make([
            ['Инструкция (выдача одного и того же текста)'],
            ['Аккаунты (выдача разных текстов по очереди)'],
            ['🔙 Назад 🔙']
        ]);
    }

    getBackKeyboard() {
        return Keyboard.make([
            ['🔙 Назад 🔙']
        ]);
    }


    async replyConfig(ctx) {
        const alwaysOnline = (global.settings.alwaysOnline) ? 'Вкл' : 'Выкл';
        const lotsRaise = (global.settings.lotsRaise) ? 'Вкл' : 'Выкл';
        const newOrderNonAutoNotification = (global.settings.newOrderNonAutoNotification) ? 'Вкл' : 'Выкл';
        const newMessageNotification = (global.settings.newMessageNotification) ? 'Вкл' : 'Выкл';
        const lotsRaiseNotification = (global.settings.lotsRaiseNotification) ? 'Вкл' : 'Выкл';
        const deliveryNotification = (global.settings.deliveryNotification) ? 'Вкл' : 'Выкл';
        const msg = `⚙️ Конфиг:\n❗ Измененные параметры применяются до первого рестарта и не перезаписывают файл настроек.\n\n⬆️ Автоподнятие предложений: <b>${lotsRaise}</b>\n🟢 Всегда онлайн: <b>${alwaysOnline}</b>\n\n1. 📦 Уведомления о новых заказах (не автовыдача): <b>${newOrderNonAutoNotification}</b>\n2. ✉️ Уведомления о новых сообщениях: <b>${newMessageNotification}</b>\n3. ⬆️ Уведомления о поднятиях: <b>${lotsRaiseNotification}</b>\n4. 🚚 Уведомления о выдаче товара: <b>${deliveryNotification}</b>\n\nЧтобы не обновлялся ваш онлайн на сайте, отключите все настройки.`
        ctx.replyWithHTML(msg, this.configKeyboard.reply());
    }


    async updateConfig(ctx, settingName, displayText) {
        let alwaysOnline = global.settings.alwaysOnline;
        let lotsRaise = global.settings.lotsRaise;
        let newOrderNonAutoNotification = global.settings.newOrderNonAutoNotification;
        let newMessageNotification = global.settings.newMessageNotification;
        let lotsRaiseNotification = global.settings.lotsRaiseNotification;
        let deliveryNotification = global.settings.deliveryNotification;

        switch (settingName) {
            case 'alwaysOnline':
                alwaysOnline = alwaysOnline ? 0 : 1;
                break;
            case 'lotsRaise':
                lotsRaise = lotsRaise ? 0 : 1;
                break;
            case 'newOrderNonAutoNotification':
                newOrderNonAutoNotification = newOrderNonAutoNotification ? 0 : 1;
                break;
            case 'newMessageNotification':
                newMessageNotification = newMessageNotification ? 0 : 1;
                break;
            case 'lotsRaiseNotification':
                lotsRaiseNotification = lotsRaiseNotification ? 0 : 1;
                break;
            case 'deliveryNotification':
                deliveryNotification = deliveryNotification ? 0 : 1;
                break;
        }

        global.settings = await loadSettings({ alwaysOnline, lotsRaise, newOrderNonAutoNotification, newMessageNotification, lotsRaiseNotification, deliveryNotification });

        const msg = `${displayText}: <b>${(global.settings[settingName]) ? 'Вкл' : 'Выкл'}</b>`;
        ctx.replyWithHTML(msg, this.configKeyboard.reply());
    }

    async toggleAllConfig(ctx, type) {
        let status;
        switch (type) {
            case '🔥 Отключить всё 🔥':
                status = 0;
                break;
            case '✅ Включить всё ✅':
                status = 1;
                break;
        }
        global.settings = await loadSettings({
            alwaysOnline: status,
            lotsRaise: status,
            newOrderNonAutoNotification: status,
            newMessageNotification: status,
            lotsRaiseNotification: status,
            deliveryNotification: status
        });
        const msg = `✅ Все настройки были: <b>${status ? 'Включены' : 'Отключены'}</b>!`;
        ctx.replyWithHTML(msg, this.configKeyboard.reply());
    }

    async alwaysOnlineConfigChange(ctx) {
        await this.updateConfig(ctx, 'alwaysOnline', '🟢 Всегда онлайн');
    }

    async lotsRaiseConfigChange(ctx) {
        await this.updateConfig(ctx, 'lotsRaise', '⬆️ Автоподнятие предложений');
    }

    async newOrderNonAutoNotificationConfigChange(ctx) {
        await this.updateConfig(ctx, 'newOrderNonAutoNotification', '📦 Уведомления о новых заказах (не автовыдача)');
    }

    async newMessageNotificationConfigChange(ctx) {
        await this.updateConfig(ctx, 'newMessageNotification', '✉️ Уведомления о новых сообщениях');
    }

    async lotsRaiseNotificationConfigChange(ctx) {
        await this.updateConfig(ctx, 'lotsRaiseNotification', '️⬆️ Уведомления о поднятиях');
    }

    async deliveryNotificationConfigChange(ctx) {
        await this.updateConfig(ctx, 'deliveryNotification', '🚚 Уведомления о выдаче товара');
    }


    async replyStatus(ctx) {
        const time = Date.now();
        const workTimeDiff = time - global.startTime;
        const lastUpdateTimeDiff = time - global.appData.lastUpdate;

        function declensionNum(num, words) {
            return words[(num % 100 > 4 && num % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(num % 10 < 5) ? num % 10 : 5]];
        }

        function msToTime(ms) {
            let days = ms > 0 ? Math.floor(ms / 1000 / 60 / 60 / 24) : 0;
            let hours = ms > 0 ? Math.floor(ms / 1000 / 60 / 60) % 24 : 0;
            let minutes = ms > 0 ? Math.floor(ms / 1000 / 60) % 60 : 0;
            let seconds = ms > 0 ? Math.floor(ms / 1000) % 60 : 0;
            days = ms < 10 ? '0' + days : days;
            hours = hours < 10 ? '0' + hours : hours;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            const daysTitle = declensionNum(days, ['день', 'дня', 'дней']);
            const hoursTitle = declensionNum(hours, ['час', 'часа', 'часов']);
            const minutesTitle = declensionNum(minutes, ['минута', 'минуты', 'минут']);
            const secondsTitle = declensionNum(seconds, ['секунда', 'секунды', 'секунд']);
            return {days: days, hours: hours, minutes: minutes, seconds: seconds, daysTitle: daysTitle, hoursTitle: hoursTitle, minutesTitle: minutesTitle, secondsTitle: secondsTitle};
        }

        const workTimeArr = msToTime(workTimeDiff);
        const workTime = `${workTimeArr.days} ${workTimeArr.daysTitle} ${workTimeArr.hours} ${workTimeArr.hoursTitle} ${workTimeArr.minutes} ${workTimeArr.minutesTitle} ${workTimeArr.seconds} ${workTimeArr.secondsTitle}`;

        const lastUpdateTimeArr = msToTime(lastUpdateTimeDiff);
        const lastUpdateTime = `${lastUpdateTimeArr.minutes} ${lastUpdateTimeArr.minutesTitle} ${lastUpdateTimeArr.seconds} ${lastUpdateTimeArr.secondsTitle}`;

        const autoIssue = (global.settings.autoIssue) ? 'Вкл' : 'Выкл';
        const alwaysOnline = (global.settings.alwaysOnline) ? 'Вкл' : 'Выкл';
        const lotsRaise = (global.settings.lotsRaise) ? 'Вкл' : 'Выкл';
        const goodsStateCheck = (global.settings.goodsStateCheck) ? 'Вкл' : 'Выкл';
        const autoResponse = (global.settings.autoResponse) ? 'Вкл' : 'Выкл';

        const msg = `🔥 <b>Статус</b> 🔥\n\n🔑 Аккаунт: <code>${global.appData.userName}</code>\n💰 Баланс: <code>${global.appData.balance}</code>\n🛍️ Продажи: <code>${global.appData.sales}</code>\n♻️ Последнее обновление: <code>${lastUpdateTime} назад</code>\n\n🕒 Время работы: <code>${workTime}</code>\n⏲ Всегда онлайн: <code>${alwaysOnline}</code>\n👾 Автоответ: <code>${autoResponse}</code>\n🚀 Автовыдача: <code>${autoIssue}</code>\n🏆 Автоподнятие предложений: <code>${lotsRaise}</code>\n🔨 Автовосстановление предложений: <code>${goodsStateCheck}</code>\n\n<i><a href="https://t.me/fplite">FunPayServer</a></i>`;
        const params = this.mainKeyboard.reply();
        params.disable_web_page_preview = true;
        ctx.replyWithHTML(msg, params);
    }

    async editAutoIssue(ctx) {
        try {
            const goods = await load('data/configs/delivery.json');
            let goodsStr = '';

            let msg = `📄 <b>Список товаров</b> 📄`;
            await ctx.replyWithHTML(msg, this.editGoodsKeyboard.reply());
    
            for(let i = 0; i < goods.length; i++) {
                goodsStr += `[${i + 1}] ${goods[i].name}\n`;
    
                if(goodsStr.length > 3000) {
                    await ctx.replyWithHTML(goodsStr, this.editGoodsKeyboard.reply());
                    goodsStr = '';
                }

                if(i == (goods.length - 1)) {
                    await ctx.replyWithHTML(goodsStr, this.editGoodsKeyboard.reply());
                }
            }
        } catch (err) {
            log(`Ошибка при выдаче списка товаров: ${err}`, 'r');
        }
    }

    getInfo(ctx) {
        const msg = `❔ <b>FunPayServer</b> ❔\n\n<b>FunPayServer</b> - это бот для площадки funpay.com с открытым исходным кодом, разработанный <b>NightStranger</b>.\n\nБольшое спасибо всем, кто поддерживает данный проект ❤️. Он живёт благодаря вам.\n\n<a href="https://github.com/NightStrang6r/FunPayServer">GitHub</a> | <a href="https://github.com/NightStrang6r/FunPayServer">Поддержать проект</a>`;
        ctx.replyWithHTML(msg);
    }

    addProduct(ctx) {
        ctx.replyWithHTML(`Выбери тип предложения`, this.selectIssueTypeKeyboard.reply());
    }

    addProductName(ctx) {
        ctx.replyWithHTML(`Окей, отправь мне название предложения. Можешь просто скопирвать его из funpay. Эмодзи в названии поддерживаются.`);
        this.waitingForLotName = true;
    }

    removeProduct(ctx) {
        ctx.replyWithHTML(`Введи номер товара, который нужно удалить из списка автовыдачи.`);
        this.waitingForLotDelete = true;
    }

    async back(ctx) {
        this.waitingForLotName = false;
        this.waitingForLotContent = false;
        this.waitingForLotDelete = false;
        this.waitingForDeliveryFile = false;

        if(this.products.length > 0) {
            let goods = await load('data/configs/delivery.json');

            const product = {
                "name": this.lotName,
                "nodes": this.products
            }

            goods.push(product);
            await updateFile(goods, 'data/configs/delivery.json');
            this.products = [];
        }

        ctx.reply('🏠 Меню', this.mainKeyboard.reply());
    }

    async saveLotName(ctx) {
        const msg = ctx.update.message.text;

        this.waitingForLotName = false;
        this.lotName = msg;

        let replyMessage = 'Понял-принял. Теперь отправь мне сообщение, которое будет выдано покупателю после оплаты.';
        if(this.lotType == 'accounts') {
            replyMessage = 'Понял-принял. Теперь отправь мне сообщение, которое будет выдано покупателю после оплаты. Ты можешь отправить несколько сообщений. Каждое сообщение будет выдано после каждой покупки. Нажми "🔙 Назад 🔙" когда закончишь заполнять товар.';
        }

        ctx.reply(replyMessage, this.backKeyboard.reply());
        this.waitingForLotContent = true;
    }

    async saveLotContent(ctx) {
        const msg = ctx.update.message.text;

        this.lotContent = msg;
        let keyboard = this.backKeyboard;
        let goods = await load('data/configs/delivery.json');

        if(this.lotType != 'accounts') {
            this.waitingForLotContent = false;
            keyboard = this.mainKeyboard;

            const product = {
                "name": this.lotName,
                "message": this.lotContent
            }
    
            goods.push(product);
            await updateFile(goods, 'data/configs/delivery.json');

            this.lotName = '';
            this.lotContent = '';
        } else {
            keyboard = this.backKeyboard;

            this.products.push(msg);
        }

        ctx.reply(`Окей, сохранил товар.`, keyboard.reply());
    }

    async deleteLot(ctx) {
        const msg = ctx.update.message.text;
        this.waitingForLotDelete = false;

        let num = Number(msg);
        if(isNaN(num)) {
            ctx.reply(`Что-то это не похоже на число... Верну тебя в меню.`, this.mainKeyboard.reply());
            return;
        }

        let goods = await load('data/configs/delivery.json');
        if(num > goods.length || num < 0) {
            ctx.reply(`Такого id нет в списке автовыдачи. Верну тебя в меню.`, this.mainKeyboard.reply());
            return;
        }

        let name = goods[num - 1].name;
        goods.splice(num - 1, 1);
        await updateFile(goods, 'data/configs/delivery.json');

        ctx.reply(`Ок, удалил товар "${name}" из списка автовыдачи.`, this.mainKeyboard.reply());
    }

    async getAutoIssueFile(ctx) {
        let contents = getConst('autoIssueFilePath');

        ctx.replyWithDocument({
            source: contents,
            filename: 'delivery.json'
        }).catch(function(error) { log(error); })
    }

    uploadAutoIssueFile(ctx) {
        this.waitingForDeliveryFile = true;
        ctx.reply(`Окей, пришли мне файл автовыдачи в формате JSON.`, this.backKeyboard.reply());
    }

    async onUploadDeliveryFile(ctx) {
        let file = ctx.update.message.document;
        let file_id = file.file_id;
        let file_name = file.file_name;
        let contents = null;

        if(file_name != 'delivery.json') {
            ctx.reply(`❌ Неверный формат файла.`, this.mainKeyboard.reply());
            return;
        }

        try {
            ctx.reply(`♻️ Загружаю файл...`);

            let file_path = await this.bot.telegram.getFileLink(file_id);
            let fileContents = await fetch(file_path);
            contents = await fileContents.text();
        } catch(e) {
            ctx.reply(`❌ Не удалось загрузить файл.`, this.mainKeyboard.reply());
            return;
        }

        try {
            ctx.reply(`♻️ Проверяю валидность...`);

            let json = JSON.parse(contents);
            await updateFile(json, 'data/configs/delivery.json');
            ctx.reply(`✔️ Окей, обновил файл автовыдачи.`, this.editGoodsKeyboard.reply());
        } catch(e) {
            ctx.reply(`❌ Неверный формат JSON.`, this.mainKeyboard.reply());
        }
    }

    async onInlineQuery(ctx) {
        console.log(ctx);
    }

    getChatID() {
        let chatId = getConst('chatId');
        if(!chatId) {
            log(`Напишите своему боту в Telegram, чтобы он мог отправлять вам уведомления.`);
            return false;
        }
        return chatId;
    }

    async sendNewMessageNotification(message) {
        if(message.content.startsWith(`Покупатель ${message.user} оплатил заказ`)) {
            if(global.settings.newOrderNonAutoNotification == true) await this.sendNewOrderNonAutoNotification(message);
            return;
        }
        if(global.settings.newMessageNotification == false) return;

        let msg = `💬 <b>Новое сообщение</b> от пользователя <b><i>${message.user}</i></b>.\n\n`;
        msg += `${message.content}\n\n`;
        msg += `<i>${message.time}</i> | <a href="https://funpay.com/chat/?node=${message.node}">Перейти в чат</a>`

        let chatId = this.getChatID();
        if(!chatId) return;
        await this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }

    async sendNewOrderNonAutoNotification(message) {
        const orderId = message.content.match(/#([A-Z0-9]{0,8})/);
        const goodName = message.content.split(`\n`);

        let msg = `✔️ <b>Новый заказ</b> <a href="https://funpay.com/orders/${orderId[0].replace('#', '')}">${orderId[0]}</a>.\n\n`;
        msg += `👤 <b>Покупатель:</b> <a href="https://funpay.com/chat/?node=${message.node}"><b>${message.user}</b></a>\n`;
        msg += `🛍️ <b>Товар:</b> <code>${goodName[0].slice(orderId.index+11)}</code>\n`;
        msg += `<i>${message.time}</i> | <a href="https://funpay.com/chat/?node=${message.node}">Перейти в чат</a>`

        let chatId = this.getChatID();
        if(!chatId) return;
        await this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }

    async sendNewOrderNotification(order) {
        let msg = `✔️ <b>Новый заказ</b> <a href="https://funpay.com/orders/${order.id.replace('#', '')}/">${order.id}</a> на сумму <b><i>${order.price} ${order.unit}</i></b>.\n\n`;
        msg += `👤 <b>Покупатель:</b> <a href="https://funpay.com/users/${order.buyerId}/">${order.buyerName}</a>\n`;
        msg += `🛍️ <b>Товар:</b> <code>${order.name}</code>`;

        let chatId = this.getChatID();
        if(!chatId) return;
        await this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }

    async sendLotsRaiseNotification(category, nextTimeMsg) {
        let msg = `⬆️ Предложения в категории <a href="https://funpay.com/lots/${category.node_id}/trade">${category.name}</a> подняты.\n`;
        msg += `⌚ Следующее поднятие: <b><i>${nextTimeMsg}</i></b>`;

        let chatId = this.getChatID();
        if(!chatId) return;
        this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }

    async sendDeliveryNotification(buyerName, productName, message) {
        let msg = `📦 Товар <code>${productName}</code> выдан покупателю <b><i>${buyerName}</i></b> с сообщением:\n\n`;
        msg += `${message}`;

        let chatId = this.getChatID();
        if(!chatId) return;
        this.bot.telegram.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }
}

export default TelegramBot;