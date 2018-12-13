"use strict";

// モジュールインポート
const express = require("express");
const server = express();
const bodyParser = require("body-parser");
const jwt = require('jsonwebtoken');
const https = require("https");
const request = require("request");
const qs = require("querystring");

//変数
const APIID = process.env.APIID;
const SERVERID = process.env.SERVERID;
const CONSUMERKEY = process.env.CONSUMERKEY;
const PRIVATEKEY = process.env.PRIVATEKEY;
const BOTNO = process.env.BOTNO;

///////////////////////////////////////////////
var options = {
    // initialization options;
};

const pgp = require("pg-promise")(options);
//変数
const DB_URL = process.env.DATABASE_URL;

var db = pgp(DB_URL);

module.exports = db;
///////////////////////////////////////////////

server.use(bodyParser.json());

// Webアプリケーション起動
var app = server.listen(process.env.PORT || 3000, function(){
    console.log("Node.js is listening to PORT:" + app.address().port);
});

// サーバー起動確認
server.get('/', (req, res) => {
    res.send('Hello World!');
});

// 1秒置きにデータを確認
setInterval(function() {
  db.any("select * from TEST where No=$1", [1])
      .then(function (data) {
        // success;

        getJWT((jwttoken) => {
            getServerToken(jwttoken, (newtoken) => {
                sendMessage(newtoken, "mayukino@taxnac", "成功");
            });
        });

        console.log(data);
      })
      .catch(function (error) {
　　　　 // error;
        console.log(error);
      });
}, 5000);

// Botからメッセージに応答
server.post('/callback', (req, res) => {
    res.sendStatus(200);

    const message = req.body.content.text;
    const roomId = req.body.source.roomId;
    const accountId = req.body.source.accountId;

    getJWT((jwttoken) => {
        getServerToken(jwttoken, (newtoken) => {
            sendMessage(newtoken, accountId, message);
        });
    });
});

//サーバーAPI用JWT取得
function getJWT(callback){
    const iss = SERVERID;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + (60 * 60);　//JWTの有効期間は1時間
    const cert = PRIVATEKEY;
    const token = [];
    const jwttoken = jwt.sign({"iss":iss, "iat":iat, "exp":exp}, cert, {algorithm:"RS256"}, (err, jwttoken) => {
        if (!err) {
            callback(jwttoken);
        } else {
            console.log(err);
        }
    });
}

function getServerToken(jwttoken, callback) {
    const postdata = {
        url: 'https://authapi.worksmobile.com/b/' + APIID + '/server/token',
        headers : {
            'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        form: {
            "grant_type" : encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer"),
            "assertion" : jwttoken
        }
    };
    request.post(postdata, (error, response, body) => {
        if (error) {
            console.log(error);
            callback(error);
        } else {
            const jsonobj = JSON.parse(body);
            const AccessToken = jsonobj.access_token;
            callback(AccessToken);
        }
    });
}

function sendMessage(token, accountId, message) {
    const postdata = {
        url: 'https://apis.worksmobile.com/' + APIID + '/message/sendMessage/v2',
        headers : {
          'Content-Type' : 'application/json;charset=UTF-8',
          'consumerKey' : CONSUMERKEY,
          'Authorization' : "Bearer " + token
        },
        json: {
            "botNo" : Number(BOTNO),
            "accountId" : accountId,
            "content" : {
                "type" : "text",
                "text" : message
            }
        }
    };
    request.post(postdata, (error, response, body) => {
        if (error) {
          console.log(error);
        }
        console.log(body);
    });
}
