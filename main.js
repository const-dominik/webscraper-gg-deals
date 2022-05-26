const axios = require('axios');
const jsdom = require('jsdom');
const SteamAPI = require('steamapi');
const http = require('http');
const cron = require('cron').CronJob;

const requestListener = function (req, res) {
  res.writeHead(200);
  res.end('Hello, World!');
}

const server = http.createServer(requestListener);
server.listen(process.env.PORT);

const steam = new SteamAPI('BEFA4070369049AA5FD499DC7D51D868');
const fs = require('fs');

if (!fs.existsSync("deals.json")) fs.writeFile("deals.json", "{}", () => {});

const URL = "https://gg.deals/deals/?minDiscount=1&minGameRating=5&onlyBestDeal=1&onlyHistoricalLow=1&store=4";

const getGameId = (allGames, gameName) => {
    for (const {appid, name} of allGames) {
        if (name === gameName) {
            return appid;
        }
    }
    return false;
}

const isPriceLower = (price1, price2) => price1 < price2;

const createEmbed = object => {
    const { name, rating, price, originalPrice, discount, metacritic, gameUrl, image } = object;
    const embed = {
        'title': `${name} (${rating}) jest na przecenie! (${discount})`,
        'description': `Przeceniony z ${originalPrice} na ${price}. ${metacritic ? "Ocenka: " + metacritic : ""}`,
        'fields': [
            { name: "URL", value: gameUrl }
        ],
        'thumbnail': {
            'url': image
        }
    };
    return embed;
}

const getDeals = async () => {
    try {
        console.log(new Date().toLocaleTimeString());
        const file = JSON.parse(fs.readFileSync("deals.json"));
        const request = await axios.get(URL);
        const data = request.data;
        const DOM = new jsdom.JSDOM(data).window.document;
        const allDeals = DOM.querySelectorAll(".deal-list-item");
        const allGames = await steam.getAppList();
        const gamesEmbeds = [];
        for (const deal of allDeals) {
            const name = deal.querySelector(".title-line a").textContent;
            const image = deal.querySelector(".main-image img").getAttribute("src");
            const id = String(getGameId(allGames, name));
            console.log(id);
            const details = await steam.getGameDetails(id);
            const metacritic = details.metacritic?.score || 0;
            const rating = deal.querySelector(".rating-badge").textContent;
            const [price, originalPrice] = Array.from(deal.querySelectorAll(".price .double-line span")).map(el => el.textContent);
            const discount = deal.querySelector(".discount-badge").textContent;
            const gameUrl = `https://store.steampowered.com/app/${id}/${name.replace(/ /g, "_")}/`;
            const gameObject = new Game(name, rating, price, originalPrice, discount, metacritic, gameUrl, image);
            if (!file.hasOwnProperty(name) || isPriceLower(price, file[name].price)) {
                file[name] = gameObject;
                gamesEmbeds.push(createEmbed(gameObject));
            };
        }
        if (gamesEmbeds.length) {
            const WH = "https://discordapp.com/api/webhooks/746080172603605012/n4eTp71gRtt5M7ZDdGbgDVpEy8uCMX1fEdQPjyJPJjFVb5fCmpRdDZVo3aYzSMfOYTKS";
            await axios.post(WH, {
                embeds: gamesEmbeds
            });
            gamesEmbeds.length = 0;
        }
        fs.writeFileSync("deals.json", JSON.stringify(file));
    } catch (e) {
        console.log(e);
    }
}

class Game {
    constructor(name, rating, price, originalPrice, discount, metacritic, gameUrl, image) {
        this.name = name;
        this.rating = rating;
        this.price = price;
        this.originalPrice = originalPrice;
        this.discount = discount;
        this.metacritic = metacritic;
        this.gameUrl = gameUrl;
        this.image = image;
    }
}

const job = new cron('00 10,30,50 * * * *', getDeals);
job.start();

getDeals()