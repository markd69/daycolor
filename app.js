const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const token = require("./token.json");
const fs = require("fs");
client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();
const sql = require('sqlite');
sql.open('./bot.sqlite');
const express = require('express');
const app = express();
const port = 8080;

//webserver
const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: true });
const url = require('url');

//others
const ReverseMd5 = require('reverse-md5');
let reverseMd5 = ReverseMd5({
    lettersUpper: false,
    lettersLower: true,
    numbers: true,
    special: false,
    whitespace: true,
    maxLen: 12
});
const fetch = require('node-fetch');

function WebSocketSetup() {
    wss.on('connection', function(ws) {
        ws.on('message', async function(message) {
            let msg = JSON.stringify(message);
            const arguments = ['id', 'username', 'discriminator'];
            for (let i = 0; i < arguments.length; i++) {
                if (msg[arguments[i]] === undefined) return;
            }
            let user = await client.users.find(u => u.username === msg['username'] && u.discriminator === msg['discriminator']);
            if (!user) return;
            await sql.run(`INSERT INTO whmcs VALUES (?, ?)`, [msg['id'], user.id]);
        });
    });
}

function expressSetup() {
    let clientId;

    app.set('view engine', 'ejs');

    app.use(express.static('public'));

    app.get('/api/discordauth/', (req, res) => {
        let whmcsId = req.query.clientId;
        res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=402488143821012992&redirect_uri=http%3A%2F%2F172.106.202.26%3A8080%2Fapi%2Fdiscord%2F&response_type=code&scope=identify`);
    });

    app.get('/api/discord/', async (req, res) => {
        try {
            console.log(1);
            let body =
                {
                    client_id: '402488143821012992',
                    client_secret: 'hx0VmpOIa5MHn9M6OXKgbo2nhaVXzrTn',
                    grant_type: 'authorization_code',
                    code: req.query.code,
                    redirect_uri: 'http://172.106.202.26:8080/api/discord/',
                    scope: 'identify'
                };
            let URL = '?';
            for (let i = 0; i < Object.keys(body).length; i++) {
                let item = Object.entries(body)[i];
                URL = URL + `${item[0]}=${item[1]}&`;
            }
            console.log(2);
            URL = URL.slice(0, -1);
            let returned = await fetch('https://discordapp.com/api/oauth2/token'+URL, {method: 'POST'});
            console.log(3);
            let returnedJson = await returned.json();
            let headers = {
                Authorization: 'Bearer '+returnedJson.access_token
            };
            returned = await fetch('https://discordapp.com/api/users/@me', {method: 'GET', headers: headers});
            console.log(4);
            returnedJson = await returned.json();
            let id = returnedJson.id;
            let whmcsId = res.req.query.state;
            whmcsId = reverseMd5(whmcsId).str;
            await sql.run(`INSERT INTO whmcs VALUES (?, ?)`, [whmcsId, id]);
            console.log(5);  
            res.redirect('/success');
            console.log(6);
        } catch (err) {
            console.error(err, 'catched');
            res.redirect('/fail');
        }
    });

    app.get('/success', (req, res) => {
        res.render('success');
    });

    app.get('/fail', (req, res) => {
        res.render('fail');
    });

    app.listen(port, () => {});
}

client.elevation = async msg => {
  let permlvl = 0;

  config.staffRoles.map(r => {
      let role = msg.guild.roles.find(role => role.name === r);
      if (role) {
          if (msg.member.roles.has(role.id)) permlvl = 1;
      }
  });

  if (msg.author.id === msg.guild.ownerID) permlvl = 2;
  return permlvl;
};

fs.readdir('./commands', (err, files) => {
    if (err) console.error(err);
    files.forEach(f => {
      let props = require(`./commands/${f}`);
      console.log(`Loading Command: ${props.help.name}.`);
      client.commands.set(props.help.name, props);
      props.conf.aliases.forEach(alias => {
        client.aliases.set(alias, props.help.name);
      });
    });
    console.log(`Loading a total of ${files.length} commands.`);
  });

fs.readdir('./events/', (err, files) => {
    if (err) console.error(err);
    console.log(`Loading a total of ${files.length} events.`);
    files.forEach(file => {
      const eventName = file.split(".")[0];
      const event = require(`./events/${file}`);
      if (eventName === "messageUpdate") client.on(eventName, event.bind(null));
      else client.on(eventName, event.bind(null, client));
      delete require.cache[require.resolve(`./events/${file}`)];
    });
  });


expressSetup();
WebSocketSetup;

client.login(token.token);
