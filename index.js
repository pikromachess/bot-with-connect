require('dotenv').config();
const { Telegraf } = require('telegraf');
const { TonConnect } = require('@tonconnect/sdk');
const { LocalStorage } = require('node-localstorage');

// 1. Настройка хранилища
const localStorage = new LocalStorage('./tonconnect-storage');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const userConnectors = new Map();

bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    
    try {
        // 2. Инициализация коннектора
        const connector = new TonConnect({
            manifestUrl: 'https://pikromachess.github.io/bot-with-connect/tonconnect-manifest.json', // ЗАМЕНИТЕ НА СВОЙ!
            storage: {
                setItem: (key, value) => {
                    localStorage.setItem(`${userId}_${key}`, value);
                    console.log(`Stored: ${key} = ${value}`);
                },
                getItem: (key) => {
                    const value = localStorage.getItem(`${userId}_${key}`);
                    console.log(`Retrieved: ${key} = ${value}`);
                    return value;
                },
                removeItem: (key) => {
                    localStorage.removeItem(`${userId}_${key}`);
                    console.log(`Removed: ${key}`);
                }
            }
        });

        userConnectors.set(userId, connector);

        // 3. Подписка на изменения статуса
        connector.onStatusChange((wallet) => {
            console.log('Wallet status changed:', wallet);
            if (wallet) {
                ctx.reply(`✅ Кошелек успешно подключен!\nАдрес: ${wallet.account.address}\nСеть: ${wallet.account.chain}`);
            } else {
                ctx.reply('❌ Кошелек отключен');
            }
        });

        // 4. Генерация ссылки для подключения
        const connectUrl = await connector.connect({
            universalLink: 'https://app.tonkeeper.com/ton-connect',
            bridgeUrl: 'https://bridge.tonapi.io/bridge'
        });

        console.log('Generated connection URL:', connectUrl);

        // 5. Отправка кнопки пользователю
        await ctx.reply('Для подключения кошелька:', {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: '🔗 Подключить кошелек (Tonkeeper)',
                        url: connectUrl
                    }],
                    [{
                        text: '🔄 Проверить подключение',
                        callback_data: 'check_connection'
                    }]
                ]
            }
        });

    } catch (error) {
        console.error('Error in /start:', error);
        await ctx.reply('⚠️ Ошибка при подключении: ' + error.message);
    }
});

// 6. Обработка проверки подключения
bot.action('check_connection', async (ctx) => {
    const userId = ctx.from.id;
    const connector = userConnectors.get(userId);
    
    if (!connector) {
        return ctx.reply('❌ Сессия подключения не найдена. Начните с /start');
    }

    try {
        const wallet = await connector.account();
        if (wallet) {
            ctx.reply(`✅ Кошелек подключен!\nАдрес: ${wallet.address}\nСеть: ${wallet.chain}`);
        } else {
            ctx.reply('❌ Кошелек еще не подключен');
        }
    } catch (error) {
        ctx.reply('⚠️ Ошибка проверки: ' + error.message);
    }
});

bot.launch();
console.log('Бот запущен!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));