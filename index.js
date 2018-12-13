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
const DB_URL = process.env.DATABASE_URL;

///////////////////////////////////////////////
var options = {
    // initialization options;
};
const pgp = require("pg-promise")(options);
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

        var message = "";

        getJWT((jwttoken) => {
            getServerToken(jwttoken, (newtoken) => {
                sendMessageButton(newtoken, "mayukino@taxnac", message);
            });
        });

        console.log(data);
      })
      .catch(function (error) {
　　　　 // error;
        console.log(error);
      });
}, 30000);

// Botからメッセージに応答
server.post('/callback', (req, res) => {
    res.sendStatus(200);

    const rsvmessage = req.body.content.text;
    const roomId = req.body.source.roomId;
    const accountId = req.body.source.accountId;
    const returnValue = req.body.content.postback;
    const sendmessage = "？？？";

    if(returnValue == "RTN_OK"){
      sendmessage = "承認の旨を通知しました";
    }else if(returnValue == "RTN_NO"){
      sendmessage = "不承認の旨を通知しました";
    }

    getJWT((jwttoken) => {
        getServerToken(jwttoken, (newtoken) => {
            sendMessageText(newtoken, accountId, rsvmessage);
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

function sendMessageText(token, accountId, message) {
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

function sendMessageButton(token, accountId, message) {
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
                "type" : "buttonTemplate",
                "contentText": "承認しますか？",
                "buttons" : [{
                  "text": "承認する",
                  "postback": "RTN_OK"
                },{
                  "text": "承認しない",
                  "postback": "RTN_NO"
                }]
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
