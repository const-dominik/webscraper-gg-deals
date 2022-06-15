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

const steam = new SteamAPI('');
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

const areEqual = (obj1, obj2) => {
    console.log("Sprawdzam.");
    const firstKeys = Object.keys(obj1);
    const secondKeys = Object.keys(obj2);
    if (firstKeys.length !== secondKeys.length) {
        return false;
    }

    if (firstKeys.some((key, index) => obj1[key] !== obj2[secondKeys[index]])) {
        return false;
    }

    return true;
}

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
    console.log(new Date().toLocaleTimeString());
    const file = JSON.parse(fs.readFileSync("deals.json"));
    const request = await axios.get(URL);
    const data = request.data;
    const DOM = new jsdom.JSDOM(data).window.document;
    const allDeals = DOM.querySelectorAll(".deal-list-item");
    const allGames = await steam.getAppList();
    const gamesEmbeds = []
    for (const deal of allDeals) {
        const name = deal.querySelector(".title-line a").textContent;
        const image = deal.querySelector(".main-image img").getAttribute("src");
        const id = String(getGameId(allGames, name));
        const details = await steam.getGameDetails(id);
        const metacritic = details.metacritic?.score || 0;
        const rating = deal.querySelector(".rating-badge").textContent;
        const [price, originalPrice] = Array.from(deal.querySelectorAll(".price .double-line span")).map(el => el.textContent);
        const discount = deal.querySelector(".discount-badge").textContent;
        const gameUrl = `https://store.steampowered.com/app/${id}/${name.replace(/ /g, "_")}/`;
        const gameObject = new Game(name, rating, price, originalPrice, discount, metacritic, gameUrl, image);
        if (!file.hasOwnProperty(name) || !areEqual(file[name], gameObject)) {
            file[name] = gameObject;
            gamesEmbeds.push(createEmbed(gameObject));
        };
    }
    if (gamesEmbeds.length) {
        const WH = "";
        await axios.post(WH, {
            embeds: gamesEmbeds
        });
        gamesEmbeds.length = 0;
    }
    fs.writeFileSync("deals.json", JSON.stringify(file));
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

const job = new cron('* 10,30,50 * * * *', getDeals);
job.start();
